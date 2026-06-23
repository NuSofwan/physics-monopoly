export function MiniQr({ value }: { value: string }): JSX.Element {
  const bits = makeBits(value || "PHYSICS");
  return (
    <div className="grid h-28 w-28 grid-cols-9 gap-0.5 rounded-lg bg-white p-2 shadow-inner" aria-label="room code visual share pattern">
      {bits.map((bit, index) => (
        <span key={index} className={bit ? "rounded-[2px] bg-ink" : "rounded-[2px] bg-slate-100"} />
      ))}
    </div>
  );
}

function makeBits(value: string): boolean[] {
  let seed = 17;
  for (const char of value) seed = (seed * 31 + char.charCodeAt(0)) % 9973;
  return Array.from({ length: 81 }, (_, index) => {
    const row = Math.floor(index / 9);
    const col = index % 9;
    const finder = (row < 3 && col < 3) || (row < 3 && col > 5) || (row > 5 && col < 3);
    if (finder) return row % 2 === 0 || col % 2 === 0;
    return ((seed + index * 13 + row * col * 7) % 5) < 2;
  });
}

