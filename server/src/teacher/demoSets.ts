/** Project-authored practice drafts. Teacher approval is always required. */
export const demoCatalog = [
  { id: "m2-forces", grade: 2, title: "แรงลัพธ์ในแนวเดียวกัน", topic: "mechanics" },
  { id: "m2-speed", grade: 2, title: "ระยะทาง เวลา และอัตราเร็ว", topic: "mechanics" },
  { id: "m4-newton", grade: 4, title: "แรงลัพธ์และความเร่ง", topic: "mechanics" },
  { id: "m4-work", grade: 4, title: "งานของแรงคงตัว", topic: "mechanics" },
  { id: "m5-waves", grade: 5, title: "อัตราเร็ว ความถี่ และความยาวคลื่น", topic: "waves" },
  { id: "m5-optics", grade: 5, title: "อัตราเร็วแสงในตัวกลาง", topic: "optics" },
] as const;
export function demoQuestions(id: string): Array<Record<string, unknown>> {
  const set = demoCatalog.find((item) => item.id === id);
  if (!set) throw new Error("Unknown demo set");
  return Array.from({ length: 30 }, (_, index) => {
    const n = index + 1;
    let prompt = "", explanation = "", hint = "", value = 0, unit = "N";
    if (id === "m2-forces") {
      const a = 8 + n, b = 2 + n % 5, opposite = n % 2 === 0;
      value = opposite ? a - b : a + b;
      prompt = `แรง ${a} N ไปทางขวา และ ${b} N ไปทาง${opposite ? "ซ้าย" : "ขวา"} กระทำต่อวัตถุในแนวเดียวกัน จงหาขนาดแรงลัพธ์ (ทิศไปขวา)`;
      hint = "กำหนดทางขวาเป็นบวก แรงทิศตรงข้ามต้องหักลบกัน";
      explanation = `แรงลัพธ์ = ${a} ${opposite ? "−" : "+"} ${b} = ${value} N ไปทางขวา ทิศแรงบอกทิศความเร่ง ไม่ได้บอกว่าความเร็วชี้ขวาเสมอ`;
    } else if (id === "m2-speed") {
      const speed = 2 + n % 8, time = 5 + n, distance = speed * time;
      value = speed; unit = "m/s";
      prompt = `นักเรียนเดินได้ระยะทาง ${distance} m ในเวลา ${time} s จงหาอัตราเร็วเฉลี่ย ไม่ใช่ขนาดการกระจัดต่อเวลา`;
      hint = "อัตราเร็วเฉลี่ย = ระยะทางทั้งหมด ÷ เวลาทั้งหมด";
      explanation = `อัตราเร็วเฉลี่ย = ${distance}/${time} = ${speed} m/s ใช้ระยะทาง ไม่ใช่การกระจัด`;
    } else if (id === "m4-newton") {
      const mass = 2 + n % 6, acceleration = n + 1, force = mass * acceleration;
      value = acceleration; unit = "m/s^2";
      prompt = `วัตถุมวล ${mass} kg อยู่ในกรอบอ้างอิงเฉื่อย มีแรงลัพธ์คงตัว ${force} N ไปทางขวา จงหาขนาดความเร่ง`;
      hint = "ใช้แรงลัพธ์ ไม่ใช่แรงเพียงแรงเดียว: ΣF = ma";
      explanation = `จาก ΣF = ma ได้ a = ${force}/${mass} = ${acceleration} m/s² ไปทางขวา โดยยังสรุปทิศความเร็วไม่ได้จากข้อมูลนี้`;
    } else if (id === "m4-work") {
      const force = 5 + n, distance = 2 + n % 7;
      value = force * distance; unit = "J";
      prompt = `แรงคงตัว ${force} N ดึงวัตถุให้เคลื่อนที่ ${distance} m ในทิศเดียวกับแรง จงหางานที่แรงนี้ทำ (ไม่ได้ถามงานสุทธิของทุกแรง)`;
      hint = "W = Fs cos θ และโจทย์นี้ θ = 0°";
      explanation = `W = ${force} × ${distance} × cos 0° = ${value} J งานของแรงนี้เป็นบวก ไม่จำเป็นต้องเท่ากับงานสุทธิหากมีแรงอื่น`;
    } else if (id === "m5-waves") {
      const frequency = 2 + n, wavelength = 1 + n % 5;
      value = frequency * wavelength; unit = "m/s";
      prompt = `คลื่นต่อเนื่องในตัวกลางสม่ำเสมอมีความถี่ ${frequency} Hz และความยาวคลื่น ${wavelength} m จงหาอัตราเร็วการแพร่ของคลื่น ไม่ใช่อัตราเร็วอนุภาคตัวกลาง`;
      hint = "ใช้ v = fλ และ Hz มีหน่วยเท่ากับ s⁻¹";
      explanation = `v = ${frequency} × ${wavelength} = ${value} m/s เป็นอัตราเร็วการแพร่ของคลื่น ไม่ใช่ความเร็วการสั่นของอนุภาค`;
    } else {
      const refractiveIndex = 1.3 + n / 100;
      value = 3e8 / refractiveIndex; unit = "m/s";
      prompt = `แสงความถี่หนึ่งผ่านตัวกลางโปร่งใสซึ่งมีดัชนีหักเห ${refractiveIndex.toFixed(2)} ที่ความถี่นี้ กำหนด c = 3.00×10^8 m/s จงหาอัตราเร็วเฟสของแสงในตัวกลาง ตอบคลาดเคลื่อนได้ 1,000 m/s`;
      hint = "นิยามดัชนีหักเห n = c/v จัดรูปเป็น v = c/n";
      explanation = `v = 3.00×10^8/${refractiveIndex.toFixed(2)} ≈ ${Math.round(value)} m/s ความถี่ของแสงไม่เปลี่ยนเมื่อผ่านรอยต่อที่อยู่นิ่ง แต่ความยาวคลื่นเปลี่ยน`;
    }
    return { kind: "numeric", prompt, explanation, hint, numericKey: { value, unit, allowedUnits: [unit], absoluteTolerance: id === "m5-optics" ? 1000 : .01, relativeTolerance: 0 }, objective: set.title, topic: set.topic, difficulty: "easy", timeLimitSec: set.grade === 2 ? 60 : 75 };
  });
}
