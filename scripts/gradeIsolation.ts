import { Client,type Room } from "@colyseus/sdk";
import { randomUUID } from "node:crypto";
import { readFile,mkdir,writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import type { GameState } from "../shared/src/types";
const api="http://localhost:2567/api",origin="http://localhost:5174";
async function call(path:string,cookie="",body?:object){return fetch(`${api}/${path}`,{method:body?"POST":"GET",headers:{Origin:origin,Cookie:cookie,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});}
async function login(teacher:string){const result=await call("auth/dev","",{teacher});assert.equal(result.status,200);return result.headers.get("set-cookie")!.split(";")[0]!;}
const a=await login("A"),b=await login("B"),suffix=Date.now();
async function post(path:string,body:object){const response=await call(`teacher/${path}`,a,body);assert.ok(response.ok,`${path}: ${response.status}`);return response.json();}
const activities:any[]=[],connections:Room[]=[],states=new Map<number,GameState>(),checks:object[]=[];
async function until(check:()=>boolean){const deadline=Date.now()+60_000;while(!check()){assert.ok(Date.now()<deadline,"grade QA timeout");await new Promise(resolve=>setTimeout(resolve,100));}}
try{
  const boundary=JSON.parse(await readFile("docs/qa/pdf-boundaries/result.json","utf8"));
  for(const grade of [2,4,5]){
    const topic=grade===2?"แรงลัพธ์":grade===4?"ไฟฟ้า":"คลื่น";
    const classroom=await post("classrooms",{title:`QA M${grade} ${suffix}`,grade,curriculumTrack:grade===2?"พื้นฐาน":"เพิ่มเติม",term:"QA",topic,objectives:[topic]});
    let versionId=boundary.checks.find((item:any)=>item.versionId)?.versionId;
    if(grade!==2){
      const set=await post("question-sets",{title:`QA M${grade} ${suffix}`,grade,topic});
      for(let i=0;i<10;i++){
        const question=await post(`question-sets/${set.id}/questions`,{prompt:grade===4?`QA ม.4 ข้อ ${i+1}: ตัวต้านทาน 3 Ω ต่อความต่างศักย์ 6 V มีกระแสเท่าไร`:`QA ม.5 ข้อ ${i+1}: คลื่นความถี่ 2 Hz มีคาบเท่าไร`,choices:grade===4?["2 A","3 A","6 A"]:["0.5 s","2 s","4 s"],answerIndex:0,explanation:grade===4?"I = V/R = 6/3 = 2 A":"T = 1/f = 1/2 = 0.5 s",hint:grade===4?"ใช้กฎของโอห์ม":"คาบเป็นส่วนกลับของความถี่",objective:topic,topic:grade===4?"electricity":"waves",difficulty:"easy",timeLimitSec:30});
        await post(`question-revisions/${question.id}/approve`,{});
      }
      versionId=(await post(`question-sets/${set.id}/publish`,{})).id;
    }
    const activity=await post("assignments",{title:`QA activity M${grade} ${suffix}`,classroomId:classroom.id,versionId,durationMinutes:15});activities.push({...activity,grade});
    const token=new URL(activity.joinUrl).pathname.split("/").at(-1),name=`Grade ${grade} Student`;
    const ticket=await(await call("tickets/join","",{assignmentToken:token,name,avatar:"astro"})).json();
    const room=await new Client("ws://localhost:2567").create<GameState>("game",{assignmentToken:token,joinTicket:ticket.ticket,name,avatar:"astro"});connections.push(room);room.reconnection.enabled=false;
    room.onMessage("snapshot",state=>states.set(grade,state));for(const message of ["participantSession","tokenMove","answerResult","learningReceipt"])room.onMessage(message,()=>{});room.send("getParticipantSession");
    await until(()=>Boolean(states.get(grade)?.players.length));room.send("ready",{requestId:randomUUID()});await until(()=>Boolean(states.get(grade)?.players[0]?.ready));room.send("start",{requestId:randomUUID()});await until(()=>states.get(grade)?.phase==="rolling");room.send("roll",{requestId:randomUUID()});
    await until(()=>["buying","answering"].includes(states.get(grade)?.phase??""));if(states.get(grade)?.phase==="buying")room.send("buy",{requestId:randomUUID()});await until(()=>states.get(grade)?.phase==="answering");
    const state=states.get(grade)!;assert.equal(state.players.length,1);assert.match(state.pendingQuestion!.question.prompt,grade===2?/แรง 1 N/:new RegExp(`QA ม.${grade}`));assert.ok(!JSON.stringify(state).includes("answerIndex"));
    room.send("answer",{requestId:randomUUID(),questionId:state.pendingQuestion!.id,choiceIndex:0});await until(()=>states.get(grade)?.phase==="reveal");
    const report=await(await call(`teacher/assignments/${activity.id}/report`,a)).json();assert.equal(report.summary.length,1);assert.equal(report.summary[0].nickname,name);assert.equal(report.summary[0].firstCorrect,1);assert.equal(report.summary[0].objective,topic);
    assert.equal((await call(`teacher/assignments/${activity.id}/report`,b)).status,404);
    for(const previous of activities.filter(item=>item.id!==activity.id)){const otherToken=new URL(previous.joinUrl).pathname.split("/").at(-1);assert.equal((await call(`rooms/${state.roomCode}?assignmentToken=${otherToken}`)).status,404);}
    checks.push({grade,activityId:activity.id,versionId,roomCode:state.roomCode,oneOwnObjectiveRow:true});
  }
  await mkdir("docs/qa/grade-isolation",{recursive:true});await writeFile("docs/qa/grade-isolation/result.json",JSON.stringify({passed:true,checks,m2Source:"Real six-page PDF with 30 reviewed questions",note:"Synthetic questions and students, not a curriculum endorsement"},null,2));console.log("PASS M2 PDF30 + M4/M5 live activities, grade-scoped questions/reports/room lookup and teacher ACL");
}finally{
  for(const activity of activities){const rooms=await(await call(`teacher/assignments/${activity.id}/rooms`,a)).json();for(const room of rooms)await post(`assignments/${activity.id}/rooms/${room.id}/control`,{command:"end"});}
  await Promise.all(connections.map(room=>room.leave().catch(()=>{})));
}
