import { useEffect,useMemo } from "react";
import { CanvasTexture } from "three";
export function PlayerBadge({name,slot}:{name:string;slot:number}):JSX.Element {
  const texture=useMemo(()=>{
    const canvas=document.createElement("canvas");canvas.width=512;canvas.height=96;
    const context=canvas.getContext("2d")!;
    context.fillStyle="rgba(15,23,42,.9)";context.fillRect(0,0,512,96);
    context.fillStyle="#ffffff";context.font="bold 42px system-ui";context.textAlign="center";context.textBaseline="middle";
    context.fillText(`${["△","□","⬟","⬡"][slot%4]} ${name}`,256,48,492);
    return new CanvasTexture(canvas);
  },[name,slot]);
  useEffect(()=>()=>texture.dispose(),[texture]);
  return <sprite position={[0,1.52,0]} scale={[1.55,.29,1]}><spriteMaterial map={texture} transparent depthTest={false}/></sprite>;
}
