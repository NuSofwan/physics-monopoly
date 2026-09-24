import { it, expect } from "vitest";
import { locations, avatarPresets, classroomBoard } from "../shared/src/index";
import { safeAppearance } from "../shared/src/appearance";
it("allowlists cosmetic options without accepting URLs, stats or arbitrary shaders",()=>{
  expect(safeAppearance({shirt:"url(evil)",skin:"#694534",hair:"long",equipment:false,base:"#34d399",money:999999})).toEqual({skin:"#694534",hair:"long",equipment:false,base:"#34d399"});
  expect(safeAppearance(null)).toEqual({});
});
it("defines 12 unique locations without per-location economy overrides", () => {
  expect(locations).toHaveLength(12); expect(new Set(locations.map((l) => l.id)).size).toBe(12);
  for (const location of locations) { expect(location.buildings).toHaveLength(3); expect(location).not.toHaveProperty("rent"); }
  expect(classroomBoard).toHaveLength(28);
});
it("defines 24 distinct anime characters spanning roles, genders, ages and wheelchairs", () => {
  expect(avatarPresets).toHaveLength(24); expect(new Set(avatarPresets.map((p) => p.role)).size).toBeGreaterThanOrEqual(12);
  expect(new Set(avatarPresets.map((p) => p.gender))).toEqual(new Set(["female","male"]));
  expect(new Set(avatarPresets.map((p) => p.cut)).size).toBeGreaterThanOrEqual(6);
  expect(new Set(avatarPresets.map((p) => p.age)).size).toBe(4);
  expect(avatarPresets.filter((p) => "wheelchair" in p && p.wheelchair)).toHaveLength(2);
  expect(new Set(avatarPresets.map((p) => p.skin)).size).toBeGreaterThan(8);
  for (const preset of avatarPresets) { expect(preset).not.toHaveProperty("difficulty"); expect(preset).not.toHaveProperty("rent"); }
});
