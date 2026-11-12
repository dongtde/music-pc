import { BufferAttribute } from 'three'

// Weld only bit-identical attributes. Unlike tolerance-based welding or LOD,
// this preserves every triangle, normal, UV seam and material draw range.
export function indexGeometryExactly(geometry) {
  if (geometry.index || Object.keys(geometry.morphAttributes).length) return geometry
  const entries = Object.entries(geometry.attributes), count = geometry.attributes.position?.count
  if (!count || entries.some(([, attribute]) => attribute.isInterleavedBufferAttribute || attribute.array.BYTES_PER_ELEMENT !== 4 || attribute.count !== count)) return geometry
  const words = entries.map(([, attribute]) => ({ size: attribute.itemSize, data: new Uint32Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.length) }))
  const unique = [], remap = new Uint32Array(count), vertices = new Map()
  for (let i = 0; i < count; i++) {
    let key = ''
    for (const { size, data } of words) for (let component = 0; component < size; component++) key += data[i * size + component] + ','
    let index = vertices.get(key)
    if (index === undefined) { index = unique.length; vertices.set(key, index); unique.push(i) }
    remap[i] = index
  }
  if (unique.length === count) return geometry
  for (const [name, attribute] of entries) {
    const array = new attribute.array.constructor(unique.length * attribute.itemSize)
    unique.forEach((source, index) => array.set(attribute.array.subarray(source * attribute.itemSize, (source + 1) * attribute.itemSize), index * attribute.itemSize))
    const indexed = new BufferAttribute(array, attribute.itemSize, attribute.normalized).setUsage(attribute.usage)
    indexed.name = attribute.name; indexed.gpuType = attribute.gpuType
    geometry.setAttribute(name, indexed)
  }
  geometry.setIndex(new BufferAttribute(unique.length <= 65535 ? new Uint16Array(remap) : remap, 1))
  geometry.userData.exactIndexing = { before: count, after: unique.length }
  return geometry
}
