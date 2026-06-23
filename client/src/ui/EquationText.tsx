import { InlineMath } from "react-katex";

export function EquationText({ text }: { text: string }): JSX.Element {
  const parts = text.split(/(\$[^$]+\$)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("$") && part.endsWith("$")) {
          return <InlineMath key={`${part}-${index}`} math={part.slice(1, -1)} />;
        }
        return <span key={`${part}-${index}`}>{part}</span>;
      })}
    </>
  );
}
