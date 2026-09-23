export const locations = [
  { id: "bangkok", name: "กรุงเทพฯ", category: "ริมน้ำ", roof: "#aa382d", wall: "#f2dbad", ground: "#72a57a", sky: "#94cdec", landmark: "หลังคาไทยริมน้ำ", buildings: ["เรือนไทย","อาคารริมน้ำ","โรงแรมร่วมสมัย"] },
  { id: "tokyo", name: "โตเกียว", category: "ร่วมสมัย", roof: "#d33e4d", wall: "#e0d6cb", ground: "#809590", sky: "#cebfe0", landmark: "หอคอยและรถไฟ", buildings: ["บ้านเมือง","อาคารพาณิชย์","ตึกเทคโนโลยี"] },
  { id: "new-york", name: "นิวยอร์ก", category: "ร่วมสมัย", roof: "#42586a", wall: "#b87659", ground: "#65946e", sky: "#a2c8e0", landmark: "เส้นขอบฟ้าและสวน", buildings: ["Townhouse","Apartment","Skyscraper"] },
  { id: "singapore", name: "สิงคโปร์", category: "ร่วมสมัย", roof: "#43866b", wall: "#d7e6dd", ground: "#50a07d", sky: "#b8e3dc", landmark: "สวนต้นไม้สูงและอ่าว", buildings: ["Garden home","Green complex","Garden tower"] },
  { id: "paris", name: "ปารีส", category: "ศิลปะและประวัติศาสตร์", roof: "#536078", wall: "#e6d5b9", ground: "#86a477", sky: "#edcda9", landmark: "หอคอยโครงเหล็ก", buildings: ["บ้านมองซาร์","อาคารถนนยุโรป","Grand hotel"] },
  { id: "kyoto", name: "เกียวโต", category: "ศิลปะและประวัติศาสตร์", roof: "#465959", wall: "#976b49", ground: "#8cab83", sky: "#e5d8df", landmark: "เจดีย์และสวนซากุระ", buildings: ["Machiya","อาคารชุมชนไม้","Ryokan"] },
  { id: "cairo-giza", name: "ไคโร–กีซา", category: "ศิลปะและประวัติศาสตร์", roof: "#bf854e", wall: "#e7c98e", ground: "#d4b778", sky: "#eed8aa", landmark: "พีระมิดจำลอง", buildings: ["Courtyard home","อาคารหิน","Desert lodge"] },
  { id: "zermatt", name: "แซร์มัท", category: "ธรรมชาติ", roof: "#f3f4e9", wall: "#8a5c3c", ground: "#b5c9c0", sky: "#b8d8e7", landmark: "ยอดเขาหิมะและรถราง", buildings: ["Chalet","Alpine lodge","Mountain resort"] },
  { id: "santorini", name: "ซานโตรินี", category: "ธรรมชาติ", roof: "#266dbe", wall: "#fff6e7", ground: "#c8bba0", sky: "#9ad8ed", landmark: "บ้านโดมฟ้าบนหน้าผา", buildings: ["บ้านเกาะ","Terrace villas","Cliff resort"] },
  { id: "rio", name: "ริโอเดจาเนโร", category: "ธรรมชาติ", roof: "#d86d49", wall: "#f4d774", ground: "#75a468", sky: "#9edcde", landmark: "ภูเขาริมอ่าวและเคเบิลคาร์", buildings: ["บ้านชายฝั่ง","อาคารระเบียง","Seaside hotel"] },
  { id: "venice", name: "เวนิส", category: "ริมน้ำ", roof: "#b65d3e", wall: "#e9b393", ground: "#b5ad94", sky: "#dfd9c3", landmark: "สะพานโค้งและคลอง", buildings: ["บ้านคลอง","Palazzo","Canal hotel"] },
  { id: "sydney", name: "ซิดนีย์", category: "ริมน้ำ", roof: "#f1eee2", wall: "#d6bb91", ground: "#87ad86", sky: "#a5d5ed", landmark: "อาคารหลังคาใบเรือ", buildings: ["Coastal house","Harbor apartments","Harbor tower"] },
] as const;
export type LocationId = typeof locations[number]["id"];
export function locationById(id: string | undefined) { return locations.find((location) => location.id === id) ?? locations[0]; }
export function isLocationId(id: unknown): id is LocationId { return typeof id === "string" && locations.some((location) => location.id === id); }
