import * as THREE from 'three'
const OPENING = { intro: .08, verse: .35, chorus: 1, bridge: .2, outro: .06, ambient: .35 }
export function createPerformanceStage(scene) {
  const root = new THREE.Group(); root.name = 'articulated-performance-stage'; scene.add(root)
  const graphite = new THREE.MeshStandardMaterial({ color: '#172330', metalness: .75, roughness: .34 })
  const edge = new THREE.MeshStandardMaterial({ color: '#92dce4', emissive: '#80d9df', emissiveIntensity: .3, metalness: .3 })
  const hinges = [], wings = []
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    const hinge = new THREE.Group(); hinge.position.set(side * (7.1 + i * 1.9), 4.5, -19.95); root.add(hinge)
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.65, 6.5, .17), graphite); wing.position.x = side * .7; hinge.add(wing)
    for (const x of [-.06, 1.46]) { const strip = new THREE.Mesh(new THREE.BoxGeometry(.035, 6.35, .025), edge); strip.position.set(side * x, 0, .1); hinge.add(strip) }
    for (const y of [-3, 3]) { const hub = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .25, 20), graphite); hub.position.y = y; hinge.add(hub) }
    hinges.push({ hinge, side, index: i }); wings.push(wing)
  }
  const crown = new THREE.Group(); crown.position.set(0, 7.5, -20); root.add(crown)
  const blade = new THREE.Mesh(new THREE.BoxGeometry(12.8, .28, 1.1), graphite); blade.position.z = .55; crown.add(blade)
  const light = new THREE.Mesh(new THREE.BoxGeometry(12.5, .035, .04), edge); light.position.set(0, -.16, 1.08); crown.add(light)
  let opening = .35
  return {
    update(dt, section, state, palette, reducedMotion) {
      const target = state.power > .01 ? OPENING[section?.type] ?? .35 : .18
      opening = reducedMotion ? target : opening + (target - opening) * (1 - Math.exp(-dt * 1.25))
      hinges.forEach(({ hinge, side, index }) => { hinge.rotation.y = side * (opening * (1.02 + index * .13)) })
      crown.rotation.x = -opening * .55
      edge.emissive.set(palette.primary); edge.emissiveIntensity = .12 + state.power * (.3 + opening * .8 + state.pulse * .18)
      return Math.abs(target - opening) > .001
    },
    getState: () => ({ opening, hinges: hinges.map(({ hinge }) => hinge.rotation.y) }),
  }
}
