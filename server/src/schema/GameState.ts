export interface SnapshotEnvelope<T> {
  type: "snapshot";
  state: T;
}
