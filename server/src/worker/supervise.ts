import type { ChildProcess } from "node:child_process";

/** Bind every delayed callback to this child, never to a mutable "active job". */
export function supervise(child: ChildProcess, stillCurrent: () => Promise<boolean>, timeoutMs = 180_000): Promise<number | null> {
  return new Promise(resolve => {
    let settled = false, checking = false;
    const stop = () => { if (!settled) child.kill(); };
    const timeout = setTimeout(stop, timeoutMs);
    const cancellation = setInterval(() => {
      if (checking || settled) return;
      checking = true;
      void stillCurrent().then(current => { if (!current) stop(); }).catch(stop).finally(() => { checking = false; });
    }, 500);
    const finish = (code: number | null) => {
      if (settled) return;
      settled = true; clearTimeout(timeout); clearInterval(cancellation);
      child.off("exit", finish); child.off("error", fail); resolve(code);
    };
    const fail = () => finish(1);
    child.once("exit", finish); child.once("error", fail);
  });
}
