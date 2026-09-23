import { readFile,writeFile,stat,readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { locations,avatarPresets } from "../shared/src/index";
const sourcePaths=["client/src/game3d/CityKit.tsx","client/src/game3d/AvatarFigure.tsx","client/src/game3d/diceGeometry.ts","client/src/game3d/Board3D.tsx","shared/src/locations.ts","shared/src/avatars.ts","shared/src/appearance.ts","client/src/game3d/SurfaceTextures.ts"];
const canonicalSource=async(path:string)=>(await readFile(path,"utf8")).replace(/\r\n/g,"\n");
const sources=await Promise.all(sourcePaths.map(async path=>{const source=await canonicalSource(path);return {path,sha256:createHash("sha256").update(source).digest("hex"),bytes:Buffer.byteLength(source)};}));
const measured=JSON.parse(await readFile("assets/geometry-metrics.v1.json","utf8"));
for(const [path,hash] of Object.entries(measured.sources))assert.equal(createHash("sha256").update(await canonicalSource(path)).digest("hex"),hash,`Stale geometry measurements for ${path}: build and run test:assets:browser`);
const assets=[
  ...locations.map(city=>({id:`city:${city.id}`,path:sourcePaths[0],selector:city.id,kind:"city-kit",levels:[0,1,2,3],variants:2,clips:[],textures:["client/public/assets/textures/limestone-plaster.png",...(city.id==="bangkok"?["client/public/assets/textures/terracotta-roof.png"]:[]),"procedural:stone","procedural:roof","procedural:wood","procedural:terrain","procedural:water"],triangles:{environment:measured.triangles[`city:${city.id}`],buildings:[0,1,2,3].map(level=>[0,1].map(variant=>measured.triangles[`building:${city.id}:${level}:${variant}`]))},readiness:"review_required"})),
  ...avatarPresets.map(avatar=>({id:`avatar:${avatar.id}`,path:sourcePaths[1],selector:avatar.id,kind:"avatar",clips:["idle","walk","think","celebrate","wave"],textures:[],triangles:measured.triangles[`avatar:${avatar.id}`],readiness:"review_required"})),
  {id:"dice:pair",path:sourcePaths[2],selector:"diceOrientations",kind:"dice",clips:["roll"],textures:[],triangles:measured.triangles["dice:pair"],readiness:"review_required"},
];
const manifest={schemaVersion:1,toolchain:{three:"0.169",renderer:"React Three Fiber 8",format:"original editable procedural TSX (not GLB)"},license:"Project-owned source; see assets/LICENSES.md",units:{up:"Y",tilePitch:1.75,feetY:0},sources,assets,fallback:"client/src/game2d/AccessibleBoard.tsx",review:"Technical rendering verified separately from final artwork approval and physical-device performance"};
if(process.argv.includes("--check")){
  const saved=JSON.parse(await readFile("assets/procedural-manifest.v1.json","utf8"));
  assert.deepEqual(saved,manifest,"Procedural sources changed: regenerate/review manifest");
  for(const item of assets)await stat(item.path);
  await stat("client/public/assets/textures/limestone-plaster.png");
  await stat("client/public/assets/textures/terracotta-roof.png");
  await stat(manifest.fallback);
  const avatarSource=await readFile(sourcePaths[1]!,"utf8");for(const clip of ["idle","walk","think","celebrate","wave"])assert.ok(avatarSource.includes(`"${clip}"`));
  const bundles=(await readdir("client/dist/assets")).filter(name=>name.endsWith(".js"));
  for(const name of bundles){const text=await readFile(`client/dist/assets/${name}`,"utf8");assert.ok(!text.includes('"answerIndex":')&&!text.includes('"numericKey":'),`Private question bank leaked into ${name}`);}
  console.log(`PASS ${assets.length} procedural entries, source hashes/paths/clips, fallback and bundle key scan`);
}else{await writeFile("assets/procedural-manifest.v1.json",JSON.stringify(manifest,null,2)+"\n");console.log(`Generated ${assets.length} procedural entries (review_required, not art approval)`);}
