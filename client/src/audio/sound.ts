let muted = false;
let audioContext: AudioContext | null = null;

export type SoundEffect =
  | "dice"
  | "step"
  | "good"
  | "bad"
  | "buy"
  | "jail"
  | "mortgage"
  | "heist";

export function setMuted(value: boolean): void { muted = value; }

/** Fire-and-forget procedural synthesizer. Audio failures (blocked AudioContext, no output device) must never break gameplay. */
export function playSound(name: SoundEffect): void {
  try { synth(name); } catch { /* sound is optional */ }
}

function note(context: AudioContext, freq: number, start: number, duration: number, type: OscillatorType, peak = 0.04, slideTo?: number): void {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.015, duration * 0.25));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(context.destination);
  osc.start(start);
  osc.stop(start + duration + 0.01);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
}

function synth(name: SoundEffect): void {
  if (muted || typeof AudioContext === "undefined") return;
  const context = audioContext ??= new AudioContext();
  if (context.state === "suspended") void context.resume().catch(() => undefined);
  const now = context.currentTime;

  switch (name) {
    case "dice":
      // Tactile wooden tabletop clatter: three crisp bouncing taps across the board
      [0, 0.09, 0.21, 0.34].forEach((offset, i) => {
        note(context, 340 - i * 38, now + offset, 0.055, "triangle", 0.045 - i * 0.008, 130);
        note(context, 780 + i * 90, now + offset, 0.025, "sine", 0.02 - i * 0.004, 420);
      });
      break;
    case "step":
      // Soft wooden pawn tap
      note(context, 210, now, 0.055, "triangle", 0.032, 115);
      break;
    case "good":
      // Warm triumphant major arpeggio chime (C5 -> E5 -> G5 -> C6)
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        note(context, freq, now + i * 0.055, 0.22, "sine", 0.038);
        note(context, freq * 1.5, now + i * 0.055, 0.14, "triangle", 0.012);
      });
      break;
    case "bad":
      // Soft descending minor double-tone
      note(context, 260, now, 0.14, "sawtooth", 0.026, 195);
      note(context, 185, now + 0.12, 0.22, "sawtooth", 0.028, 125);
      break;
    case "buy":
      // Crisp brass cash-register bell + wooden piece drop thud
      note(context, 145, now, 0.09, "triangle", 0.048, 72);
      note(context, 880, now + 0.06, 0.18, "sine", 0.035);
      note(context, 1318.5, now + 0.12, 0.28, "sine", 0.042);
      break;
    case "jail":
      // Heavy metallic iron cage clang + chain rattle
      note(context, 110, now, 0.32, "sawtooth", 0.045, 58);
      note(context, 440, now + 0.02, 0.18, "square", 0.022, 390);
      note(context, 622, now + 0.03, 0.24, "sine", 0.03, 580);
      break;
    case "mortgage":
      // Heavy stamp thud + melancholic low chime
      note(context, 98, now, 0.22, "triangle", 0.05, 52);
      note(context, 392, now + 0.08, 0.28, "sine", 0.03, 349.23);
      break;
    case "heist":
      // Cascading golden coin & banknote shimmer flourish
      [587.33, 739.99, 880, 1174.66, 1479.98].forEach((freq, i) => {
        note(context, freq, now + i * 0.045, 0.25, "sine", 0.032);
      });
      break;
  }
}
