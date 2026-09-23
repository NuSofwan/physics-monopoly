import { Router } from "express";
import { matchMaker } from "@colyseus/core";
import { pool,transaction } from "../db/database";
import { HttpError,route,uuid } from "./http";
export const privacyRouter=Router();
privacyRouter.get("/privacy",route(async(_req,res)=>{
  const due=(await pool.query("SELECT id,title,created_at + retention_days * interval '1 day' review_after FROM assignments WHERE owner_id=$1 ORDER BY created_at",[res.locals.teacher.id])).rows;
  res.json({defaultRetentionDays:180,mode:"owner-confirmed deletion",backupRetentionDays:30,notice:"180 วันเป็นค่าเริ่มต้นผลิตภัณฑ์ ไม่ใช่ข้อกำหนดกฎหมาย การลบต้องยืนยันโดยครู; ผู้ดูแลต้องจัดการสำเนาสำรองให้หมดอายุภายใน 30 วัน",activities:due});
}));
privacyRouter.delete("/assignments/:id",route(async(req,res)=>{
  const id=uuid(req.params.id);
  const confirmation=typeof req.body?.confirmation==="string"?req.body.confirmation:"";
  await transaction(async db=>{
    const owned=(await db.query("SELECT title FROM assignments WHERE id=$1 AND owner_id=$2 FOR UPDATE",[id,res.locals.teacher.id])).rows[0];
    if(!owned)throw new HttpError(404,"ไม่พบกิจกรรม");
    if(confirmation!==owned.title)throw new HttpError(400,"ยืนยันชื่อกิจกรรมก่อนลบ");
    const sessions=(await db.query("SELECT live_room_id,status FROM game_sessions WHERE assignment_id=$1",[id])).rows;
    const live=new Set((await matchMaker.query({name:"game"})).map(room=>room.roomId));
    if(sessions.some(room=>live.has(room.live_room_id)||!["game_over","abandoned","interrupted"].includes(room.status)))throw new HttpError(409,"ยุติเกมและให้ทุกคนออกจากห้องก่อนลบ");
    await db.query("DELETE FROM join_tickets WHERE assignment_id=$1",[id]);
    for(const table of ["learning_attempts","question_sessions","game_events"])await db.query(`DELETE FROM ${table} WHERE session_id IN (SELECT id FROM game_sessions WHERE assignment_id=$1)`,[id]);
    await db.query("DELETE FROM game_sessions WHERE assignment_id=$1",[id]);
    await db.query("DELETE FROM participants WHERE assignment_id=$1",[id]);
    await db.query("DELETE FROM assignments WHERE id=$1",[id]);
  });
  res.json({deleted:true,notice:"ลบชื่อเล่น ตั๋วเข้าเกม คำตอบ รายงาน เหตุการณ์ และ snapshot แล้ว ชุดโจทย์/PDF ที่ใช้ร่วมกันยังอยู่ ลบได้แยกจากคลังโจทย์"});
}));
privacyRouter.delete("/question-sets/:id",route(async(req,res)=>{
  const id=uuid(req.params.id);
  const confirmation=typeof req.body?.confirmation==="string"?req.body.confirmation:"";
  await transaction(async db=>{
    const owned=(await db.query("SELECT title FROM question_sets WHERE id=$1 AND owner_id=$2 FOR UPDATE",[id,res.locals.teacher.id])).rows[0];
    if(!owned)throw new HttpError(404,"ไม่พบชุดโจทย์");
    if(confirmation!==owned.title)throw new HttpError(400,"ยืนยันชื่อชุดโจทย์ก่อนลบ");
    if((await db.query("SELECT 1 FROM assignments a JOIN question_set_versions v ON v.id=a.version_id WHERE v.set_id=$1",[id])).rowCount)throw new HttpError(409,"ลบกิจกรรมที่อ้างอิงชุดนี้ก่อน");
    if((await db.query("SELECT j.id FROM import_jobs j JOIN source_documents d ON d.id=j.document_id WHERE d.set_id=$1 AND j.status IN ('queued','running') FOR UPDATE OF j",[id])).rowCount)throw new HttpError(409,"ยกเลิกงานนำเข้าที่ยังทำงานก่อนลบ");
    await db.query("INSERT INTO private_file_deletions(document_id,suffix) SELECT id,'.pdf' FROM source_documents WHERE set_id=$1 ON CONFLICT DO NOTHING",[id]);
    // Include bounded partial render output from failed/cancelled jobs, not only committed pages.
    await db.query("INSERT INTO private_file_deletions(document_id,suffix) SELECT d.id,'-'||page||'.png' FROM source_documents d CROSS JOIN generate_series(1,80) page WHERE d.set_id=$1 ON CONFLICT DO NOTHING",[id]);
    await db.query("INSERT INTO private_file_deletions(document_id,suffix) SELECT m.id,'.png' FROM question_media m JOIN source_documents d ON d.id=m.document_id WHERE d.set_id=$1 ON CONFLICT DO NOTHING",[id]);
    await db.query("DELETE FROM question_media WHERE document_id IN (SELECT id FROM source_documents WHERE set_id=$1)",[id]);
    await db.query("DELETE FROM source_pages WHERE document_id IN (SELECT id FROM source_documents WHERE set_id=$1)",[id]);
    await db.query("DELETE FROM import_jobs WHERE document_id IN (SELECT id FROM source_documents WHERE set_id=$1)",[id]);
    await db.query("DELETE FROM source_documents WHERE set_id=$1",[id]);
    await db.query("SELECT set_config('physics.purge_set',$1,true)",[id]);
    await db.query("DELETE FROM question_set_versions WHERE set_id=$1",[id]);
    await db.query("DELETE FROM question_revisions WHERE set_id=$1",[id]);
    await db.query("DELETE FROM question_sets WHERE id=$1",[id]);
  });
  res.json({deleted:true,notice:"ลบโจทย์ทุกรุ่นและ metadata แล้ว ไฟล์ต้นฉบับ/ภาพถูกส่งเข้าคิวลบถาวรของ worker สำเนาสำรองยังอยู่ตามอายุที่ผู้ดูแลกำหนด"});
}));
