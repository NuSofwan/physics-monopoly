/** Bounded, fail-closed replay protection. Never evict IDs in a live game. */
export class RequestGate {
  private readonly seen = new Map<string, Set<string>>();
  private readonly windows = new Map<string, { start: number; count: number }>();
  serialize(): { seen: Array<[string, string[]]>; windows: Array<[string, { start: number; count: number }]> } {
    return { seen: [...this.seen].map(([id, requests]) => [id, [...requests]]), windows: [...this.windows] };
  }
  restore(value: Array<[string, string[]]> | { seen: Array<[string, string[]]>; windows?: Array<[string, { start: number; count: number }]> }): void {
    this.seen.clear(); this.windows.clear();
    // Older persisted shapes are a bare seen-ledger array (no burst window); accept both for compatibility.
    const seen = Array.isArray(value) ? value : value.seen;
    const windows = Array.isArray(value) ? [] : (value.windows ?? []);
    if (!Array.isArray(seen) || seen.length > 4) throw new Error("Invalid request ledger");
    for (const [id, requests] of seen) {
      if (typeof id !== "string" || !Array.isArray(requests) || requests.length > 10000 || requests.some((request) => typeof request !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(request))) throw new Error("Invalid request ledger");
      this.seen.set(id, new Set(requests));
    }
    if (!Array.isArray(windows) || windows.length > 4) throw new Error("Invalid request ledger");
    for (const [id, window] of windows) {
      if (
        typeof id !== "string" ||
        typeof window !== "object" ||
        window === null ||
        typeof window.start !== "number" ||
        !Number.isFinite(window.start) ||
        typeof window.count !== "number" ||
        !Number.isFinite(window.count) ||
        window.count < 0 ||
        window.count > 1000
      ) {
        throw new Error("Invalid request ledger");
      }
      this.windows.set(id, { start: window.start, count: window.count });
    }
  }

  accept(participantId: string, requestId: unknown, now = Date.now()): boolean {
    if (typeof requestId !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(requestId)) return false;
    const ids = this.seen.get(participantId) ?? new Set<string>();
    if (ids.has(requestId) || ids.size >= 10000) return false;
    const previous = this.windows.get(participantId);
    const window = previous && now - previous.start < 10000 ? previous : { start: now, count: 0 };
    this.windows.set(participantId, window);
    if (window.count >= 60) return false;
    window.count++;
    ids.add(requestId);
    this.seen.set(participantId, ids);
    return true;
  }
}
