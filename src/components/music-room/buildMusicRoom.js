import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { Reflector } from 'three/addons/objects/Reflector.js'
import { createConcertLights } from './createConcertLights'

export function buildMusicRoom(scene, screenTexture) {
  const architecture = new THREE.Group()
  architecture.name = 'room-architecture'
  scene.add(architecture)
  const metal = new THREE.MeshStandardMaterial({ color: '#354654', metalness: 0.8, roughness: 0.32 })
  const black = new THREE.MeshStandardMaterial({ color: '#101b27', metalness: 0.55, roughness: 0.4 })
  const wall = new THREE.MeshStandardMaterial({ color: '#233342', metalness: 0.25, roughness: 0.78 })
  const fabric = new THREE.MeshStandardMaterial({ color: '#10171d', roughness: 0.98 })
  const accent = new THREE.MeshStandardMaterial({ color: '#79e6d7', emissive: '#54d5c4', emissiveIntensity: 2.4, roughness: 0.3 })
  const blue = new THREE.MeshStandardMaterial({ color: '#91b7ff', emissive: '#5b89ef', emissiveIntensity: 2.4 })
  const white = new THREE.MeshStandardMaterial({ color: '#d3eaf3', emissive: '#b5d8eb', emissiveIntensity: 2 })
  const mesh = (geometry, material, position = [0, 0, 0], parent = architecture) => {
    const result = new THREE.Mesh(geometry, material)
    result.position.fromArray(position)
    result.castShadow = true
    result.receiveShadow = true
    parent.add(result)
    return result
  }
  const box = (size, material, position, radius = 0, parent = architecture) => mesh(
    radius ? new RoundedBoxGeometry(...size, 2, radius) : new THREE.BoxGeometry(...size), material, position, parent)
  const label = (text, subtext, width, height, position, rotation = 0) => {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#84d8d2'; ctx.font = '48px "Microsoft YaHei", sans-serif'; ctx.fillText(text, 42, 100, 940)
    ctx.fillStyle = '#7898ab'; ctx.font = '24px "Bahnschrift", sans-serif'; ctx.fillText(subtext, 44, 174, 940)
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace
    const surface = new THREE.MeshBasicMaterial({ map, transparent: true, toneMapped: false, depthWrite: false })
    const result = mesh(new THREE.PlaneGeometry(width, height), surface, position)
    result.rotation.y = rotation
    result.castShadow = false
    return result
  }

  // A fully enclosed architectural shell, with physical ribs and acoustic bays.
  box([18.8, 0.35, 26], black, [0, -0.18, 0])
  box([0.45, 7.4, 26], wall, [-9.15, 3.7, 0])
  box([0.45, 7.4, 26], wall, [9.15, 3.7, 0])
  box([18.6, 7.4, 0.5], black, [0, 3.7, -12.6])
  box([18.6, 7.4, 0.5], wall, [0, 3.7, 12.5])
  box([18.6, 0.4, 25.5], black, [0, 7.25, 0])

  const reflector = new Reflector(new THREE.PlaneGeometry(18, 25), { textureWidth: 640, textureHeight: 640, color: '#5b788d', clipBias: 0.003, multisample: 0 })
  reflector.rotation.x = -Math.PI / 2
  reflector.position.y = 0.008
  reflector.name = 'polished-floor-reflection'
  scene.add(reflector)
  const floor = mesh(new THREE.PlaneGeometry(18, 25), new THREE.MeshStandardMaterial({ color: '#14232f', metalness: 0.5, roughness: 0.32, transparent: true, opacity: 0.74 }), [0, 0.012, 0], scene)
  floor.rotation.x = -Math.PI / 2
  floor.castShadow = false
  for (let x = -8; x <= 8; x += 2) box([0.022, 0.012, 24.8], metal, [x, 0.018, 0])
  for (let z = -12; z <= 12; z += 2) box([18, 0.012, 0.022], metal, [0, 0.018, z])
  for (const x of [-1.05, 1.05]) {
    box([0.025, 0.015, 20], accent, [x, 0.026, -0.6])
    for (let z = 8; z >= -8; z -= 2) box([0.2, 0.019, 0.035], accent, [x, 0.028, z])
  }
  for (const side of [-1, 1]) {
    box([0.08, 0.1, 24], accent, [side * 8.8, 0.24, 0])
    box([0.06, 0.07, 24], blue, [side * 8.8, 6.75, 0])
    for (const z of [-9.7, -4.8, 0.2, 5.2, 10.2]) {
      box([0.5, 6.9, 0.48], metal, [side * 8.65, 3.45, z], 0.08)
      box([0.07, 5.9, 0.05], white, [side * 8.37, 3.7, z + 0.25])
      box([0.23, 4.55, 3.65], fabric, [side * 8.87, 3.4, z - 2.3], 0.03)
      for (let slat = 0; slat < 14; slat += 1) {
        box([0.3 + (slat % 3) * 0.07, 3.8, 0.09], slat % 3 === 0 ? metal : black, [side * 8.61, 3.45, z - 4.03 + slat * 0.255])
      }
    }
  }
  // Ceiling baffles and luminous rails follow the listening axis.
  for (let z = -10; z <= 10; z += 4) {
    box([17.4, 0.3, 0.46], metal, [0, 6.86, z], 0.07)
    box([11.6, 0.024, 0.11], white, [0, 6.68, z])
    for (let x = -7; x <= 7; x += 0.55) box([0.05, 0.24, 2.9], fabric, [x, 6.99, z + 1.8])
  }
  box([4.2, 5.2, 0.16], black, [0, 2.6, 12.16], 0.12)
  for (const x of [-2.15, 2.15]) box([0.035, 5.25, 0.02], blue, [x, 2.65, 12.04])
  label('LANYIN / 声场实验室', 'A SPACE BUILT FOR LISTENING', 3.8, 0.95, [0, 5.75, 12.02], Math.PI)

  // The player screen is a model mounted inside a machined, backlit enclosure.
  box([12.55, 5.58, 0.42], metal, [0, 3.48, -11.53], 0.16)
  box([12.18, 5.22, 0.14], black, [0, 3.48, -11.24], 0.09)
  const screen = mesh(new THREE.PlaneGeometry(11.9, 4.9), new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false }), [0, 3.48, -11.15], scene)
  screen.name = 'music-main-screen'
  screen.castShadow = false
  for (const x of [-6.27, 6.27]) box([0.045, 5.28, 0.06], accent, [x, 3.48, -11.28])
  for (const y of [0.68, 6.28]) box([12.45, 0.045, 0.05], accent, [0, y, -11.34])
  box([13.2, 0.12, 1.7], black, [0, 0.11, -11.1], 0.07)
  box([12.9, 0.025, 0.045], blue, [0, 0.19, -10.24])
  label('沉 浸 聆 听', 'SOUND IS THE ARCHITECTURE', 4.8, 0.8, [0, 6.78, -12.26])

  // Speaker cones, surrounds, tweeters and cabinet feet are modeled separately.
  for (const x of [-6.1, 6.1]) {
    box([1.48, 4.25, 1.38], black, [x, 2.24, -8.35], 0.12)
    box([1.57, 0.12, 1.52], metal, [x, 0.16, -8.35], 0.05)
    box([0.035, 3.94, 0.045], blue, [x - 0.64, 2.24, -7.63])
    for (const [y, radius] of [[0.95, 0.47], [2.16, 0.47], [3.43, 0.22]]) {
      const surround = mesh(new THREE.TorusGeometry(radius, 0.065, 10, 64), fabric, [x, y, -7.63])
      surround.rotation.set(0, 0, 0)
      const cone = mesh(new THREE.ConeGeometry(radius * 0.88, 0.17, 64, 1, true), metal, [x, y, -7.67])
      cone.rotation.x = Math.PI / 2
      const cap = mesh(new THREE.SphereGeometry(radius * 0.3, 20, 12), black, [x, y, -7.58])
      cap.scale.z = 0.5
    }
    label('LANYIN', 'REFERENCE / STEREO', 1.2, 0.3, [x, 4.12, -7.635])
  }

  const concert = createConcertLights(scene)
  for (const x of [-6.9, 6.9]) {
    box([1.35, 0.65, 2.9], black, [x, 0.44, 7.1], 0.16)
    box([0.12, 0.7, 2.9], metal, [x + Math.sign(x) * 0.64, 0.95, 7.1], 0.06)
    box([1.2, 0.075, 2.75], fabric, [x, 0.81, 7.1], 0.03)
  }
  label('听 见 空 间', 'LISTEN / EXPLORE / RESONATE', 4, 1, [-8.28, 3.6, 4], Math.PI / 2)
  label('音乐，没有边界', 'YOUR MUSIC. YOUR UNIVERSE.', 4, 1, [8.27, 3.6, 4], -Math.PI / 2)

  const particlesGeometry = new THREE.BufferGeometry()
  const positions = new Float32Array(160 * 3)
  for (let index = 0; index < 160; index += 1) {
    positions[index * 3] = Math.sin(index * 13.2) * 7.8
    positions[index * 3 + 1] = 0.8 + ((index * 0.719) % 5.5)
    positions[index * 3 + 2] = Math.sin(index * 4.71) * 11
  }
  particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const particles = new THREE.Points(particlesGeometry, new THREE.PointsMaterial({ color: '#a3d5ed', size: 0.018, transparent: true, opacity: 0.45, depthWrite: false }))
  scene.add(particles)

  batchStaticGeometry(architecture)
  return { screen, reflector, accent, blue, white, concert, particles }
}

function batchStaticGeometry(group) {
  group.updateMatrixWorld(true)
  const batches = new Map()
  for (const object of [...group.children]) {
    if (!object.isMesh || object.material.transparent) continue
    const key = object.material.uuid
    const batch = batches.get(key) || { material: object.material, geometries: [] }
    const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone()
    geometry.applyMatrix4(object.matrixWorld)
    // Box and rounded-box geometries carry groups that are unnecessary here.
    geometry.clearGroups()
    batch.geometries.push(geometry)
    batches.set(key, batch)
    object.geometry.dispose()
    group.remove(object)
  }
  batches.forEach(({ material, geometries }) => {
    const merged = mergeGeometries(geometries, false)
    const object = new THREE.Mesh(merged, material)
    object.castShadow = object.receiveShadow = true
    group.add(object)
    geometries.forEach((geometry) => geometry.dispose())
  })
}
