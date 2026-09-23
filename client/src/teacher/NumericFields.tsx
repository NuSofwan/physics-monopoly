import type { NumericKey } from "@physics-monopoly/shared";
export function NumericFields({ value }: { value?: NumericKey }): JSX.Element {
  const style = "mt-1 w-full rounded border border-slate-300 bg-white p-3";
  return <fieldset className="space-y-3 rounded border p-3"><legend>คำตอบตัวเลขและความคลาดเคลื่อน</legend>
    <label className="block">ค่าที่ถูกต้อง<input className={style} name="numericValue" type="number" step="any" required defaultValue={value?.value} /></label>
    <label className="block">หน่วยมาตรฐาน<input className={style} name="numericUnit" required defaultValue={value?.unit ?? "N"} /></label>
    <label className="block">หน่วยที่รับ (คั่นด้วยจุลภาค)<input className={style} name="allowedUnits" required defaultValue={value?.allowedUnits?.join(",") ?? "N,kN"} /></label>
    <label className="block">คลาดเคลื่อนสัมบูรณ์ (หน่วยมาตรฐาน)<input className={style} name="absoluteTolerance" type="number" min="0" step="any" required defaultValue={value?.absoluteTolerance ?? .01} /></label>
    <label className="block">คลาดเคลื่อนสัมพัทธ์ (0 ถึง 0.1)<input className={style} name="relativeTolerance" type="number" min="0" max="0.1" step="any" required defaultValue={value?.relativeTolerance ?? .01} /></label>
    <p className="text-sm">หน่วยที่รองรับ: N/kN, m/cm/km, s/ms, kg/g, m/s/km/h, m/s², J/kJ, W/kW, Hz/kHz</p>
  </fieldset>;
}
