import { useEffect, useRef } from "react";
import Phaser from "phaser";
import type { GameState } from "@physics-monopoly/shared";
import type { MoveEvent } from "../store/gameStore";
import { playSound } from "../audio/sound";
import { BoardScene } from "./scenes/BoardScene";

interface Props {
  state: GameState;
  moveEvent: MoveEvent | null;
}

export function PhaserGame({ state, moveEvent }: Props): JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<BoardScene | null>(null);
  const lastMove = useRef<number | null>(null);

  useEffect(() => {
    if (!hostRef.current || gameRef.current) return;
    const scene = new BoardScene();
    sceneRef.current = scene;
    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      width: 760,
      height: 760,
      backgroundColor: "#edf5ff",
      scene,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    });
    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.syncState(state);
  }, [state]);

  useEffect(() => {
    if (!moveEvent || lastMove.current === moveEvent.nonce) return;
    const offset = state.players.findIndex((player) => player.id === moveEvent.playerId);
    sceneRef.current?.animateMove(moveEvent.playerId, moveEvent.path, Math.max(0, offset));
    playSound("step");
    lastMove.current = moveEvent.nonce;
  }, [moveEvent, state.players]);

  return <div ref={hostRef} className="h-full min-h-[360px] w-full overflow-hidden rounded-lg border border-white/40 bg-panel shadow-game" />;
}
