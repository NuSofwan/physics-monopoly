# Asset provenance — development build

The Three.js geometry in `client/src/game3d/CityKit.tsx`, `AvatarFigure.tsx`,
`Board3D.tsx`, `Character.tsx`, and `diceGeometry.ts` is original procedural source created for this project. No
third-party 3D models, real student faces, purchased assets, or downloaded textures
were used for these additions. Distribution follows the repository owner's chosen
license; this file does not assign a new open-source license to the project.
The limestone plaster and terracotta roof bitmaps in `client/public/assets/textures/`
were generated for this project with Codex imagegen on 2026-09-23 from original
material prompts. Other ground, water, stone, wood and roof maps are generated in
the browser by `client/src/game3d/SurfaceTextures.ts`.

These models remain **development prototypes**, not approved final artwork.
The lobby and legacy 2D board use `client/public/assets/art/science_city_hero.webp`,
generated specifically for this project with Codex imagegen on 2026-09-23 from an
original text prompt (fictional science city at dusk, no reference images). The
unverified former PNG is retained outside the deployable public directory at
`assets/legacy/physics_city_backdrop.png`. Older 2D placeholders and manifests
remain in the repository; their provenance must be verified separately. Their
presence in the repository is not proof of redistribution rights.

## Editable-source convention

- Y is up; positions use Three.js world units.
- Board tile pitch is 1.75 units; 28 ordered positions are shared by movement math.
- Character foot/base origin is at local Y=0, placed at world Y=0.30 on the board.
  A continuous raised walking ring supports all four seats, including the outer row.
- Building footprint is offset behind the walking lane; four seat positions stay
  outside its bounds and are covered by geometry-contract tests.
- Dice face normals: 1=+Y, 6=-Y, 2=+Z, 5=-Z, 3=+X, 4=-X.
- Geometry is generated at runtime, not imported GLB. `assets/procedural-manifest.v1.json`
  records editable-source hashes/bytes, IDs, clips, fallback, individual triangle counts and review status.
  After geometry changes, build and run `npm run test:assets:browser` to refresh
  `assets/geometry-metrics.v1.json` (303 named geometry counts), then
  `npm run assets:manifest` and `npm run assets:check`. Stale source hashes fail validation.
- 12 location kits (levels 0–3, variants A/B), 14 distinct purchasable tile silhouettes
  per city with a regional landmark miniature, 24 original anime-inspired character
  presets with five procedural poses,
  player-name canvas textures and synthesized Web Audio tones are project-authored.
- Main background uses the project-generated WebP. The old PNG remains only in
  `assets/legacy` and is not copied into the Vercel client build.
- Main Thai/Latin UI uses system-font fallback, not bundled copies of Windows fonts.
  KaTeX and its distributed fonts come from the installed `katex` package; retain
  its MIT notice (`node_modules/katex/LICENSE`) when distributing. Internal PDF QA
  fixtures embed the local Windows Tahoma font and are **not distributable course assets**.
- Scene-budget evidence: `docs/qa/catalog-1790190456043/result.json`.
  All 12 saturated low-quality scenes: at most 150 draw calls and 72,327 triangles.
  Headless desktop FPS samples are not an Android/physical-device certification.
- Art remains `review_required`: local roof/building/vegetation/transport details
  are implemented, but environments remain sparse and silhouettes simplified.
  No final-art approval, baked GLB rig or licensed-photo claim.
