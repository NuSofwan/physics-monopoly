/**
 * Offset between this device's clock and the game server's. Deadlines in snapshots are server timestamps,
 * so countdowns must use server time: a tablet whose clock runs fast must still be able to answer.
 */
let offset = 0;

export function syncServerClock(serverNow: number | undefined): void {
  if (typeof serverNow === "number" && Number.isFinite(serverNow)) offset = serverNow - Date.now();
}

/** Current time on the server's clock (ms). */
export function serverNow(): number {
  return Date.now() + offset;
}
