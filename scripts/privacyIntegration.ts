/** Deletes only the fresh synthetic fixture created by this invocation. */
import assert from "node:assert/strict";
import { readFile,stat,mkdir,writeFile } from "node:fs/promises";
import { pool } from "../server/src/db/database";
import { storagePath } from "../server/src/pdf/storage";
import { Client } from "@colyseus/sdk";
import { randomUUID } from "node:crypto";
import type { GameState } from "../shared/src/types";
const base="http://localhost:2567/api",origin="http://localhost:5174";
async function call(path:string,cookie="",body?:object,method=body?"POST":"GET") {return fetch(`${base}/${path}`,{method,headers:{Origin:origin,Cookie:cookie,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});}
async function login(teacher:string){const response=await call("auth/dev","",{teacher});assert.equal(response.status,200);return response.headers.get("set-cookie")!.split(";")[0]!;}
try {
  const a=await login("A"),b=await login("B");
  const set=await (await call("teacher/question-sets",a,{title:`Disposable privacy QA ${Date.now()}`,grade:2,topic:"QA"})).json();assert.ok(set.id);
  const form=new FormData();form.set("file",new Blob([await readFile("output/pdf/fixtures/thai-text.pdf")],{type:"application/pdf"}),"privacy-qa.pdf");
  const uploaded=await fetch(`${base}/teacher/imports/${set.id}`,{method:"POST",headers:{Origin:origin,Cookie:a},body:form});assert.equal(uploaded.status,202);
  const job=await uploaded.json();
  const cancelled=await call(`teacher/imports/jobs/${job.jobId}/cancel`,a,{});assert.ok([200,409].includes(cancelled.status));
  const file=await storagePath(job.documentId);assert.ok((await stat(file)).size>0);
  assert.equal((await call(`teacher/question-sets/${set.id}`,b,{confirmation:set.title},"DELETE")).status,404);
  assert.equal((await call(`teacher/question-sets/${set.id}`,a,{confirmation:"wrong"},"DELETE")).status,400);
  const classroom=await (await call("teacher/classrooms",a,{title:`Disposable privacy class ${Date.now()}`,grade:2,curriculumTrack:"พื้นฐาน",term:"QA",topic:"แรง",objectives:[]})).json();
  for(let i=0;i<10;i++){
    const draft=await (await call(`teacher/question-sets/${set.id}/questions`,a,{prompt:`Privacy QA ${i}: 1+2 N`,choices:["3 N","1 N"],answerIndex:0,explanation:"1+2=3 N",hint:"บวกแรง",objective:"แรง",topic:"mechanics",difficulty:"easy",timeLimitSec:30})).json();
    assert.equal((await call(`teacher/question-revisions/${draft.id}/approve`,a,{})).status,200);
  }
  const version=await (await call(`teacher/question-sets/${set.id}/publish`,a,{})).json();assert.ok(version.id);
  // The immutability trigger must still reject a direct DELETE outside the explicit owner purge.
  await assert.rejects(pool.query("DELETE FROM question_set_versions WHERE id=$1",[version.id]),/immutable/);
  const activity=await (await call("teacher/assignments",a,{title:"Disposable privacy activity",classroomId:classroom.id,versionId:version.id,durationMinutes:15})).json();
  assert.equal((await call(`teacher/question-sets/${set.id}`,a,{confirmation:set.title},"DELETE")).status,409,"referenced version must not be removed");
  const assignmentToken=new URL(activity.joinUrl).pathname.split("/").at(-1),name="Privacy Student";
  const ticket=await (await call("tickets/join","",{assignmentToken,name,avatar:"astro"})).json();
  const room=await new Client("ws://localhost:2567").create<GameState>("game",{assignmentToken,joinTicket:ticket.ticket,name,avatar:"astro"});
  let state:GameState|undefined;
  room.onMessage("snapshot",value=>{state=value;});
  for(const type of ["participantSession","tokenMove","answerResult","learningReceipt"])room.onMessage(type,()=>{});
  room.send("getParticipantSession");
  const waitFor=async(predicate:()=>boolean,timeout=20_000)=>{const until=Date.now()+timeout;while(!predicate()){assert.ok(Date.now()<until,"privacy session timeout");await new Promise(resolve=>setTimeout(resolve,100));}};
  try{
    await waitFor(()=>Boolean(state?.players.length));
    assert.equal((await call(`teacher/assignments/${activity.id}`,b,{confirmation:activity.title},"DELETE")).status,404);
    assert.equal((await call(`teacher/assignments/${activity.id}`,a,{confirmation:activity.title},"DELETE")).status,409,"live seat must not be deleted");
    room.send("ready",{requestId:randomUUID()});await waitFor(()=>Boolean(state?.players[0]?.ready));
    room.send("start",{requestId:randomUUID()});await waitFor(()=>state?.phase==="rolling");
    const sessions=await (await call(`teacher/assignments/${activity.id}/rooms`,a)).json();
    assert.equal((await call(`teacher/assignments/${activity.id}/rooms/${sessions[0].id}/control`,a,{command:"end"})).status,200);
    await waitFor(()=>state?.phase==="game_over");
  }finally{await room.leave();}
  const untilDisposed=Date.now()+80_000;
  let deleted:Response;
  do{deleted=await call(`teacher/assignments/${activity.id}`,a,{confirmation:activity.title},"DELETE");if(deleted.status===200)break;assert.equal(deleted.status,409);assert.ok(Date.now()<untilDisposed,"room disposal timeout");await new Promise(resolve=>setTimeout(resolve,1000));}while(true);
  for(const table of ["participants","game_sessions","join_tickets"])assert.equal((await pool.query(`SELECT 1 FROM ${table} WHERE assignment_id=$1`,[activity.id])).rowCount,0);
  assert.equal((await call(`teacher/question-sets/${set.id}`,a,{confirmation:set.title},"DELETE")).status,200);
  assert.equal((await pool.query("SELECT 1 FROM question_set_versions WHERE id=$1",[version.id])).rowCount,0);
  assert.equal((await call(`teacher/imports/documents/${job.documentId}/file`,a)).status,404);
  assert.equal((await pool.query("SELECT 1 FROM source_documents WHERE id=$1",[job.documentId])).rowCount,0);
  const until=Date.now()+30_000;
  while((await pool.query("SELECT 1 FROM private_file_deletions WHERE document_id=$1",[job.documentId])).rowCount){assert.ok(Date.now()<until,"worker cleanup timeout");await new Promise(resolve=>setTimeout(resolve,500));}
  await assert.rejects(stat(file),{code:"ENOENT"});
  await mkdir("docs/qa/privacy",{recursive:true});await writeFile("docs/qa/privacy/result.json",JSON.stringify({passed:true,deletedOnlyOwnSyntheticFixture:set.id,deletedOnlyOwnSyntheticActivity:activity.id,privateFileRemoved:true,acl:true,confirmationRequired:true,liveSeatProtected:true,publishedVersionPurge:true,immutabilityOutsidePurge:true},null,2));
  console.log("PASS teacher ACL + confirmation + metadata deletion + actual private-file worker cleanup; only this test's synthetic data removed");
}finally{await pool.end();}
