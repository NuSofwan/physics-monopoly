import { chromium } from "playwright";
import { mkdir,readFile,writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const minutes=Number(process.env.QA_SOAK_MINUTES??60);assert.ok(minutes>=1&&minutes<=120);
const directory=`docs/qa/soak-${Date.now()}`,origin="http://localhost:5174",base="http://localhost:2567/api";
await mkdir(directory,{recursive:true});
const login=await fetch(`${base}/auth/dev`,{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({teacher:"A"})});assert.equal(login.status,200);
const cookie=login.headers.get("set-cookie")!.split(";")[0]!;
async function post(path:string,body:object){const response=await fetch(`${base}/teacher/${path}`,{method:"POST",headers:{Origin:origin,Cookie:cookie,"Content-Type":"application/json"},body:JSON.stringify(body)});assert.ok(response.ok);return response.json();}
const evidence=JSON.parse(await readFile("docs/qa/pdf/result.json","utf8"));
const classroom=await post("classrooms",{title:`Soak QA ${Date.now()}`,grade:2,curriculumTrack:"พื้นฐาน",term:"QA",topic:"แรง",objectives:[]});
const assignment=await post("assignments",{title:"One-hour browser memory QA",classroomId:classroom.id,versionId:evidence.versionId,durationMinutes:40});
const browser=await chromium.launch({channel:"msedge",headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors:string[]=[],samples:Array<{seconds:number;heap:number;nodes:number;listeners:number;documents:number;finished:boolean}>=[];
const report:Record<string,unknown>={passed:false,assignmentId:assignment.id,requestedMinutes:minutes,method:"One real 40-minute solo class game followed by result view; CDP forced GC once/minute to sample retained browser heap. Not server RSS or physical Android.",errors,samples};
page.on("pageerror",error=>errors.push(error.message));
try{
  await page.goto(assignment.joinUrl);await page.getByLabel("ชื่อเล่น",{exact:true}).fill("Soak QA");await page.getByRole("button",{name:"สร้างห้อง",exact:true}).click();await page.getByRole("button",{name:"พร้อมเล่น",exact:true}).click();await page.getByRole("button",{name:"เริ่มเกม",exact:true}).click();await page.locator("canvas").waitFor();
  await page.evaluate(()=>{setInterval(()=>{
    const dialog=document.querySelector('[role="dialog"]'),buttons=[...document.querySelectorAll<HTMLButtonElement>("button")];
    if(dialog){dialog.querySelector<HTMLButtonElement>(".mt-5.grid button:not(:disabled)")?.click();return;}
    buttons.find(button=>!button.disabled&&/^(Roll dice|Buy with quiz|Upgrade with quiz|Pass)$/.test(button.textContent?.trim()??""))?.click();
  },600);});
  const cdp=await page.context().newCDPSession(page);await cdp.send("Performance.enable");await cdp.send("HeapProfiler.enable");
  const started=Date.now();
  do{
    await cdp.send("HeapProfiler.collectGarbage");
    const metrics=await cdp.send("Performance.getMetrics"),dom=await cdp.send("Memory.getDOMCounters");
    samples.push({seconds:Math.round((Date.now()-started)/1000),heap:metrics.metrics.find(metric=>metric.name==="JSHeapUsedSize")!.value,nodes:dom.nodes,listeners:dom.jsEventListeners,documents:dom.documents,finished:Boolean(await page.getByRole("button",{name:"Play again",exact:true}).count())});
    await writeFile(`${directory}/result.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(samples.at(-1)));
    if(Date.now()-started>=minutes*60_000)break;
    await new Promise(resolve=>setTimeout(resolve,Math.min(60_000,minutes*60_000-(Date.now()-started))));
  }while(true);
  const baseline=samples.filter(sample=>sample.seconds>=Math.min(300,minutes*20)).slice(0,5),tail=samples.slice(-5);
  const peakBase=Math.max(...baseline.map(sample=>sample.heap)),peakTail=Math.max(...tail.map(sample=>sample.heap));
  assert.deepEqual(errors,[]);assert.ok(peakTail<=peakBase+32*1024*1024,"retained heap grew by >32 MiB after warmup");
  assert.ok(Math.max(...tail.map(sample=>sample.listeners))<=Math.max(...baseline.map(sample=>sample.listeners))+30,"listener growth >30");
  if(minutes>=60)assert.ok(samples.at(-1)!.finished,"40-minute game must finish during one-hour soak");
  report.passed=true;report.oneHourGate=minutes>=60;report.retainedHeapGrowthBytes=peakTail-peakBase;
  await page.screenshot({path:`${directory}/final.png`});
}catch(error){report.failure=String(error);process.exitCode=1;await page.screenshot({path:`${directory}/failure.png`}).catch(()=>{});}
finally{await browser.close();await writeFile(`${directory}/result.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({directory,passed:report.passed,oneHourGate:report.oneHourGate,failure:report.failure}));}
