import jsQR from "jsqr";
import { PNG } from "pngjs";
import { toDataURL } from "qrcode";

const activityUrl = "https://staging.example.test/play/example-join-token?room=K7M9Q2";
const dataUrl = await toDataURL(activityUrl, {
  errorCorrectionLevel: "M",
  margin: 1,
  width: 256,
  color: { dark: "#0b1224", light: "#ffffff" },
});
const base64 = dataUrl.split(",")[1];
if (!base64) throw new Error("QR encoder returned an invalid data URL");
const image = PNG.sync.read(Buffer.from(base64, "base64"));
const decoded = jsQR(new Uint8ClampedArray(image.data), image.width, image.height);
if (decoded?.data !== activityUrl) throw new Error("QR decoder did not recover the original activity URL");
console.log(`QR round trip passed: ${decoded.data}`);
