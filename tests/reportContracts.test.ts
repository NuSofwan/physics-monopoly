import { it,expect } from "vitest";
import { csvCell,median,summarizeAttempts,type ReportSource } from "../server/src/teacher/reports";
it("computes even and odd medians without mutating evidence",()=>{
  const values=[12,2,4,6];expect(median(values)).toBe(5);expect(values).toEqual([12,2,4,6]);
  expect(median([8,1,4])).toBe(4);expect(median([])).toBeNull();expect(median([0])).toBe(0);
});
it.each(["=SUM(1,2)","+cmd","-1+2","@SUM(A1)"," \t=1","\tname"])("neutralizes CSV formula cells %s",(input)=>expect(csvCell(input)).toMatch(/^"'/));
it("escapes quotes and preserves Thai text",()=>expect(csvCell('สมชาย "ห้อง 2"')).toBe('"สมชาย ""ห้อง 2"""'));
it("subtracts paused time from response timing",()=>{
  const row:ReportSource={nickname:"QA",room_code:"ROOMAA",session_status:"game_over",objective:"แรง",evidence:{id:"a",questionSessionId:"r",questionId:"q",participantId:"p",repeated:false,hintUsed:false,reflection:false,openedAt:1000,firstAt:123000,firstPausedMs:120000,first:{choiceIndex:0},status:"completed",xp:0}};
  expect(summarizeAttempts([row])[0]?.medianResponseSeconds).toBe(2);
});
it("separates first/repeat, wrong/not-attempted/interrupted with denominators",()=>{
  const base:ReportSource={ nickname:"QA",room_code:"ABC234",session_status:"game_over",objective:"แรง",evidence:{id:"a",questionSessionId:"r",questionId:"q",participantId:"p",repeated:false,hintUsed:false,reflection:false,openedAt:1000,status:"completed",xp:0}};
  const rows=[{...base,evidence:{...base.evidence,first:{choiceIndex:0},firstCorrect:true,firstAt:3000}},{...base,evidence:{...base.evidence,id:"b",first:{choiceIndex:1},firstCorrect:false,retryCorrect:true}},{...base,evidence:{...base.evidence,id:"c",status:"not_attempted" as const}},{...base,evidence:{...base.evidence,id:"d",status:"interrupted" as const}},{...base,evidence:{...base.evidence,id:"e",repeated:true,first:{choiceIndex:0},firstCorrect:true}}];
  expect(summarizeAttempts(rows)[0]).toMatchObject({offered:4,answered:2,firstCorrect:1,retryCorrect:1,wrong:0,notAttempted:1,interrupted:1,repeated:1,firstAccuracy:.5});
});
