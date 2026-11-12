import { DataTexture, RedIntegerFormat, UnsignedIntType, Vector3, Vector4 } from 'three'

// This is a conservative light index, not a lower-resolution lighting buffer.
// Shading still runs at the original resolution with Three's original lights.
const CELL = 2, NX = 32, NY = 16, NZ = 40, WIDTH = 256
const MIN = [-32, -8, -40], COUNT = NX * NY * NZ, ALL = 0xffffffff
const RADIUS = Math.sqrt(3) * CELL / 2 + .01
const POINT_KEYS = ['x', 'y', 'z', 'range', 'active']
const SPOT_KEYS = [...POINT_KEYS, 'dx', 'dy', 'dz', 'cos', 'sin', 'cone']
const priority = light => (light.castShadow ? 2 : 0) + (light.map ? 1 : 0)
const lightOrder = (a, b) => priority(b) - priority(a) // Same stable order as WebGLLights.

export const worldLightGridShader = /* glsl */`
uniform highp usampler2D worldLightGrid;
uniform bool worldLightGridEnabled;
uniform vec4 worldLightGridOrigin;
uniform ivec3 worldLightGridSize;
uint worldLightMaskAt( vec3 viewPosition ) {
  if ( !worldLightGridEnabled ) return 0xffffffffu;
  // Inverse rigid view transform, also valid for the planar reflection camera.
  vec3 worldPosition = ( ( vec4( viewPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
  ivec3 cell = ivec3( floor( ( worldPosition - worldLightGridOrigin.xyz ) * worldLightGridOrigin.w ) );
  if ( any( lessThan( cell, ivec3( 0 ) ) ) || any( greaterThanEqual( cell, worldLightGridSize ) ) ) return 0xffffffffu;
  int index = cell.x + worldLightGridSize.x * ( cell.y + worldLightGridSize.y * cell.z );
  return texelFetch( worldLightGrid, ivec2( index % ${WIDTH}, index / ${WIDTH} ), 0 ).r;
}
`

