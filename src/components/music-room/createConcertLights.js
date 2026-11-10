import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const Z_AXIS = new THREE.Vector3(0, 0, 1)
const ROW_POSITIONS = [-8, -4.7, -1.4, 1.9, 5.2, 8.5]

// Twelve real moving-head fixtures, hung on two longitudinal ceiling trusses.
export function createConcertLights(scene) {
  const rig = new THREE.Group()
  rig.name = 'ceiling-concert-lights'
  scene.add(rig)
  const housing = new THREE.MeshStandardMaterial({ color: '#19232d', roughness: 0.38, metalness: 0.75 })
  const alloy = new THREE.MeshStandardMaterial({ color: '#7c8d9c', roughness: 0.28, metalness: 0.9 })
  const mountGeometry = combine([
    [new THREE.BoxGeometry(0.62, 0.22, 0.5), [0, 0, 0]],
    [new THREE.CylinderGeometry(0.12, 0.12, 0.25, 16), [0, -0.2, 0]],
  ])
  const yokeGeometry = combine([
    [new THREE.BoxGeometry(0.79, 0.12, 0.2), [0, -0.28, 0]],
    ...[-1, 1].map((side) => [new THREE.BoxGeometry(0.11, 0.52, 0.24), [side * 0.34, -0.55, 0]]),
  ])
  const headGeometry = combine([
    [new THREE.CylinderGeometry(0.27, 0.23, 0.58, 32).rotateX(Math.PI / 2), [0, 0, 0]],
    ...[-0.2, -0.1, 0].map((z) => [new THREE.TorusGeometry(0.274, 0.021, 6, 32), [0, 0, z]]),
    [new THREE.CylinderGeometry(0.295, 0.27, 0.12, 32).rotateX(Math.PI / 2), [0, 0, 0.28]],
  ])
  const trimGeometry = combine([
    [new THREE.TorusGeometry(0.258, 0.025, 8, 32), [0, 0, 0.345]],
    ...[-1, 1].map((side) => [new THREE.CylinderGeometry(0.115, 0.115, 0.04, 16).rotateZ(Math.PI / 2), [side * 0.29, 0, 0]]),
  ])
  const lensGeometry = new THREE.SphereGeometry(0.235, 24, 12).scale(1, 1, 0.14).translate(0, 0, 0.35)
  const beamGeometry = new THREE.CylinderGeometry(0.16, 1, 1, 40, 1, true).translate(0, -0.5, 0).rotateX(-Math.PI / 2)
  const poolGeometry = new THREE.PlaneGeometry(2, 2)
  const direction = new THREE.Vector3(), origin = new THREE.Vector3(), target = new THREE.Vector3()
  const primary = new THREE.Color(), secondary = new THREE.Color(), color = new THREE.Color()
  const highlight = new THREE.Color('#e6f5ff')
  const fixtures = []

  for (const side of [-1, 1]) {
    const trussParts = []
    for (const x of [-0.22, 0.22]) {
      trussParts.push([new THREE.CylinderGeometry(0.038, 0.038, 20.2, 10).rotateX(Math.PI / 2), [side * 5.5 + x, 6.75, 0]])
    }
    for (let z = -10; z < 10; z += 0.8) {
      const diagonal = new THREE.CylinderGeometry(0.018, 0.018, Math.hypot(0.44, 0.8), 6)
      diagonal.rotateX(Math.PI / 2).rotateY(Math.atan2(0.44, 0.8) * (Math.round((z + 10) / 0.8) % 2 ? 1 : -1))
      trussParts.push([diagonal, [side * 5.5, 6.75, z + 0.4]])
    }
    for (const z of [-9, -3, 3, 9]) trussParts.push([new THREE.CylinderGeometry(0.045, 0.045, 0.4, 10), [side * 5.5, 6.94, z]])
    rig.add(new THREE.Mesh(combine(trussParts), alloy))

    ROW_POSITIONS.forEach((z, index) => {
      const mount = new THREE.Group()
      mount.name = `concert-${side < 0 ? 'left' : 'right'}-${index + 1}`
      mount.position.set(side * 5.5, 6.58, z)
      mount.add(new THREE.Mesh(mountGeometry, housing))
      const pan = new THREE.Group()
      pan.add(new THREE.Mesh(yokeGeometry, housing))
      const head = new THREE.Group()
      head.position.y = -0.67
      head.add(new THREE.Mesh(headGeometry, housing), new THREE.Mesh(trimGeometry, alloy))
      const lens = new THREE.MeshStandardMaterial({ color: '#09121c', emissive: '#80e9ff', emissiveIntensity: 0, metalness: 0.25, roughness: 0.16 })
      head.add(new THREE.Mesh(lensGeometry, lens))
      pan.add(head); mount.add(pan); rig.add(mount)

      const spot = new THREE.SpotLight('#80e9ff', 0, 17, 0.145, 0.75, 1.5)
      // The beams use no per-fixture shadow maps: all twelve can move smoothly.
      rig.add(spot, spot.target)
      const beamMaterial = new THREE.ShaderMaterial({
        uniforms: { tint: { value: new THREE.Color() }, strength: { value: 0 } },
        transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
        vertexShader: `varying vec2 vUv; varying vec3 vView; varying vec3 vNormal;
          void main() { vUv = uv; vec4 view = modelViewMatrix * vec4(position, 1.0);
            vView = -view.xyz; vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * view; }`,
        fragmentShader: `uniform vec3 tint; uniform float strength;
          varying vec2 vUv; varying vec3 vView; varying vec3 vNormal;
          void main() { float facing = abs(dot(normalize(vNormal), normalize(vView)));
            float edge = pow(smoothstep(0.0, 0.85, facing), 2.0);
            float falloff = mix(0.10, 1.0, pow(vUv.y, 0.65));
            gl_FragColor = vec4(tint, strength * edge * falloff);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      })
      const beam = new THREE.Mesh(beamGeometry, beamMaterial)
      beam.name = `${mount.name}-beam`
      const poolMaterial = new THREE.ShaderMaterial({
        uniforms: { tint: { value: new THREE.Color() }, strength: { value: 0 } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 tint; uniform float strength; varying vec2 vUv;
          void main() { float r = length(vUv - 0.5) * 2.0;
            float glow = exp(-r * r * 3.5) * (1.0 - smoothstep(0.65, 1.0, r));
            gl_FragColor = vec4(tint, strength * glow);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      })
      const pool = new THREE.Mesh(poolGeometry, poolMaterial)
      pool.rotation.x = -Math.PI / 2
      rig.add(beam, pool)
      fixtures.push({ side, index, z, mount, pan, head, lens, spot, beam, pool })
    })
  }

  function update(state, theme, reducedMotion, commands) {
    primary.set(theme.primary); secondary.set(theme.secondary)
    const animated = state.live && !reducedMotion
    const phrase = Math.floor(state.beats / 4)
    fixtures.forEach((fixture,fixtureIndex) => {
      const { side, index, z, pan, head, lens, spot, beam, pool } = fixture
      const phase = animated ? state.phase : 0
      const sweep = Math.sin(phase + index * 0.48)
      const reach = animated ? 3.1 + sweep * (0.7 + state.energy * 1.6) : 3.2
      target.set(side * (5.5 - reach), 0.04, THREE.MathUtils.clamp(z - 0.6 + (animated ? Math.cos(phase * 0.7 + index * 0.6) * 1.7 : 0), -9.6, 9.7))
      const command=commands?.[fixtureIndex]
      if(command){target.set(command.x,command.y,command.z);spot.angle=command.angle}
      direction.set(target.x - side * 5.5, target.y - 5.91, target.z - z)
      pan.rotation.y = Math.atan2(direction.x, direction.z)
      head.rotation.x = Math.atan2(-direction.y, Math.hypot(direction.x, direction.z))
      head.updateWorldMatrix(true, false)
      origin.set(0, 0, 0.385).applyMatrix4(head.matrixWorld)
      direction.subVectors(target, origin)
      const distance = direction.length()
      if(command)spot.distance=Math.max(17,distance+2)
      direction.normalize()
      const chasing = (index + (side > 0 ? 1 : 0)) % 3 === state.beats % 3
      const intensity = command?.intensity ?? state.power * (animated
        ? Math.min(1.4, state.energy * 1.4 + state.bass * 0.35 + state.pulse * (chasing ? 0.85 : 0.24))
        : 0.48)
      const mix = command?.mix ?? ((index + (side > 0 ? 1 : 0) + phrase) % 2) * 0.85
      color.copy(primary).lerp(secondary, mix)
      if(command){color.offsetHSL(command.hue,0,0);color.lerp(highlight,command.white)}
      else if (animated) color.lerp(highlight, state.pulse * state.treble * 0.3)
      lens.emissive.copy(color); lens.emissiveIntensity = intensity * 5
      spot.color.copy(color); spot.intensity = intensity * 100
      spot.position.copy(origin); spot.target.position.copy(target)
      beam.position.copy(origin); beam.quaternion.setFromUnitVectors(Z_AXIS, direction)
      const radius = Math.tan(spot.angle) * distance
      beam.scale.set(radius, radius, distance)
      beam.visible = pool.visible = intensity > 0.004
      beam.material.uniforms.tint.value.copy(color)
      beam.material.uniforms.strength.value = intensity * 0.20
      pool.position.copy(target)
      pool.scale.set(radius, radius / Math.abs(direction.y), 1)
      pool.rotation.z = -Math.atan2(direction.x, direction.z)
      pool.material.uniforms.tint.value.copy(color)
      pool.material.uniforms.strength.value = intensity * 0.38
    })
  }

  function setQuality(quality) {
    // Keep the light count stable across play/pause. Changing visibility changes
    // every lit material's shader; intensity can fade without recompiling it.
    fixtures.forEach(({ spot, index }) => {
      spot.visible = quality === 'smooth' ? index === 2 : quality === 'balanced' ? index % 3 === 1 : true
    })
  }

  return { update, fixtures, setQuality }
}

function combine(parts) {
  const geometries = parts.map(([geometry, position]) => {
    const flat = geometry.toNonIndexed()
    flat.translate(...position); flat.clearGroups()
    geometry.dispose()
    return flat
  })
  const geometry = mergeGeometries(geometries, false)
  geometries.forEach((part) => part.dispose())
  return geometry
}
