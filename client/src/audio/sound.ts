import { Howl } from "howler";

const silent = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";

const sprites = {
  dice: new Howl({ src: [silent], volume: 0.2 }),
  step: new Howl({ src: [silent], volume: 0.12 }),
  good: new Howl({ src: [silent], volume: 0.16 }),
  bad: new Howl({ src: [silent], volume: 0.16 }),
};

export function playSound(name: keyof typeof sprites): void {
  sprites[name].play();
  if (typeof AudioContext !== "undefined") {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = name === "bad" ? "sawtooth" : "sine";
    oscillator.frequency.value = name === "dice" ? 220 : name === "step" ? 150 : name === "good" ? 520 : 120;
    gain.gain.value = 0.035;
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.08);
  }
}
