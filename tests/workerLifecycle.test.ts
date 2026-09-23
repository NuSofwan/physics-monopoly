import { afterEach,expect,it,vi } from "vitest";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { supervise } from "../server/src/worker/supervise";
function child(){return Object.assign(new EventEmitter(),{kill:vi.fn(()=>true)}) as unknown as ChildProcess;}
afterEach(()=>vi.useRealTimers());
it("ignores a late cancellation query after the child has exited",async()=>{
  vi.useFakeTimers();const first=child(),second=child();let resolve!:(value:boolean)=>void;
  const result=supervise(first,()=>new Promise(done=>{resolve=done;}));await vi.advanceTimersByTimeAsync(500);
  first.emit("exit",0);expect(await result).toBe(0);
  const next=supervise(second,async()=>true);resolve(false);await Promise.resolve();await Promise.resolve();
  expect(first.kill).not.toHaveBeenCalled();expect(second.kill).not.toHaveBeenCalled();second.emit("exit",0);await next;
  expect(vi.getTimerCount()).toBe(0);
});
it("bounds concurrent polls and kills only the cancelled current child",async()=>{
  vi.useFakeTimers();const process=child();let resolve!:(value:boolean)=>void;
  const poll=vi.fn(()=>new Promise<boolean>(done=>{resolve=done;})),result=supervise(process,poll);
  await vi.advanceTimersByTimeAsync(2000);expect(poll).toHaveBeenCalledTimes(1);
  resolve(false);await Promise.resolve();expect(process.kill).toHaveBeenCalledTimes(1);
  process.emit("exit",null);expect(await result).toBeNull();expect(vi.getTimerCount()).toBe(0);
});
it("enforces timeout and releases listeners after a spawn error",async()=>{
  vi.useFakeTimers();const process=child(),result=supervise(process,async()=>true,800);
  await vi.advanceTimersByTimeAsync(800);expect(process.kill).toHaveBeenCalledTimes(1);
  process.emit("error",new Error("spawn failed"));expect(await result).toBe(1);
  expect(process.listenerCount("exit")).toBe(0);expect(vi.getTimerCount()).toBe(0);
});
