import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { Reflector } from 'three/addons/objects/Reflector.js'
import { WORLD_SEATS } from './worldNavigation.js'

const FINISHES = { 'sky-limestone': 'marble', 'sky-marble': 'marble', 'sky-walnut': 'walnut', 'sky-parquet': 'walnut', 'sky-carpet': 'boucle' }
const BASE = `${import.meta.env.BASE_URL}models/sky-lounge/`

function disposeModel(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set()
  root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry)
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue
      materials.add(material)
      Object.values(material).forEach(value => { if (value?.isTexture) textures.add(value) })
    }
  })
  geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose())
}

function createFloorReflection() {
  const shader = {
    uniforms: THREE.UniformsUtils.clone(Reflector.ReflectorShader.uniforms),
    vertexShader: Reflector.ReflectorShader.vertexShader,
    fragmentShader: Reflector.ReflectorShader.fragmentShader
      .replace('vec4 base = texture2DProj( tDiffuse, vUv );', `
        vec2 uv = vUv.xy / vUv.w, offset = vec2(.0025);
        vec4 base = texture2D(tDiffuse, uv) * .4;
        base += texture2D(tDiffuse, uv + offset) * .15;
        base += texture2D(tDiffuse, uv - offset) * .15;
        base += texture2D(tDiffuse, uv + vec2(offset.x, -offset.y)) * .15;
        base += texture2D(tDiffuse, uv + vec2(-offset.x, offset.y)) * .15;`)
      .replace('vec4( blendOverlay( base.rgb, color ), 1.0 )', 'vec4( base.rgb, .18 )'),
  }
  const mesh = new Reflector(new THREE.PlaneGeometry(6.02, 42), { textureWidth: 512, textureHeight: 512, multisample: 0, clipBias: .003, shader })
  mesh.name = 'sky-lounge-floor-reflection'; mesh.rotation.x = -Math.PI / 2; mesh.position.set(0, .021, 1)
  mesh.material.transparent = true; mesh.material.depthWrite = false
  const renderReflection = mesh.onBeforeRender, lastCamera = new THREE.Matrix4(), lastProjection = new THREE.Matrix4()
  let lastUpdate = -Infinity, framesSinceUpdate = 0
  mesh.onBeforeRender = function (renderer, scene, camera) {
    const now = performance.now()
    const moving = !lastCamera.equals(camera.matrixWorld) || !lastProjection.equals(camera.projectionMatrix)
    framesSinceUpdate++
    // Time alone refreshes every frame once lighting pushes frame time past the
    // interval. Reserve main-view frames even under load; never let the mirror
    // double the entire scene on every slow frame.
    if (!this.forceUpdate && (framesSinceUpdate < (moving ? 3 : 6) || now - lastUpdate < (moving ? 50 : 100))) return
    renderReflection.call(this, renderer, scene, camera)
    lastUpdate = now; framesSinceUpdate = 0; lastCamera.copy(camera.matrixWorld); lastProjection.copy(camera.projectionMatrix)
  }
  return mesh
}

function contactShadowTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d'), gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 62)
  gradient.addColorStop(0, '#090705a0'); gradient.addColorStop(.45, '#09070570'); gradient.addColorStop(1, '#09070500')
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(canvas)
}

