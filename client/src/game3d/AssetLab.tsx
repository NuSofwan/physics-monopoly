import { Canvas } from "@react-three/fiber";
import { useCallback, useState,useMemo } from "react";
import { locations, locationById, avatarPresets } from "@physics-monopoly/shared";
import { CameraControls,Board3D } from "./Board3D";
import { createInitialGameState,createPlayer,classroomBoard } from "@physics-monopoly/shared";
import { Character } from "./Character";
import { CityEnvironment, LocalBuilding } from "./CityKit";
import type { AvatarPose } from "./AvatarFigure";
import { AssetMetrics } from "./AssetMetrics";

/** Asset inspection is never presented as a live or purchased game state. */
export function AssetLab(): JSX.Element {
  const query = new URLSearchParams(window.location.search);
  const [map, setMap] = useState(locationById(query.get("map") ?? undefined).id);
  const [mode, setMode] = useState(query.get("mode") ?? "city");
  const [pose, setPose] = useState<AvatarPose>("idle");
  const [reset, setReset] = useState(0), [failed, setFailed] = useState(false);
  const fail = useCallback(() => setFailed(true), []);
  const budgetState=useMemo(()=>{
    const state=createInitialGameState("ASSETQ");state.mapId=map;state.classroomMode=true;state.phase="answering";state.dice=[6,6];
    state.players=["astro","engineer-wheelchair","scientist","girl"].map((avatar,index)=>{const player=createPlayer(`qa${index}`,`QA ${index+1}`,avatar);player.tileIndex=index*7;return player;});
    state.tiles=structuredClone(classroomBoard).map(tile=>tile.type==="property"?{...tile,ownerId:state.players[tile.index%4]!.id,level:3}:tile);return state;
  },[map]);
  return <main className="min-h-screen bg-slate-100 p-5 text-slate-900">
    <a href="/" className="underline">กลับเข้าเกม</a><h1 className="my-3 text-2xl font-bold">ห้องตรวจโมเดล 3 มิติ — รอตรวจรับภาพ</h1>
    <p>12 เมือง / อาคารระดับ 0–3 สองรูปทรงต่อระดับ / 24 ตัวละคร • เป็นตัวอย่าง asset ไม่ใช่เกมสด</p>
    <div className="my-3 flex flex-wrap gap-3"><label>สถานที่<select aria-label="สถานที่" className="ml-2 rounded border p-3" value={map} onChange={(event) => setMap(locationById(event.target.value).id)}>{locations.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label>
      <label>ชุดภาพ<select aria-label="ชุดภาพ" className="ml-2 rounded border p-3" value={mode} onChange={(event) => setMode(event.target.value)}><option value="city">เมืองและจุดเด่น</option><option value="buildings">อาคาร 0–3 × 2 รูปทรง</option><option value="avatars">ตัวละคร 24 แบบ</option><option value="board">ตรวจงบฉาก: 4 ตัวละคร + อาคารเต็ม</option></select></label>
      {mode === "avatars" ? <label>ท่าทาง<select aria-label="ท่าทาง" className="ml-2 rounded border p-3" value={pose} onChange={(event) => setPose(event.target.value as AvatarPose)}>{(["idle","walk","think","celebrate","wave"] as const).map((value) => <option key={value}>{value}</option>)}</select></label> : null}
      <button className="rounded bg-white p-3" onClick={() => setReset((value) => value + 1)}>รีเซ็ตกล้อง</button>
    </div>
    <p>คุณภาพต่ำ: geometry สร้างในเครื่อง ไม่ดาวน์โหลด GLB แยก · ตัว renderer ประมาณ 235 KB gzip รวมทุกเมือง (ขนาด build จริงให้ดูรายงาน)</p>
    {mode === "board" ? <Board3D state={budgetState} moveEvent={null} reducedMotion quality="low" onUnavailable={fail} measureAssets/> : failed ? <p role="alert">WebGL ไม่พร้อมใช้งาน ใช้กระดานข้อความในเกมได้</p> : <div className="h-[68vh] min-h-[450px]" aria-label="ตัวอย่างโมเดลสามมิติ"><Canvas camera={{ position: [0,17,18], fov:42 }} dpr={1}>
      <AssetMetrics/>
      <CameraControls reset={reset} onUnavailable={fail} /><color attach="background" args={[locationById(map).sky]} /><ambientLight intensity={1.3} /><directionalLight position={[5,12,8]} intensity={1.7} />
      {mode === "city" ? <group name={`asset:city:${map}`}><CityEnvironment mapId={map} /></group> : <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.1,0]}><planeGeometry args={[22,18]} /><meshStandardMaterial color="#a8b7a7" /></mesh>}
      {mode === "buildings" ? [0,1,2,3].flatMap((level) => [0,1].map((variant) => <group name={`asset:building:${map}:${level}:${variant}`} key={level+":"+variant} position={[-6+level*4,0,-2.5+variant*5]} scale={1.8}><LocalBuilding mapId={map} level={level} variant={variant} owned /></group>)) : null}
      {mode === "avatars" ? avatarPresets.map((preset,index) => <group name={`asset:avatar:${preset.id}`} key={preset.id} position={[-6.25+(index%6)*2.5,0,-4.5+Math.floor(index/6)*3]} scale={1.6}><Character avatar={preset.id} color={["#dcac4d","#629cac","#bb7194","#7c9e60"][index%4]!} pose={pose} /></group>) : null}
    </Canvas></div>}
    <p className="mt-3">ลากเพื่อหมุน · เลื่อนเพื่อซูม · {mode === "buildings" ? "คอลัมน์ซ้ายไปขวา: ที่ดิน, ระดับ 1, 2, 3 / แถว: รูปทรง A และ B" : mode === "avatars" ? "เรียงซ้ายไปขวา แถวละ 6 ตามรายการด้านล่าง" : locationById(map).landmark}</p>
    {mode === "avatars" ? <ol className="mt-3 grid list-inside list-decimal gap-2 sm:grid-cols-6">{avatarPresets.map((preset) => <li key={preset.id}>{preset.label}</li>)}</ol> : null}
    <p className="mt-3 text-sm">โมเดล procedural สร้างโดยโครงการเอง อ้างอิงบรรยากาศสถานที่ ไม่ใช่สำเนาทางสถาปัตยกรรมหรือแบบจำลองฟิสิกส์เชิงปริมาณ</p>
  </main>;
}