export function createWorldLightGrid(scene) {
  const data = new Uint32Array(COUNT), pointData = new Uint32Array(COUNT)
  const texture = new DataTexture(data, WIDTH, COUNT / WIDTH, RedIntegerFormat, UnsignedIntType)
  texture.internalFormat = 'R32UI'; texture.name = 'world-local-light-grid'
  const uniforms = {
    worldLightGrid: { value: texture }, worldLightGridEnabled: { value: false },
    worldLightGridOrigin: { value: new Vector4(...MIN, 1 / CELL) },
    worldLightGridSize: { value: new Vector3(NX, NY, NZ) },
  }
  const points = [], spots = [], pointVolumes = [], spotVolumes = []
  const pointSignature = [], spotSignature = [], position = new Vector3(), direction = new Vector3()
  const stats = { points: 0, spots: 0, rebuilds: 0, cells: COUNT, memberships: 0 }
  let dirty = true, layers = -1, closed = false, pointMemberships = 0
  function collect(object) {
    if (!object.layers.test(layersCamera.layers)) return
    if (object.isPointLight) points.push(object)
    else if (object.isSpotLight) spots.push(object)
  }
  let layersCamera
  function describe(lights, volumes, signature, spot) {
    let cursor = 0, changed = signature[0] !== lights.length
    const write = value => { changed ||= signature[cursor] !== value; signature[cursor++] = value }
    write(lights.length)
    lights.forEach((light, i) => {
      const volume = volumes[i] ||= {}
      position.setFromMatrixPosition(light.matrixWorld)
      volume.x = position.x; volume.y = position.y; volume.z = position.z
      volume.range = light.distance
      volume.active = light.intensity !== 0 && (light.color.r !== 0 || light.color.g !== 0 || light.color.b !== 0)
      volume.cone = false
      if (spot) {
        direction.setFromMatrixPosition(light.target.matrixWorld).sub(position).normalize()
        volume.dx = direction.x; volume.dy = direction.y; volume.dz = direction.z
        volume.cos = Math.cos(light.angle); volume.sin = Math.sin(light.angle)
        volume.cone = direction.lengthSq() > .99 && light.angle > 0 && light.angle < Math.PI / 2
      }
      for (const key of spot ? SPOT_KEYS : POINT_KEYS) write(volume[key])
    })
    return changed
  }
  function addVolume(buffer, volume, bit) {
    if (!volume.active) return 0
    const { x, y, z, range, dx, dy, dz, cos, sin, cone } = volume
    // Unsupported/unbounded volumes fall back to evaluating this light everywhere.
    if (!(range > 0) || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || !Number.isFinite(range)) {
      for (let i = 0; i < COUNT; i++) buffer[i] |= bit
      return COUNT
    }
    let minX = x - range, maxX = x + range, minY = y - range, maxY = y + range, minZ = z - range, maxZ = z + range
    if (cone) {
      // Intersect the cutoff sphere's AABB with an enclosing finite cone's AABB.
      const radius = range * sin / cos
      const ex = radius * Math.sqrt(Math.max(0, 1 - dx * dx)), ey = radius * Math.sqrt(Math.max(0, 1 - dy * dy)), ez = radius * Math.sqrt(Math.max(0, 1 - dz * dz))
      minX = Math.max(minX, Math.min(x, x + dx * range - ex)); maxX = Math.min(maxX, Math.max(x, x + dx * range + ex))
      minY = Math.max(minY, Math.min(y, y + dy * range - ey)); maxY = Math.min(maxY, Math.max(y, y + dy * range + ey))
      minZ = Math.max(minZ, Math.min(z, z + dz * range - ez)); maxZ = Math.min(maxZ, Math.max(z, z + dz * range + ez))
    }
    const x0 = Math.max(0, Math.floor((minX - MIN[0] - .01) / CELL)), x1 = Math.min(NX - 1, Math.floor((maxX - MIN[0] + .01) / CELL))
    const y0 = Math.max(0, Math.floor((minY - MIN[1] - .01) / CELL)), y1 = Math.min(NY - 1, Math.floor((maxY - MIN[1] + .01) / CELL))
    const z0 = Math.max(0, Math.floor((minZ - MIN[2] - .01) / CELL)), z1 = Math.min(NZ - 1, Math.floor((maxZ - MIN[2] + .01) / CELL))
    const rangeSquared = (range + RADIUS) ** 2, cosSquared = cos * cos
    let memberships = 0
    for (let iz = z0; iz <= z1; iz++) {
      const oz = MIN[2] + (iz + .5) * CELL - z
      for (let iy = y0; iy <= y1; iy++) {
        const oy = MIN[1] + (iy + .5) * CELL - y, row = NX * (iy + NY * iz)
        for (let ix = x0; ix <= x1; ix++) {
          const ox = MIN[0] + (ix + .5) * CELL - x, squared = ox * ox + oy * oy + oz * oz
          if (squared > rangeSquared) continue
          if (cone) {
            const axial = ox * dx + oy * dy + oz * dz, limit = RADIUS + axial * sin
            // Conservative sphere/cone rejection without a square root per cell.
            if (axial < -RADIUS || limit < 0 || Math.max(0, squared - axial * axial) * cosSquared > limit * limit) continue
          }
          buffer[row + ix] |= bit; memberships++
        }
      }
    }
    return memberships
  }
  function prepare(camera) {
    if (closed || (!dirty && layers === camera.layers.mask)) return
    dirty = false; layers = camera.layers.mask; layersCamera = camera
    points.length = spots.length = 0
    scene.traverseVisible(collect)
    points.sort(lightOrder); spots.sort(lightOrder)
    stats.points = points.length; stats.spots = spots.length
    if (points.length > 16 || spots.length > 16) { uniforms.worldLightGridEnabled.value = false; return }
    const pointsChanged = describe(points, pointVolumes, pointSignature, false)
    const spotsChanged = describe(spots, spotVolumes, spotSignature, true)
    uniforms.worldLightGridEnabled.value = true
    if (!pointsChanged && !spotsChanged && stats.rebuilds) return
    if (pointsChanged || !stats.rebuilds) {
      pointData.fill(0); pointMemberships = 0
      for (let i = 0; i < points.length; i++) pointMemberships += addVolume(pointData, pointVolumes[i], 1 << i)
    }
    data.set(pointData)
    stats.memberships = pointMemberships
    for (let i = 0; i < spots.length; i++) stats.memberships += addVolume(data, spotVolumes[i], 1 << (i + 16))
    texture.needsUpdate = true; stats.rebuilds++
  }
  const previous = scene.onBeforeRender
  function beforeRender(renderer, renderedScene, camera, target) { previous.call(this, renderer, renderedScene, camera, target); prepare(camera) }
  scene.onBeforeRender = beforeRender
  return {
    uniforms, prepare, invalidate() { dirty = true }, getState: () => ({ enabled: uniforms.worldLightGridEnabled.value, ...stats }),
    // Also used by geometry tests to query the same exact cell layout.
    maskAt(x, y, z) {
      if (!uniforms.worldLightGridEnabled.value) return ALL
      const ix = Math.floor((x - MIN[0]) / CELL), iy = Math.floor((y - MIN[1]) / CELL), iz = Math.floor((z - MIN[2]) / CELL)
      return ix < 0 || ix >= NX || iy < 0 || iy >= NY || iz < 0 || iz >= NZ ? ALL : data[ix + NX * (iy + NY * iz)]
    },
    dispose() { closed = true; if (scene.onBeforeRender === beforeRender) scene.onBeforeRender = previous; texture.dispose() },
  }
}
