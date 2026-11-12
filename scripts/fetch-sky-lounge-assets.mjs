// Authoring only. Download CC0 sources from Poly Haven; runtime loads local files.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { optimizeSkyLoungePlants } from './optimize-sky-lounge-plants.mjs'
const run = promisify(execFile), root = path.resolve('public/models/sky-lounge'), sources = []
async function download(file, info, targetRoot = root) {
  const target = path.resolve(targetRoot, file)
  if (!target.startsWith(targetRoot + path.sep)) throw Error('Invalid asset path')
  await mkdir(path.dirname(target), { recursive: true })
  const valid = async () => { try { return createHash('md5').update(await readFile(target)).digest('hex') === info.md5 } catch { return false } }
  if (!await valid()) {
    await run('curl.exe', ['-sS', '-L', '--fail', '--retry', '2', '--max-time', '180', info.url, '-o', target])
    if (!await valid()) throw Error(`Checksum mismatch: ${file}`)
  }
  sources.push({ file, sourceOnly: targetRoot !== root, url: info.url, md5: info.md5 }); console.log(file)
}
async function metadata(id) {
  const { stdout } = await run('curl.exe', ['-sS', '-L', '--fail', '--max-time', '30', `https://api.polyhaven.com/files/${id}`], { maxBuffer: 4000000 })
  return JSON.parse(stdout)
}
const sky = await metadata('modern_buildings')
await download('city-source.jpg', sky.tonemapped, path.resolve('output/sky-lounge-sources'))
await download('city-lighting.hdr', sky.hdri['1k'].hdr)
for (const id of ['potted_plant_01', 'potted_plant_02', 'modern_arm_chair_01']) {
  const files = (await metadata(id)).gltf['1k'].gltf
  const modelRoot = id.startsWith('potted_plant_') ? path.resolve('output/sky-lounge-sources') : root
  await download(`${id}/model.gltf`, files, modelRoot)
  const entries = Object.entries(files.include)
  for (let i = 0; i < entries.length; i += 4) await Promise.all(entries.slice(i, i + 4).map(([file, info]) => download(`${id}/${file}`, info, file.endsWith('.bin') ? modelRoot : root)))
}
for (const [id, label] of [['marble_01', 'marble'], ['smoked_walnut_veneer', 'walnut'], ['wool_boucle', 'boucle']]) {
  const files = await metadata(id)
  await Promise.all([['Diffuse', 'color'], ['nor_gl', 'normal'], ['Rough', 'roughness']].map(([key, name]) => download(`${label}-${name}.jpg`, files[key]['1k'].jpg)))
}
await writeFile(path.join(root, 'sources.json'), JSON.stringify({
  license: 'CC0-1.0', provider: 'https://polyhaven.com', sources,
  derived: [
    { file: 'city-panorama.jpg', source: 'city-source.jpg', process: '8192x4096 JPEG quality 91' },
    { file: 'city-panorama-4k.jpg', source: 'city-source.jpg', process: '4096x2048 JPEG quality 91' },
    ...await optimizeSkyLoungePlants(),
  ],
}, null, 2) + '\n')
