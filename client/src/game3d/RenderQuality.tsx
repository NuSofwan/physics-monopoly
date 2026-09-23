import { createContext, useContext } from "react";

/** low: flat edges, no shadows · medium: bevelled geometry + shadows · high: medium + ambient occlusion, bloom and MSAA post-processing. */
export type RenderQuality = "low" | "medium" | "high";
export const QualityContext = createContext<RenderQuality>("medium");
export function useQuality(): RenderQuality { return useContext(QualityContext); }

/** Pick a sensible starting tier: phones/tablets and small CPUs stay on medium. */
export function defaultQuality(): RenderQuality {
  if (typeof window === "undefined") return "medium";
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const cores = navigator.hardwareConcurrency ?? 4;
  return !coarse && cores >= 4 ? "high" : "medium";
}
