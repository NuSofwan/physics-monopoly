import { unlink } from "node:fs/promises";
import { pool } from "../db/database";
import { storagePath } from "./storage";
/** Durable, bounded cleanup of exact private filenames; no recursive directory deletion. */
export async function cleanDeletedFiles():Promise<void>{
  const rows=(await pool.query("SELECT document_id,suffix FROM private_file_deletions ORDER BY attempts,created_at LIMIT 20")).rows;
  for(const row of rows){
    try{
      await unlink(await storagePath(row.document_id,row.suffix)).catch(error=>{if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;});
      await pool.query("DELETE FROM private_file_deletions WHERE document_id=$1 AND suffix=$2",[row.document_id,row.suffix]);
    }catch{await pool.query("UPDATE private_file_deletions SET attempts=attempts+1 WHERE document_id=$1 AND suffix=$2",[row.document_id,row.suffix]);}
  }
}
