import { useEffect, useState } from "react";
import { toDataURL } from "qrcode";

export function MiniQr({ value }: { value: string }): JSX.Element {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setDataUrl(null);
    setError(false);
    void toDataURL(value, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 256,
      color: { dark: "#0b1224", light: "#ffffff" },
    })
      .then((nextDataUrl) => {
        if (active) setDataUrl(nextDataUrl);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [value]);

  if (error) return <p className="grid h-28 w-28 place-items-center rounded-lg bg-rose-50 p-2 text-center text-xs font-bold text-rose-700">สร้าง QR ไม่สำเร็จ</p>;
  if (!dataUrl) return <div className="h-28 w-28 animate-pulse rounded-lg bg-slate-100" aria-label="กำลังสร้าง QR" />;
  return <img className="h-28 w-28 rounded-lg bg-white p-2 shadow-inner" src={dataUrl} alt="QR code สำหรับเปิดลิงก์ห้อง" />;
}
