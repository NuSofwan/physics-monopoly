import "../server/src/config";
const endpoint=`http://127.0.0.1:${Number(process.env.PORT??2567)}/ready`;
const deadline=Date.now()+60_000;
while(true){
  try{
    const response=await fetch(endpoint,{signal:AbortSignal.timeout(2000)});
    if(response.ok){const status=await response.json();if(!status.database)throw new Error("missing_database");break;}
  }catch(error){if(error instanceof Error&&error.message==="missing_database")throw new Error("เตรียมฐานข้อมูลก่อน: npm run setup:local แล้วเปิด npm run dev:db ใน terminal แยก");}
  if(Date.now()>deadline)throw new Error("API/ฐานข้อมูลยังไม่พร้อมใน 60 วินาที ตรวจ npm run dev:db และ log server");
  await new Promise(resolve=>setTimeout(resolve,500));
}
await import("../server/src/worker/index");
