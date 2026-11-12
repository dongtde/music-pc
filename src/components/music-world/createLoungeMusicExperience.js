import { createCoverSurface, makeSign } from './worldTextures.js'

// Use the world's existing render loop. The static shell stays frozen.
export function createLoungeMusicMotion(root) {
  const parts = []
  root.traverse(object => {
    if (object.userData.musicMotion) {
      parts.push({ object, kind: object.userData.musicMotion, rest: object.rotation.z })
      object.traverse(child => { if (child.isMesh) child.castShadow = child.receiveShadow = false })
    }
  })
  let level = 0
  return {
    update(delta, state, { playing = false, reducedMotion = false } = {}) {
      const dt = Math.max(0, Math.min(.1, delta))
      const target = state.live && !reducedMotion ? Math.min(1, Math.max(0, state.energy * 1.3 + state.pulse * .2)) : 0
      level = reducedMotion ? 0 : level + (target - level) * (1 - Math.exp(-dt * (target > level ? 18 : 9)))
      if (Math.abs(target - level) < .0005) level = target
      let moving = false
      for (const { object, kind, rest } of parts) {
        if (kind === 'needle') {
          const angle = rest - level * 1.4
          if (object.rotation.z !== angle) { object.rotation.z = angle; object.updateMatrix(); moving = true }
        } else if (playing && !reducedMotion && dt > 0) {
          const axis = kind === 'record' ? 'y' : 'z', speed = kind === 'record' ? -Math.PI * 10 / 9 : -1.3
          object.rotation[axis] = (object.rotation[axis] + dt * speed) % (Math.PI * 2)
          object.updateMatrix(); moving = true
        }
      }
      return moving || level !== target
    },
  }
}

export function createLoungeMusicExperience(root, invalidate) {
  const motion = createLoungeMusicMotion(root), labels = [], anchors = []
  let cover
  root.traverse(object => { if (object.userData.musicLabel || object.userData.musicCover) anchors.push(object) })
  for (const anchor of anchors) {
    if (anchor.userData.musicLabel) {
      const label = makeSign(anchor.userData.musicLabel, anchor.userData.musicSubtitle, .94)
      anchor.add(label); labels.push(label)
    } else {
      cover = createCoverSurface(invalidate, { caption: false })
      cover.mesh.scale.setScalar(.91 / 1.76); anchor.add(cover.mesh)
    }
  }
  return {
    update(delta, state, reducedMotion, playback = {}) {
      if (cover) {
        cover.mesh.visible = Boolean(playback.track?.coverUrl)
        if (cover.mesh.visible) cover.update(playback.track, 0)
      }
      return motion.update(delta, state, { playing: playback.playing, reducedMotion })
    },
    dispose() {
      for (const label of labels) label.material.map.dispose()
      cover?.dispose()
      // Geometry and materials remain under root and are freed by shell teardown.
    },
  }
}
