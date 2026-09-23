import { lazy, Suspense } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
const MathFragment = lazy(() => import("./MathFragment"));

export function EquationText({ text }: { text: string }): JSX.Element {
  const parts = text.split(/(\$[^$]+\$)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("$") && part.endsWith("$")) {
          return (
            <ErrorBoundary key={`${part}-${index}`} fallback={<span>{part.slice(1, -1)}</span>}>
              <Suspense fallback={<span>{part.slice(1, -1)}</span>}>
                <MathFragment math={part.slice(1, -1)} />
              </Suspense>
            </ErrorBoundary>
          );
        }
        return <span key={`${part}-${index}`}>{part}</span>;
      })}
    </>
  );
}
