import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
export const privateRoot = resolve(process.env.PRIVATE_STORAGE_PATH ?? fileURLToPath(new URL("../../../.local/uploads", import.meta.url)));
export async function storagePath(documentId: string, suffix = ".pdf"): Promise<string> {
  if (!/^[a-f0-9-]{36}$/.test(documentId) || !/^(\.pdf|\.png|-[1-9][0-9]?\.png)$/.test(suffix)) throw new Error("Invalid private storage key");
  await mkdir(privateRoot, { recursive: true });
  return resolve(privateRoot, documentId + suffix);
}
