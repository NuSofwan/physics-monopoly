import { Canvas,useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Appearance } from "@physics-monopoly/shared";
import { AvatarFigure } from "./AvatarFigure";
function Controls():null {
  const {camera,gl}=useThree();
  useEffect(()=>{const controls=new OrbitControls(camera,gl.domElement);controls.target.set(0,.6,0);controls.enablePan=false;controls.minDistance=1.5;controls.maxDistance=5;controls.update();return()=>controls.dispose();},[camera,gl]);
  return null;
}
export function AvatarPreview({avatar,appearance}:{avatar:string;appearance:Appearance}):JSX.Element {
  return <div className="h-64 rounded bg-slate-100" aria-label="ตัวอย่างตัวละครสามมิติ ลากเพื่อหมุน"><Canvas camera={{position:[0,1.1,2.5],fov:40}} dpr={1} fallback={<p>ใช้รายการตัวเลือกข้อความแทนภาพสามมิติได้</p>}><color attach="background" args={["#e2e8f0"]}/><ambientLight intensity={1.6}/><directionalLight position={[3,5,4]} intensity={2}/><Controls/><AvatarFigure avatar={avatar} appearance={appearance} color="#34d399" pose="wave" reducedMotion/></Canvas></div>;
}
