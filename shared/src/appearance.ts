export const shirtColors = ["#4e9caf","#d86748","#886ba8","#e3a650","#e9ece4","#67a6ab"] as const;
export const skinColors = ["#694534","#8b5b40","#b47a54","#d6a77d","#edc7a5"] as const;
export const baseColors = ["#34d399","#f8c24a","#f472b6","#60a5fa"] as const;
export interface Appearance { shirt?: string; skin?: string; hair?: "short"|"long"|"curly"; equipment?: boolean; base?: string }
export function safeAppearance(value: unknown): Appearance {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input=value as Record<string,unknown>, result:Appearance={};
  if (shirtColors.includes(input.shirt as typeof shirtColors[number])) result.shirt=input.shirt as string;
  if (skinColors.includes(input.skin as typeof skinColors[number])) result.skin=input.skin as string;
  if (baseColors.includes(input.base as typeof baseColors[number])) result.base=input.base as string;
  if (["short","long","curly"].includes(input.hair as string)) result.hair=input.hair as Appearance["hair"];
  if (typeof input.equipment === "boolean") result.equipment=input.equipment;
  return result;
}
