import { chromium } from "playwright";
import { readFile,mkdir,writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { pool } from "../server/src/db/database";
const origin="http://localhost:5174",api="http://localhost:2567/api",directory=`docs/qa/walkthrough-${Date.now()}`;
await mkdir(directory,{recursive:true});
const login=await fetch(`${api}/auth/dev`,{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({teacher:"A"})});assert.equal(login.status,200);const cookie=login.headers.get("set-cookie")!.split(";")[0]!;
async function post(path:string,body:object){const response=await fetch(`${api}/teacher/${path}`,{method:"POST",headers:{Origin:origin,Cookie:cookie,"Content-Type":"application/json"},body:JSON.stringify(body)});assert.ok(response.ok);return response.json();}
const evidence=JSON.parse(await readFile("docs/qa/pdf/result.json","utf8"));
const classroom=await post("classrooms",{title:`Walkthrough QA ${Date.now()}`,grade:2,curriculumTrack:"พื้นฐาน",term:"QA",topic:"แรง",objectives:[]});
const activity=await post("assignments",{title:"QA real one-lap recording",classroomId:classroom.id,versionId:evidence.versionId,durationMinutes:15});
const browser=await chromium.launch({channel:"msedge",headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:directory,size:{width:1280,height:900}}}),page=await context.newPage();
const errors:string[]=[],report:Record<string,unknown>={passed:false,assignmentId:activity.id,errors};page.on("pageerror",error=>errors.push(error.message));
try{
  await page.goto(activity.joinUrl);await page.getByLabel("ชื่อเล่น",{exact:true}).fill("Walkthrough QA");await page.getByRole("button",{name:"สร้างห้อง",exact:true}).click();await page.getByRole("button",{name:"พร้อมเล่น",exact:true}).click();await page.getByRole("button",{name:"เริ่มเกม",exact:true}).click();await page.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.triangles)>0);
  await page.screenshot({path:`${directory}/before.png`});
  await page.evaluate(()=>{(window as any).qaWalk=setInterval(()=>{const dialog=document.querySelector('[role="dialog"]');if(dialog){dialog.querySelector<HTMLButtonElement>(".mt-5.grid button:not(:disabled)")?.click();return;}[...document.querySelectorAll<HTMLButtonElement>("button")].find(button=>!button.disabled&&/^(Roll dice|Buy with quiz|Upgrade with quiz|Pass)$/.test(button.textContent?.trim()??""))?.click();},400);});
  let steps=0,last=0;const started=Date.now();
  while(steps<28){const row=(await pool.query("SELECT snapshot->'public' state FROM game_sessions WHERE assignment_id=$1",[activity.id])).rows[0];const tile=row?.state?.players?.[0]?.tileIndex??0;steps+=(tile-last+28)%28;last=tile;assert.ok(Date.now()-started<180_000,"one-lap timeout");await new Promise(resolve=>setTimeout(resolve,500));}
  await page.evaluate(()=>clearInterval((window as any).qaWalk));await page.waitForTimeout(3200);await page.screenshot({path:`${directory}/after-lap.png`});
  assert.deepEqual(errors,[]);report.passed=true;report.realServerSteps=steps;report.seconds=(Date.now()-started)/1000;report.note="Real solo classroom room and UI intents; no injected dice/money/snapshot. Silent browser recording, not a full-game acceptance substitute.";
}catch(error){report.failure=String(error);process.exitCode=1;}finally{
  const rooms=(await pool.query("SELECT id FROM game_sessions WHERE assignment_id=$1",[activity.id])).rows;
  for(const room of rooms)await post(`assignments/${activity.id}/rooms/${room.id}/control`,{command:"end"});
  const video=page.video();await context.close();if(video){await video.saveAs(`${directory}/one-lap.webm`);report.video="one-lap.webm";}await browser.close();await pool.end();await writeFile(`${directory}/result.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({directory,...report}));
}
