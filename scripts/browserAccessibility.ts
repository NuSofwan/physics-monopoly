import { chromium, type Page } from "playwright";
import { mkdir,readFile,writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const directory=`docs/qa/accessibility-${Date.now()}`,origin="http://localhost:5174",api="http://localhost:2567/api";
await mkdir(directory,{recursive:true});
const browser=await chromium.launch({channel:"msedge",headless:true});
const errors:string[]=[],checks:object[]=[];
const teacher=await browser.newContext({viewport:{width:1440,height:1000}});
async function post(path:string,body:object){const result=await teacher.request.post(`${api}/${path}`,{headers:{Origin:origin},data:body});assert.ok(result.ok(),`${path}: ${result.status()}`);return result.json();}
async function fit(page:Page,label:string){const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll<HTMLElement>("button,input,select,[role='dialog']")].filter(el=>el.getClientRects().length).filter(el=>{const r=el.getBoundingClientRect();return r.left < -1 || r.right > innerWidth+1;}).map(el=>el.textContent?.trim().slice(0,70))}));assert.ok(dimensions.scroll<=dimensions.width+1,`${label}: document overflows`);assert.deepEqual(dimensions.overflow,[],`${label}: clipped controls`);checks.push({label,...dimensions});}
let assignmentId="";
try{
  await post("auth/dev",{teacher:"A"});
  const evidence=JSON.parse(await readFile("docs/qa/pdf/result.json","utf8"));
  const classroom=await post("teacher/classrooms",{title:`Responsive QA ${Date.now()}`,grade:2,curriculumTrack:"พื้นฐาน",term:"QA",topic:"แรง",objectives:[]});
  const assignment=await post("teacher/assignments",{title:`Responsive QA ${Date.now()}`,classroomId:classroom.id,versionId:evidence.versionId,durationMinutes:15,maps:["bangkok","tokyo","venice"]});assignmentId=assignment.id;
  const pages:Page[]=[];let roomCode="";
  for(const [index,viewport] of [{width:390,height:844},{width:1024,height:768},{width:1440,height:1000}].entries()){
    const context=await browser.newContext({viewport,reducedMotion:"reduce"}),page=await context.newPage();pages.push(page);page.on("pageerror",error=>errors.push(error.message));
    await page.goto(assignment.joinUrl);await page.getByLabel("ชื่อเล่น",{exact:true}).fill(`Responsive ${index+1}`);
    if(index===0){
      await page.getByRole("button",{name:"engineer-wheelchair",exact:true}).click();
      await page.getByText("ปรับแต่งและดูตัวอย่าง 3 มิติ (ไม่เปลี่ยนความสามารถ)",{exact:true}).click();
      await page.getByLabel("สีเสื้อ",{exact:true}).selectOption({index:2});await page.getByLabel("ทรงผม",{exact:true}).selectOption("curly");
      await page.locator("canvas").waitFor();await fit(page,"mobile cosmetics");
      await page.screenshot({path:`${directory}/mobile-cosmetics.png`,fullPage:true});
      await page.getByText("ปรับแต่งและดูตัวอย่าง 3 มิติ (ไม่เปลี่ยนความสามารถ)",{exact:true}).click();
      await page.getByRole("button",{name:"สร้างห้อง",exact:true}).click();
      await page.getByText("Room code",{exact:true}).waitFor();roomCode=(await page.getByText("Room code",{exact:true}).locator("..").locator("button").first().innerText()).trim();
      await page.getByRole("combobox",{name:"สถานที่",exact:true}).selectOption("venice");
    }else{await page.getByLabel("รหัสห้อง",{exact:true}).fill(roomCode);await page.getByRole("button",{name:"เข้าห้อง",exact:true}).click();}
    await page.getByRole("button",{name:"พร้อมเล่น",exact:true}).click();await fit(page,`lobby ${viewport.width}`);
  }
  const mobile=pages[0]!;await mobile.getByRole("button",{name:"เริ่มเกม",exact:true}).click();
  await mobile.locator("canvas").waitFor();
  await mobile.getByLabel("ขนาดข้อความ",{exact:true}).selectOption("150");
  await mobile.getByLabel("กระดาน",{exact:true}).selectOption("html");await fit(mobile,"mobile 150% HTML board");
  await mobile.screenshot({path:`${directory}/mobile-150-html.png`,fullPage:true});
  await mobile.getByLabel("กระดาน",{exact:true}).selectOption("3d");await mobile.locator("canvas").waitFor();
  await mobile.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.triangles)>0);
  const lost=await mobile.locator("canvas").evaluate(canvas=>{const gl=canvas.getContext("webgl2"),extension=gl?.getExtension("WEBGL_lose_context");extension?.loseContext();return Boolean(extension);});
  assert.ok(lost,"actual WebGL loss extension available");await mobile.waitForFunction(()=>document.querySelector<HTMLSelectElement>('select[aria-label="กระดาน"]')?.value==="html");
  checks.push({webglContextLossFallback:true});
  await mobile.getByLabel("ขนาดข้อความ",{exact:true}).selectOption("100");
  for(const [index,page] of pages.entries()){await fit(page,`playing ${index}`);await page.screenshot({path:`${directory}/playing-${index}.png`,fullPage:true});}
  const until=Date.now()+90_000;
  while(!await mobile.getByRole("dialog").count()){
    assert.ok(Date.now()<until);for(const name of ["Roll dice","Pass"]){const button=mobile.getByRole("button",{name,exact:true});if(await button.count()&&await button.isEnabled())await button.click();}await mobile.waitForTimeout(250);
  }
  const dialog=mobile.getByRole("dialog");await dialog.locator(".mt-5.grid button").first().waitFor();
  for(let n=0;n<12;n++){await mobile.keyboard.press(n%3?"Tab":"Shift+Tab");assert.ok(await dialog.evaluate(root=>root.contains(document.activeElement)),"question keyboard containment");}
  await fit(mobile,"mobile question");await mobile.screenshot({path:`${directory}/mobile-question.png`});
  for(const page of pages)await page.getByRole("dialog").locator(".mt-5.grid button").first().click();
  await dialog.getByText(/ตอบถูก · เงิน/).waitFor();
  const rooms=await (await teacher.request.get(`${api}/teacher/assignments/${assignment.id}/rooms`)).json();
  await post(`teacher/assignments/${assignment.id}/rooms/${rooms[0].id}/control`,{command:"end"});
  await mobile.getByRole("heading",{name:/นักพัฒนาเมือง:/}).waitFor();
  await mobile.getByText("ผลการเรียนรู้ส่วนตัว",{exact:true}).waitFor();
  for(let n=0;n<8;n++){await mobile.keyboard.press(n%2?"Tab":"Shift+Tab");assert.ok(await mobile.getByRole("dialog").evaluate(root=>root.contains(document.activeElement)),"results keyboard containment");}
  await fit(mobile,"mobile results");
  await mobile.setViewportSize({width:320,height:640});await fit(mobile,"320px results");await mobile.screenshot({path:`${directory}/results-320.png`});
  const teacherPage=await teacher.newPage();teacherPage.on("pageerror",error=>errors.push(error.message));await teacherPage.goto(`${origin}/teacher`);
  const activityRow=teacherPage.locator("article").filter({has:teacherPage.getByText(`${assignment.title} · open`,{exact:true})});
  await activityRow.getByRole("button",{name:"ดูห้อง / ควบคุม",exact:true}).click();
  await activityRow.getByRole("heading",{name:"รายงานทักษะจากคำตอบจริง",exact:true}).waitFor();
  const downloadEvent=teacherPage.waitForEvent("download");await activityRow.getByRole("link",{name:"ดาวน์โหลด CSV ภาษาไทย",exact:true}).click();const download=await downloadEvent;
  await download.saveAs(`${directory}/teacher-report.csv`);const csv=await readFile(`${directory}/teacher-report.csv`,"utf8");
  assert.match(csv,/Responsive 1/);assert.match(csv,/firstCorrect/);assert.ok(csv.charCodeAt(0)===0xfeff);assert.deepEqual(errors,[]);
  await teacherPage.screenshot({path:`${directory}/teacher-report.png`,fullPage:true});
  await writeFile(`${directory}/result.json`,JSON.stringify({passed:true,assignmentId,checks,errors,keyboard:true,actualCsvDownload:true,note:"Emulated viewports and DOM keyboard checks, not physical-device or screen-reader certification"},null,2));console.log("PASS responsive, cosmetics, keyboard dialogs and real teacher CSV",directory);
}catch(error){await writeFile(`${directory}/result.json`,JSON.stringify({passed:false,assignmentId,checks,errors,failure:String(error)},null,2));throw error;}finally{await browser.close();}
