export interface AssetManifestItem {
  path: string;
  kind: string;
  frame?: [number, number];
  frames?: number;
  size?: [number, number];
}

export interface AssetManifest {
  version: number;
  basePath: string;
  items: Record<string, AssetManifestItem>;
}

export async function loadAssetManifest(): Promise<AssetManifest | null> {
  try {
    const response = await fetch("/assets/manifest.json");
    if (!response.ok) return null;
    return (await response.json()) as AssetManifest;
  } catch {
    return null;
  }
}
