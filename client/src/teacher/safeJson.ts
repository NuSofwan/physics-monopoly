// Parses a fetch Response body as JSON without throwing a raw (often English)
// SyntaxError when the server/proxy returns a non-JSON body (e.g. an HTML
// error page from a cold-starting or sleeping Render instance).
export async function parseJsonResponse<T = any>(response: Response): Promise<T | undefined> {
  const text = await response.text();
  try {
    return text ? (JSON.parse(text) as T) : undefined;
  } catch {
    return undefined;
  }
}

export const genericServerErrorTh = "เซิร์ฟเวอร์ไม่ตอบสนอง ลองใหม่อีกครั้ง";
