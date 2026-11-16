import * as THREE from 'three'

export function createMvScreen() {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.76, 1.76), new THREE.MeshBasicMaterial({ color: '#081d2a', toneMapped: false }))
  mesh.name = 'world-mv-screen'
  mesh.userData = { action: 'mv-open', hint: 'MV' }
  return { mesh, dispose() { mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose() } }
}
