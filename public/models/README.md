# Resonance music environments

Run `node scripts/build-music-world.mjs` for the glass pavilion and shared equipment. Run `node scripts/build-music-scenes.mjs` for the vinyl studio and live stage shells. Version 3 separates the architecture from the equipment so changing scenes retains the player, archive interactions and seating. The central control terminal includes a modeled housing, inclined touchscreen, supports and ventilation slots. The environment geometry is authored programmatically for this project with PBR materials.

`Fantasy_Queen_Walk.glb` is the user-provided Fantasy Queen character, rigged and animated in local Blender. It includes the corrected `Walk_InPlace` arm swing and `Idle`, `Sit`, `Jump` poses. All local and remote room characters use this asset, with independent cloned skeletons. The asset faces +Z with Y up and uses meter units. Long clothes use bone deformation, not cloth simulation.

`sky-lounge.glb` is the independently selectable 云端会所 shell. Rebuild with `node scripts/build-sky-lounge.mjs`. Its architecture contains a cantilevered terrace, a double-height glazed lounge, an oval skylight, suspended bronze light ribbons, fluted walls, an onyx bar with bottle shelves, low cabinets, table lamps, ceramics and stone side tables. Static architecture is merged into 15 material batches. The shared pavilion keeps chairs and tall shelving in named batches so this scene can replace their appearance while retaining screen and seat interaction anchors; switching back restores the original furnishings.

`createSkyLounge.js` loads all local textures, plants and chairs before revealing the shell. Smooth and balanced quality use a 4096×2048 city panorama; high uses 8192×4096. Changing quality replaces and disposes the previous panorama texture, with a matching prefiltered HDR environment in all presets. Walnut and stone use separate color, normal and roughness maps; upholstery uses the textile normal/roughness maps with a restrained solid color. Smooth and balanced use the floor material's environment reflections. High adds a 512-pixel planar reflection, capped at 20 updates per second during camera movement and 10 when stationary, with at least 3 or 6 main frames between updates respectively. This keeps slow frames from causing an extra scene render on every frame. Repeated plants, chairs and contact shadows are instanced; static transforms are frozen. No third-party requests occur at runtime.

The high preset retains all twelve real moving spotlights. Lit materials reject pixels outside each light's distance/cone before normalization and BRDF calculations. Light toggles keep the same light slots and shader programs.

The two plant models are reduced offline with meshoptimizer's attribute-aware simplifier, preserving UVs and normals with a 0.003 relative error limit. Their combined triangle count drops from 246,032 to 91,204 per model pair (63% fewer). The original GLTF/binary sources stay in ignored `output/sky-lounge-sources/`; `node scripts/optimize-sky-lounge-plants.mjs` regenerates the runtime models from those originals without repeated simplification.

The resources in `sky-lounge/` are CC0 assets from [Poly Haven](https://polyhaven.com/license):

| Source | Author | Use |
| --- | --- | --- |
| [Modern Buildings](https://polyhaven.com/a/modern_buildings) | Greg Zaal | Clean modern riverfront panorama and matching HDR illumination |
| [Potted Plant 01](https://polyhaven.com/a/potted_plant_01) | Rico Cilliers | Terrace foliage |
| [Potted Plant 02](https://polyhaven.com/a/potted_plant_02) | Rico Cilliers | Cabinet foliage |
| [Modern Arm Chair 01](https://polyhaven.com/a/modern_arm_chair_01) | Vibrant Nordic | Leather lounge chairs |
| [Marble 01](https://polyhaven.com/a/marble_01) | Rob Tuytel | Stone finishes |
| [Smoked Walnut Veneer](https://polyhaven.com/a/smoked_walnut_veneer) | Jenelle van Heerden | Cabinetry and wood floor |
| [Wool Boucle](https://polyhaven.com/a/wool_boucle) | colormass; Rico Cilliers | Upholstery surface detail |

`sky-lounge/sources.json` records original URLs and checksums. To restore the sources, run `node scripts/fetch-sky-lounge-assets.mjs`; then run `python scripts/prepare-sky-lounge-panorama.py` with Pillow installed. The full-size panorama source stays under ignored `output/sky-lounge-sources/`; only its re-encoded runtime version ships.

## Character compression

The deployed character uses `EXT_meshopt_compression`, `KHR_mesh_quantization`, and `KHR_texture_basisu`. Its embedded 4096×4096 base-color texture is KTX2 ETC1S with 13 mip levels. The model was processed with glTF Transform 4.5.1 and KTX-Software 4.4.2. File size: 5,005,404 → 3,304,412 bytes (34.0% smaller); all 34 joints and four animations are retained.

The uncompressed room asset is preserved locally at `output/blender/fantasy-queen-walk/Fantasy_Queen_Room_Uncompressed.glb`. The `output/` folder contains authoring files and previews and is excluded from Git and deployment. The application only needs the compressed GLB checked into `public/models/`. When the local source is available, encode textures first, then apply Meshopt once:

```sh
gltf-transform etc1s input.glb textures.glb --quality 192 --compression 2 --rdo false --jobs 4
gltf-transform meshopt textures.glb Fantasy_Queen_Walk.glb --level high --quantize-position 16 --quantize-texcoord 16 --quantize-normal 12 --quantize-weight 16
```

`fantasyQueenAvatar.js` configures the Meshopt decoder and a renderer-aware KTX2 loader. The Basis JS/WASM decoder files come from the installed Three.js package and are emitted by Vite into local build assets, including desktop builds. No CDN or runtime encoder is required. After transcoding the shared texture, its worker is released. Keep the generated `assets/` directory together with `models/` when deploying.
