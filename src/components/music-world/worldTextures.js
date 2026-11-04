import * as THREE from 'three'

export function materialTexture(kind) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256
  const ctx = canvas.getContext('2d'), data = ctx.createImageData(256, 256)
  let seed = 98173
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    const noise = (seed / 4294967296 - .5)
    const grain = kind === 'wood' ? Math.sin(x * .36 + Math.sin(y * .026) * 1.8) * 20 + noise * 14
      : kind === 'fabric' ? ((x % 4 < 2 ? 1 : -1) + (y % 4 < 2 ? 1 : -1)) * 17 + noise * 12
        : kind === 'metal' ? noise * 7 + Math.sin(y * 3) * 10 : noise * 28
    const at = (y * 256 + x) * 4
    data.data[at] = data.data[at + 1] = data.data[at + 2] = 170 + grain
    data.data[at + 3] = 255
  }
  ctx.putImageData(data, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(kind === 'stone' ? 2 : 3, kind === 'wood' ? 1 : 3)
  return texture
}

export function makeSign(text, sub, width = 4) {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256
  const ctx = canvas.getContext('2d')
  ctx.textAlign = 'center'; ctx.fillStyle = '#e3d5b9'; ctx.font = '22px Bahnschrift, sans-serif'; ctx.fillText(sub, 512, 60)
  ctx.fillStyle = '#ecf3f3'; ctx.font = '52px "Microsoft YaHei", sans-serif'; ctx.fillText(text, 512, 153)
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace
  return new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }))
}

export function createCoverSurface(onUpdate, {caption=true}={}) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512
  const ctx = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.76, 1.76), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }))
  let key = '', image = null, disposed = false
  function update(item, index) {
    const next = [item?.id, item?.coverUrl, item?.name, item?.title].join('|')
    if (key === next) return
    key = next
    if (image) image.onload = image.onerror = null
    const draw = (art) => {
      if (disposed || key !== next) return
      ctx.fillStyle = ['#253b45', '#453c36', '#2c3b45', '#344140'][index % 4]; ctx.fillRect(0, 0, 512, 512)
      if (art) {
        const scale = Math.max(512 / art.width, 512 / art.height)
        ctx.drawImage(art, (512 - art.width * scale) / 2, (512 - art.height * scale) / 2, art.width * scale, art.height * scale)
      } else {
        ctx.strokeStyle = '#9cbdba44'
        for (let r = 20; r < 220; r += 10) { ctx.beginPath(); ctx.ellipse(256, 220, r, r * .7, -.4, 0, Math.PI * 2); ctx.stroke() }
        ctx.fillStyle = '#d1be9780'; ctx.font = '18px Bahnschrift'; ctx.fillText('LANYIN / RECORD ARCHIVE', 28, 40)
      }
      if(caption || !art){
      const gradient = ctx.createLinearGradient(0, 300, 0, 512); gradient.addColorStop(0, 'transparent'); gradient.addColorStop(1, '#061119ef')
      ctx.fillStyle = gradient; ctx.fillRect(0, 300, 512, 212)
      ctx.fillStyle = '#ffffff'; ctx.font = '30px "Microsoft YaHei", sans-serif'; ctx.fillText(item?.name || item?.title || '等待下一张唱片', 28, 451, 454)
      ctx.fillStyle = '#c8d8de'; ctx.font = '18px "Microsoft YaHei", sans-serif'; ctx.fillText(item?.artist || item?.description || '在这里收藏你的音乐', 28, 485, 454)
      }
      texture.needsUpdate = true; onUpdate()
    }
    draw(null)
    if (item?.coverUrl) { image = new Image(); image.crossOrigin = 'anonymous'; image.onload = () => draw(image); image.src = item.coverUrl }
  }
  return { mesh, update, dispose() { disposed = true; if (image) { image.onload = image.onerror = null; image.src = '' }; texture.dispose() } }
}
