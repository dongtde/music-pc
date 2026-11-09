# Resonance music environments

Run `node scripts/build-music-world.mjs` for the glass pavilion and shared equipment. Run `node scripts/build-music-scenes.mjs` for the vinyl studio and live stage shells. Version 3 separates the architecture from the equipment so changing scenes retains the player, archive interactions and seating. The central control terminal includes a modeled housing, inclined touchscreen, supports and ventilation slots. The environment geometry is authored programmatically for this project with PBR materials.

`Fantasy_Queen_Walk.glb` is the user-provided Fantasy Queen character, rigged and animated in local Blender. It includes the corrected `Walk_InPlace` arm swing and `Idle`, `Sit`, `Jump` poses. All local and remote room characters use this asset, with independent cloned skeletons. The asset faces +Z with Y up and uses meter units. Long clothes use bone deformation, not cloth simulation.

## Character compression

The deployed character uses `EXT_meshopt_compression`, `KHR_mesh_quantization`, and `KHR_texture_basisu`. Its embedded 4096×4096 base-color texture is KTX2 ETC1S with 13 mip levels. The model was processed with glTF Transform 4.5.1 and KTX-Software 4.4.2. File size: 5,005,404 → 3,304,412 bytes (34.0% smaller); all 34 joints and four animations are retained.

The uncompressed room asset is preserved locally at `output/blender/fantasy-queen-walk/Fantasy_Queen_Room_Uncompressed.glb`. The `output/` folder contains authoring files and previews and is excluded from Git and deployment. The application only needs the compressed GLB checked into `public/models/`. When the local source is available, encode textures first, then apply Meshopt once:

```sh
gltf-transform etc1s input.glb textures.glb --quality 192 --compression 2 --rdo false --jobs 4
gltf-transform meshopt textures.glb Fantasy_Queen_Walk.glb --level high --quantize-position 16 --quantize-texcoord 16 --quantize-normal 12 --quantize-weight 16
```

`fantasyQueenAvatar.js` configures the Meshopt decoder and a renderer-aware KTX2 loader. The Basis JS/WASM decoder files come from the installed Three.js package and are emitted by Vite into local build assets, including desktop builds. No CDN or runtime encoder is required. After transcoding the shared texture, its worker is released. Keep the generated `assets/` directory together with `models/` when deploying.
