import assert from "node:assert/strict";
import { readFile,mkdir,writeFile } from "node:fs/promises";
const origin="http://localhost:5174",api="http://localhost:2567/api";
const login=await fetch(`${api}/auth/dev`,{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({teacher:"A"})});assert.ok(login.ok);const cookie=login.headers.get("set-cookie")!.split(";")[0]!;
async function call(path:string,body?:object,method=body?"POST":"GET"){return fetch(`${api}/teacher/${path}`,{method,headers:{Origin:origin,Cookie:cookie,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});}
const set=await (await call("question-sets",{title:`PDF boundary QA ${Date.now()}`,grade:2,topic:"แรงลัพธ์"})).json();assert.ok(set.id);
const checks:object[]=[];
for(const filename of ["password-protected.pdf","malformed.pdf","thai-30.pdf"]){
  const data=filename==="malformed.pdf"?Buffer.from("%PDF-1.7\n1 0 obj\n<<broken\n%%EOF"):await readFile(`output/pdf/fixtures/${filename}`);
  const form=new FormData();form.set("file",new Blob([data],{type:"application/pdf"}),filename);
  const response=await fetch(`${api}/teacher/imports/${set.id}`,{method:"POST",headers:{Origin:origin,Cookie:cookie},body:form});assert.equal(response.status,202);const created=await response.json();
  const started=Date.now();let job:any;
  do{await new Promise(resolve=>setTimeout(resolve,500));job=await(await call(`imports/jobs/${created.jobId}`)).json();assert.ok(Date.now()-started<190_000,"PDF timeout");}while(["queued","running"].includes(job.status));
  if(filename!=="thai-30.pdf"){assert.equal(job.status,"failed");assert.ok(job.error);assert.equal(job.pages.length,0);}else{
    assert.equal(job.status,"review");assert.equal(job.page_count,6);
    const detail=await(await call(`question-sets/${set.id}`)).json();assert.equal(detail.questions.length,30);
    for(const question of detail.questions){assert.equal(question.approved_at,null);assert.ok(question.provenance.page>=1&&question.provenance.page<=6);
      assert.equal((await call(`question-revisions/${question.id}`,{...question.body,...question.answer_key,hint:"แรงทิศเดียวกันนำขนาดมาบวกกัน"},"PATCH")).status,200);
      assert.equal((await call(`question-revisions/${question.id}/approve`,{})).status,200);
    }
    const published=await call(`question-sets/${set.id}/publish`,{});assert.equal(published.status,201);const version=await published.json();checks.push({versionId:version.id,approvedQuestions:30});
  }
  checks.push({filename,status:job.status,pages:job.page_count??0,milliseconds:Date.now()-started});
}
await mkdir("docs/qa/pdf-boundaries",{recursive:true});await writeFile("docs/qa/pdf-boundaries/result.json",JSON.stringify({passed:true,setId:set.id,checks},null,2));console.log("PASS encrypted/malformed failures followed by real six-page 30-question review and publish");
