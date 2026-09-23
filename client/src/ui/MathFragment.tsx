import { InlineMath } from "react-katex";
import "katex/dist/katex.min.css";
export default function MathFragment({ math }: { math: string }): JSX.Element {
  return <InlineMath math={math} renderError={() => <span title="สูตรยังไม่ถูกต้อง กรุณาให้ครูตรวจทาน">{math}</span>}/>;
}
