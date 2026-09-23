let muted = false;
let audioContext: AudioContext | null = null;

export function setMuted(value: boolean): void { muted = value; }

export function playSound(name: "dice" | "step" | "good" | "bad"): void {
  if (!muted && typeof AudioContext !== "undefined") {
    const context = audioContext ??= new AudioContext();
    if (context.state === "suspended") void context.resume().catch(() => undefined);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = name === "bad" ? "sawtooth" : "sine";
    oscillator.frequency.value = name === "dice" ? 220 : name === "step" ? 150 : name === "good" ? 520 : 120;
    gain.gain.value = 0.035;
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.08);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
}