// Finish loading all local assets before revealing the scene.
export async function createSkyLounge({ root, pavilion, renderer, quality = 'balanced', onUpdate = () => {}, isDisposed = () => false }) {
  const textureLoader = new THREE.TextureLoader(), modelLoader = new GLTFLoader()
  const textures = new Set(), models = [], props = new THREE.Group(), originalVisibility = new Map(), originalMaterials = new Map()
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
  const jobs = [
    textureLoader.loadAsync(BASE + (quality === 'high' ? 'city-panorama.jpg' : 'city-panorama-4k.jpg') + '?v=modern-buildings'),
    new HDRLoader().loadAsync(BASE + 'city-lighting.hdr?v=modern-buildings'),
    ...['potted_plant_01', 'potted_plant_02', 'modern_arm_chair_01'].map(id => modelLoader.loadAsync(BASE + id + '/model.gltf' + (id.startsWith('potted_plant_') ? '?v=compact-1' : ''))),
    ...['marble', 'walnut', 'boucle'].flatMap(id => ['color', 'normal', 'roughness'].map(kind => textureLoader.loadAsync(`${BASE}${id}-${kind}.jpg`))),
  ]
  const results = await Promise.allSettled(jobs)
  const values = results.map(result => result.status === 'fulfilled' ? result.value : null)
  for (const value of values) { if (value?.isTexture) textures.add(value); if (value?.scene) models.push(value.scene) }
  if (isDisposed() || results.some(result => result.status === 'rejected')) {
    textures.forEach(texture => texture.dispose()); models.forEach(disposeModel)
    throw isDisposed() ? new DOMException('World closed', 'AbortError') : results.find(result => result.status === 'rejected').reason
  }
  const [panorama, hdri, plantA, plantB, chair] = values
  const surfaces = Object.fromEntries(['marble', 'walnut', 'boucle'].map((name, i) => [name, values.slice(5 + i * 3, 8 + i * 3)]))
  for (const maps of Object.values(surfaces)) maps.forEach((texture, i) => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = anisotropy
    if (i === 0) texture.colorSpace = THREE.SRGBColorSpace
  })
  function finish(material, kind, repeat = [1, 1]) {
    const maps = surfaces[kind].map(texture => { const clone = texture.clone(); clone.repeat.fromArray(repeat); textures.add(clone); return clone })
    material.map = maps[0]; material.normalMap = maps[1]; material.roughnessMap = maps[2]; material.bumpMap = null
    material.normalScale.setScalar(kind === 'boucle' ? .55 : kind === 'marble' ? .12 : .24)
    material.roughness = kind === 'marble' ? .58 : kind === 'walnut' ? .72 : .96
    if(kind==='boucle')material.map=null
    material.color.set(kind === 'boucle' ? '#b7ab98' : kind==='walnut' ? '#957257' : '#ece5d7'); material.needsUpdate = true
  }
  root.traverse(object => {
    if (!object.isMesh) return
    const material = object.material, kind = FINISHES[material.name]
    object.castShadow = !material.transparent && material.name !== 'sky-cove-light'
    object.receiveShadow = !material.transparent
    if (kind) finish(material, kind, kind === 'boucle' ? [10, 10] : [1, 1])
    if(material.name==='sky-carpet')material.color.set('#766658')
  })
  // Preserve shared interaction anchors while changing furniture and upholstery.
  const materialKeys = ['map', 'normalMap', 'roughnessMap', 'bumpMap', 'roughness']
  pavilion.getObjectByName('pavilion-equipment').traverse(object => {
    if (/^record-shelf-|^listening-chair-/.test(object.name)) originalVisibility.set(object, object.visible)
    if (!object.isMesh) return
    const material = object.material, kind = { walnut: 'walnut', 'woven-fabric': 'boucle' }[material.name]
    if (!kind || originalMaterials.has(material)) return
    const original = Object.fromEntries(materialKeys.map(key => [key, material[key]]))
    original.normalScale = material.normalScale.clone()
    const originalColor = material.color.clone()
    finish(material, kind, kind === 'boucle' ? [4, 4] : [1, 1])
    const lounge = Object.fromEntries(materialKeys.map(key => [key, material[key]]))
    lounge.normalScale = material.normalScale.clone(); lounge.color = material.color.clone()
    originalMaterials.set(material, { original, lounge })
    Object.assign(material, original); material.color.copy(originalColor); material.needsUpdate = true
  })
  props.name = 'sky-lounge-furnishings'; root.add(props)
  const shadowTexture = contactShadowTexture(); textures.add(shadowTexture)
  const shadowMatrices = [], batches = new Map(), boundsCache = new Map(), transform = new THREE.Object3D()
  let furnishings = 0
  function shadow(x, z, width, depth, y = .039) {
    transform.position.set(x, y, z); transform.rotation.set(-Math.PI / 2, 0, 0); transform.scale.set(width, depth, 1); transform.updateMatrix()
    shadowMatrices.push(transform.matrix.clone())
  }
  function place(source, x, y, z, height, angle = 0) {
    if (!boundsCache.has(source)) boundsCache.set(source, new THREE.Box3().setFromObject(source))
    const bounds = boundsCache.get(source), scale = height / (bounds.max.y - bounds.min.y), center = bounds.getCenter(new THREE.Vector3())
    transform.position.set(x, y, z); transform.rotation.set(0, angle, 0); transform.scale.setScalar(scale); transform.updateMatrix()
    const placement = transform.matrix.clone().multiply(new THREE.Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z))
    furnishings++
    source.traverse(object => {
      if (!object.isMesh) return
      // Separate the two sides so offscreen furniture can still be culled.
      if (!batches.has(object)) batches.set(object, new Map())
      const sides = batches.get(object), side = Math.sign(x)
      if (!sides.has(side)) sides.set(side, [])
      sides.get(side).push(placement.clone().multiply(object.matrixWorld))
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        Object.values(material).forEach(value => { if (value?.isTexture) { value.anisotropy = anisotropy; textures.add(value) } })
      }
    })
  }
  for (const side of [-1, 1]) {
    for (const z of [-14, 12]) { place(plantA.scene, side * 16.9, -.06, z, 3.3, side * z * .17); shadow(side * 16.9, z, 2.7, 2.7, -.075) }
    for (const z of [-4, 6]) place(plantB.scene, side * 11.9, 1.23, z + .25, .72, side * z)
    for (const z of [-4, 1, 6]) shadow(side * 11.9, z, 3.4, 4.5)
  }
  for (const seat of WORLD_SEATS.filter(seat => seat.id !== 'seat-center')) {
    place(chair.scene, seat.x, .035, seat.z, 1.4, Math.PI + Math.sign(seat.x) * .22)
    shadow(seat.x, seat.z, 2.6, 2.8)
  }
  shadow(0, -9, 4.4, 3)
  for (const [source, sides] of batches) for (const [side, matrices] of sides) {
    const mesh = new THREE.InstancedMesh(source.geometry, source.material, matrices.length)
    mesh.name = `sky-lounge-${source.name}-${side}`; mesh.castShadow = mesh.receiveShadow = true
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix))
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); props.add(mesh)
  }
  const shadows = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, toneMapped: false }), shadowMatrices.length)
  shadows.name = 'sky-lounge-contact-shadows'
  shadowMatrices.forEach((matrix, index) => shadows.setMatrixAt(index, matrix))
  shadows.instanceMatrix.needsUpdate = true; shadows.computeBoundingSphere(); props.add(shadows)
  panorama.colorSpace = THREE.SRGBColorSpace
  const sky = new THREE.Mesh(new THREE.SphereGeometry(480, 64, 32), new THREE.MeshBasicMaterial({ map: panorama, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false }))
  sky.name = 'sky-lounge-photographic-city'; sky.rotation.y = Math.PI * .55; sky.renderOrder = -10; root.add(sky)
  hdri.mapping = THREE.EquirectangularReflectionMapping
  const generator = new THREE.PMREMGenerator(renderer)
  let environment
  try { environment = generator.fromEquirectangular(hdri) }
  catch(error) { textures.forEach(texture => texture.dispose()); throw error }
  finally { generator.dispose(); hdri.dispose(); textures.delete(hdri) }
  const reflection = createFloorReflection(); root.add(reflection)
  root.updateMatrixWorld(true)
  root.traverse(object => { object.matrixAutoUpdate = false })
  let active = false, closed = false, panoramaRevision = 0
  return {
    environment: environment.texture,
    setActive(value) {
      active = value
      if (value) reflection.forceUpdate = true
      originalVisibility.forEach((visible, object) => { object.visible = value ? false : visible })
      originalMaterials.forEach(({ original, lounge }, material) => {
        for(const key of materialKeys) material[key]=(value?lounge:original)[key]
        material.normalScale=(value?lounge:original).normalScale.clone()
        if(value)material.color.copy(lounge.color)
        material.needsUpdate = true
      })
    },
    setQuality(quality) {
      if (closed) return
      reflection.visible = quality === 'high'; reflection.forceUpdate = true
      const revision = ++panoramaRevision, file = quality === 'high' ? 'city-panorama.jpg' : 'city-panorama-4k.jpg'
      if (sky.material.map.image.width === (quality === 'high' ? 8192 : 4096)) return
      textureLoader.loadAsync(BASE + file + '?v=modern-buildings').then(texture => {
        if (closed || isDisposed() || revision !== panoramaRevision) { texture.dispose(); return }
        texture.colorSpace = THREE.SRGBColorSpace
        const previous = sky.material.map; sky.material.map = texture; textures.add(texture)
        previous.dispose(); textures.delete(previous); reflection.forceUpdate = true; onUpdate()
      }).catch(() => { /* Keep the current panorama if a quality upgrade cannot load. */ })
    },
    getState: () => ({ ready: true, active, photographicCity: true, furnishings, instancedProps: true, realtimeReflection: reflection.visible, reflectionResolution: reflection.getRenderTarget().width, panoramaWidth: sky.material.map.image.width }),
    dispose() {
      closed = true; panoramaRevision++
      originalVisibility.forEach((visible, object) => { object.visible = visible })
      originalMaterials.forEach(({ original }, material) => { Object.assign(material, original); material.needsUpdate = true })
      reflection.removeFromParent(); reflection.geometry.dispose(); reflection.dispose()
      // Parent shell teardown owns prop geometry/materials; textures are shared by clones.
      environment.dispose(); textures.forEach(texture => texture.dispose())
    },
  }
}
