import { chromium } from "playwright";
import WebSocket,{WebSocketServer} from "ws";
import { readFile,mkdir,writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { pool } from "../server/src/db/database";
import type { GameState } from "../shared/src/types";
const api="http://localhost:2567/api",origin="http://localhost:5174",directory=`docs/qa/network-${Date.now()}`;
await mkdir(directory,{recursive:true});
const login=await fetch(`${api}/auth/dev`,{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({teacher:"A"})});
assert.equal(login.status,200);const cookie=login.headers.get("set-cookie")!.split(";")[0]!;
async function post(path:string,body:object){const response=await fetch(`${api}/teacher/${path}`,{method:"POST",headers:{Origin:origin,Cookie:cookie,"Content-Type":"application/json"},body:JSON.stringify(body)});assert.ok(response.ok,`${path} ${response.status}`);return response.json();}
const evidence=JSON.parse(await readFile("docs/qa/pdf/result.json","utf8"));
const classroom=await post("classrooms",{title:`Network QA ${Date.now()}`,grade:2,curriculumTrack:"พื้นฐาน",term:"QA",topic:"แรง",objectives:[]});
const activity=await post("assignments",{title:"Network interruption QA",classroomId:classroom.id,versionId:evidence.versionId,durationMinutes:15});
const browser=await chromium.launch({channel:"msedge",headless:true});
const controls:Array<{offline:boolean;connections:Array<{page:WebSocket;server:WebSocket}>}>=[],pages=[],errors:string[]=[];
// A real loopback TCP/WebSocket proxy avoids Playwright's constructor mock and
// forwards binary Colyseus messages unchanged, with bounded delay only.
const proxy=new WebSocketServer({host:"127.0.0.1",port:2569});
proxy.on("connection",(page,request)=>{
  const url=new URL(request.url!,"ws://127.0.0.1:2567"),index=Number(url.searchParams.get("qaSeat"));url.searchParams.delete("qaSeat");
  const control=controls[index];if(!control||control.offline){page.terminate();return;}
  const server=new WebSocket(url),delay=100+index*50;control.connections.push({page,server});
  page.on("error",()=>{});server.on("error",()=>page.terminate());
  page.on("message",(data,binary)=>setTimeout(()=>{if(!control.offline&&server.readyState===WebSocket.OPEN)server.send(data,{binary});},delay));
  server.on("message",(data,binary)=>setTimeout(()=>{if(!control.offline&&page.readyState===WebSocket.OPEN)page.send(data,{binary});},delay));
  page.on("close",()=>server.terminate());server.on("close",()=>page.terminate());
});
const report:Record<string,unknown>={passed:false,assignmentId:activity.id,transport:"Real WebSocket server, delayed forwarding 100–150 ms each direction (200–300 ms added RTT)",errors};
async function snapshot():Promise<GameState>{return (await pool.query("SELECT snapshot->'public' state FROM game_sessions WHERE assignment_id=$1 ORDER BY created_at LIMIT 1",[activity.id])).rows[0]?.state;}
async function until(check:()=>Promise<boolean>,label:string,limit=20_000){const end=Date.now()+limit;while(Date.now()<end){if(await check())return;await new Promise(resolve=>setTimeout(resolve,250));}throw Error(`Timeout: ${label}`);}
try{
  let code="";
  for(let index=0;index<2;index++){
    const context=await browser.newContext({viewport:{width:1280,height:900}}),control={offline:false,connections:[] as Array<{page:WebSocket;server:WebSocket}>};controls.push(control);
    await context.addInitScript((seat)=>{const Native=window.WebSocket;window.WebSocket=class extends Native{constructor(url:string|URL,protocols?:string|string[]){const address=new URL(url);address.hostname="127.0.0.1";address.port="2569";address.searchParams.set("qaSeat",String(seat));super(address,protocols);}};},index);
    await context.route("**/*",route=>control.offline?route.abort():route.continue());
    const page=await context.newPage();pages.push(page);page.on("pageerror",error=>errors.push(error.message));
    await page.goto(activity.joinUrl);await page.getByLabel("ชื่อเล่น",{exact:true}).fill(`Network ${index+1}`);
    if(!index){await page.getByRole("button",{name:"สร้างห้อง",exact:true}).click();await page.getByText("Room code",{exact:true}).waitFor();code=(await page.getByText("Room code",{exact:true}).locator("..").locator("button").first().innerText()).trim();}
    else{await page.getByLabel("รหัสห้อง",{exact:true}).fill(code);await page.getByRole("button",{name:"เข้าห้อง",exact:true}).click();}
    await page.getByRole("button",{name:"พร้อมเล่น",exact:true}).click();
  }
  await pages[0]!.getByRole("button",{name:"เริ่มเกม",exact:true}).click();await until(async()=>Boolean((await snapshot())?.endsAt),"start under latency");
  const before=await snapshot(),first=before.players.find(player=>player.name==="Network 1")!.id,second=before.players.find(player=>player.name==="Network 2")!.id;
  for(const seconds of [30,125]){
    controls[0]!.offline=true;for(const socket of controls[0]!.connections){socket.page.terminate();socket.server.terminate();}
    await until(async()=>{const state=await snapshot();return !state.players.find(player=>player.id===first)!.connected&&state.hostId===second;},"host transfer");
    console.log(`Host disconnected for ${seconds} real seconds`);await new Promise(resolve=>setTimeout(resolve,seconds*1000));
    if(seconds>120)assert.equal((await snapshot()).players.find(player=>player.id===first)!.inactive,true);
    controls[0]!.offline=false;
    if(seconds>120){await pages[0]!.reload();await pages[0]!.getByRole("button",{name:"กลับเข้าเกมเดิม",exact:true}).click();}
    await until(async()=>Boolean((await snapshot()).players.find(player=>player.id===first)?.connected),"authenticated return",30_000);
    assert.equal((await snapshot()).players.filter(player=>player.id===first).length,1);
    await pages[0]!.screenshot({path:`${directory}/rejoined-${seconds}.png`});
  }
  const room=(await pool.query("SELECT id FROM game_sessions WHERE assignment_id=$1",[activity.id])).rows[0];
  await until(async()=> (await snapshot()).phase==="answering","question before teacher pause",60_000);
  await post(`assignments/${activity.id}/rooms/${room.id}/control`,{command:"pause"});
  const paused=await snapshot();console.log("Teacher pause for 60 real seconds");await new Promise(resolve=>setTimeout(resolve,60_000));
  const stillPaused=await snapshot();assert.equal(stillPaused.turnCount,paused.turnCount);assert.equal(stillPaused.pendingQuestion?.id,paused.pendingQuestion?.id);assert.equal(stillPaused.pendingQuestion?.deadline,paused.pendingQuestion?.deadline);
  await post(`assignments/${activity.id}/rooms/${room.id}/control`,{command:"resume"});
  const resumed=await snapshot();assert.equal(resumed.paused,undefined);assert.ok(resumed.pendingQuestion!.deadline-paused.pendingQuestion!.deadline>=60_000);
  const cdp=await pages[0]!.context().newCDPSession(pages[0]!);await cdp.send("Page.setWebLifecycleState",{state:"frozen"});
  console.log("Browser lifecycle frozen for 20 real seconds");await new Promise(resolve=>setTimeout(resolve,20_000));await cdp.send("Page.setWebLifecycleState",{state:"active"});
  await until(async()=>Boolean((await snapshot()).players.find(player=>player.id===first)?.connected),"background return");assert.equal((await snapshot()).players.filter(player=>player.id===first).length,1);
  await post(`assignments/${activity.id}/rooms/${room.id}/control`,{command:"end"});
  await pages[0]!.getByRole("button",{name:"Play again",exact:true}).waitFor();
  await pages[0]!.getByRole("heading",{name:"ผลการเรียนรู้ส่วนตัว",exact:true}).waitFor();
  await until(async()=>!(await pages[0]!.getByText("กำลังอ่านผลของคุณ…").count()),"personal report browser");
  await pages[0]!.getByText(/ผลของ Network 1 เท่านั้น/).waitFor();
  await pages[0]!.screenshot({path:`${directory}/postgame.png`});
  assert.deepEqual(errors,[]);report.passed=true;report.offlineSeconds=[30,125];report.sameIdentity=true;report.hostTransfer=true;report.teacherPauseResume=true;report.pauseSeconds=60;report.backgroundLifecycleFrozenSeconds=20;
}catch(error){report.failure=String(error);process.exitCode=1;for(const[index,page]of pages.entries())await page.screenshot({path:`${directory}/failure-${index}.png`}).catch(()=>{});}
finally{await browser.close();for(const client of proxy.clients)client.terminate();proxy.close();await pool.end();await writeFile(`${directory}/result.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({directory,...report}));}
