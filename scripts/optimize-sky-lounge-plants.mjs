// Authoring only: preserve the CC0 originals in output/ and ship compact meshes.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js'

const ids = ['potted_plant_01', 'potted_plant_02']
const types = { 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }
const widths = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }

export async function optimizeSkyLoungePlants() {
  await MeshoptSimplifier.ready
  const derived = []
  for (const id of ids) {
    const source = path.resolve('output/sky-lounge-sources', id)
    const target = path.resolve('public/models/sky-lounge', id)
    const gltf = JSON.parse(await readFile(path.join(source, 'model.gltf'), 'utf8'))
    const buffers = await Promise.all(gltf.buffers.map(buffer => readFile(path.join(source, buffer.uri))))
    function read(index) {
      const accessor = gltf.accessors[index], view = gltf.bufferViews[accessor.bufferView]
      const Type = types[accessor.componentType], width = widths[accessor.type]
      if (!Type || !width || accessor.sparse || accessor.normalized) throw Error('Unsupported plant accessor')
      const packed = Buffer.alloc(accessor.count * width * Type.BYTES_PER_ELEMENT)
      const stride = view.byteStride || width * Type.BYTES_PER_ELEMENT
      const start = (view.byteOffset || 0) + (accessor.byteOffset || 0)
      for (let i = 0; i < accessor.count; i++) buffers[view.buffer].copy(packed, i * width * Type.BYTES_PER_ELEMENT, start + i * stride, start + i * stride + width * Type.BYTES_PER_ELEMENT)
      return new Type(packed.buffer.slice(packed.byteOffset, packed.byteOffset + packed.byteLength))
    }
    const accessors = [], views = [], chunks = []
    let offset = 0, before = 0, after = 0, maxError = 0
    function append(array, template, targetType, positions = false) {
      const padding = (4 - offset % 4) % 4
      if (padding) { chunks.push(Buffer.alloc(padding)); offset += padding }
      const buffer = Buffer.from(array.buffer, array.byteOffset, array.byteLength)
      const bufferView = views.length
      views.push({ buffer: 0, byteOffset: offset, byteLength: buffer.byteLength, target: targetType })
      chunks.push(buffer); offset += buffer.byteLength
      const accessor = { componentType: template.componentType, count: array.length / widths[template.type], type: template.type, bufferView }
      if (positions) {
        accessor.min = [Infinity, Infinity, Infinity]; accessor.max = [-Infinity, -Infinity, -Infinity]
        for (let i = 0; i < array.length; i++) {
          accessor.min[i % 3] = Math.min(accessor.min[i % 3], array[i]); accessor.max[i % 3] = Math.max(accessor.max[i % 3], array[i])
        }
      }
      accessors.push(accessor); return accessors.length - 1
    }
    for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
      if (primitive.mode !== undefined && primitive.mode !== 4 || primitive.targets) throw Error('Unsupported plant primitive')
      const positions = read(primitive.attributes.POSITION), normals = read(primitive.attributes.NORMAL), uv = read(primitive.attributes.TEXCOORD_0)
      const indices = read(primitive.indices), attributes = new Float32Array(positions.length / 3 * 5)
      for (let i = 0; i < positions.length / 3; i++) {
        attributes.set(normals.subarray(i * 3, i * 3 + 3), i * 5); attributes.set(uv.subarray(i * 2, i * 2 + 2), i * 5 + 3)
      }
      const [simplified, error] = MeshoptSimplifier.simplifyWithAttributes(indices, positions, 3, attributes, 5, [.1, .1, .1, .1, .1], null, Math.floor(indices.length * .25 / 3) * 3, .003, ['Permissive'])
      before += indices.length / 3; after += simplified.length / 3; maxError = Math.max(maxError, error)
      const [remap, count] = MeshoptSimplifier.compactMesh(simplified)
      const IndexType = count <= 65535 ? Uint16Array : Uint32Array
      primitive.indices = append(new IndexType(simplified), { componentType: IndexType === Uint16Array ? 5123 : 5125, type: 'SCALAR' }, 34963)
      for (const [semantic, oldIndex] of Object.entries(primitive.attributes)) {
        const template = gltf.accessors[oldIndex], original = read(oldIndex), width = widths[template.type]
        const compact = new original.constructor(count * width)
        for (let vertex = 0; vertex < remap.length; vertex++) if (remap[vertex] !== 0xffffffff) compact.set(original.subarray(vertex * width, vertex * width + width), remap[vertex] * width)
        primitive.attributes[semantic] = append(compact, template, 34962, semantic === 'POSITION')
      }
    }
    const uri = `${id}.bin`
    gltf.accessors = accessors; gltf.bufferViews = views; gltf.buffers = [{ uri: uri + '?v=compact-1', byteLength: offset }]
    gltf.asset.generator = 'Sky lounge / meshoptimizer attribute-aware simplification'
    await mkdir(target, { recursive: true })
    await writeFile(path.join(target, uri), Buffer.concat(chunks))
    await writeFile(path.join(target, 'model.gltf'), JSON.stringify(gltf) + '\n')
    const record = { file: `${id}/model.gltf`, source: `${id}/model.gltf`, process: 'meshoptimizer, 25% triangle target, 0.003 relative attribute error', trianglesBefore: before, trianglesAfter: after, maxError }
    derived.push(record); console.log(`${id}: ${before.toLocaleString()} → ${after.toLocaleString()} triangles (${(offset / 1048576).toFixed(2)} MB)`)
  }
  return derived
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const plants = await optimizeSkyLoungePlants()
  const manifestPath = 'public/models/sky-lounge/sources.json'
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  manifest.sources.forEach(entry => { if (ids.some(id => entry.file.startsWith(id + '/') && !entry.file.includes('/textures/'))) entry.sourceOnly = true })
  const previous = Array.isArray(manifest.derived) ? manifest.derived : [manifest.derived].filter(Boolean)
  manifest.derived = [...previous.filter(entry => !ids.some(id => entry.file.startsWith(id + '/'))), ...plants]
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
}
