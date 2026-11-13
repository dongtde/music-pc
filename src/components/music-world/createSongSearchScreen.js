import * as THREE from 'three'

export function createSongSearchScreen() {
  // The projected search interface stays on this plane, including while walking.
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.76, 1.76), new THREE.MeshBasicMaterial({ color: '#0c1b2b', toneMapped: false }))
  mesh.name = 'world-song-search'
  mesh.userData = { action: 'song-search-open', hint: '歌曲搜索 · 输入歌名或歌手' }
  return { mesh, dispose() { mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose() } }
}
