import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import basisWrapperUrl from 'three/addons/libs/basis/basis_transcoder.js?url'
import basisWasmUrl from 'three/addons/libs/basis/basis_transcoder.wasm?url'
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js'
import { createFantasyQueenSpringBones } from './fantasyQueenSpringBones.js'

const CLIPS = { idle: 'Idle', walk: 'Walk_InPlace', run: 'Walk_InPlace', sit: 'Sit', jump: 'Jump' }

// Share the mesh and texture within a world; each person owns their skeleton/mixer.
export async function loadFantasyQueen(renderer, onProgress) {
  // Vite owns decoder URLs in both web and desktop builds, without a second public copy.
  const decoderFiles = new Map([['basis/basis_transcoder.js', basisWrapperUrl], ['basis/basis_transcoder.wasm', basisWasmUrl]])
  const decoderManager = new THREE.LoadingManager().setURLModifier(url => decoderFiles.get(url) || url)
  const ktx2 = new KTX2Loader(decoderManager)
    .setTranscoderPath('basis/')
    .setWorkerLimit(1)
    .detectSupport(renderer)
  let gltf
  try {
    gltf = await new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .setKTX2Loader(ktx2)
      .loadAsync(`${import.meta.env.BASE_URL}models/Fantasy_Queen_Walk.glb?v=meshopt-ktx2-1`, onProgress)
  } finally {
    // Clones share the decoded texture, so no transcoder worker is needed after loading.
    if (ktx2.transcoderPending) ktx2.dispose()
  }
  const geometries = new Set(), materials = new Set(), textures = new Set()
  gltf.scene.traverse(object => {
    if (!object.isMesh) return
    geometries.add(object.geometry)
    object.castShadow = false
    object.receiveShadow = true
    object.frustumCulled = false // Animated skirts/limbs exceed the rest-pose bounds.
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material)
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value)
    }
  })
  const clips = new Map(gltf.animations.map(clip => [clip.name, clip]))
  let disposed = false
  function dispose() {
    if (disposed) return
    disposed = true
    geometries.forEach(geometry => geometry.dispose())
    materials.forEach(material => material.dispose())
    textures.forEach(texture => texture.dispose())
    gltf.scene.traverse(object => { if (object.isSkinnedMesh) object.skeleton.dispose() })
  }
  for (const name of new Set(Object.values(CLIPS))) {
    if (!clips.has(name)) { dispose(); throw new Error(`Fantasy Queen 缺少 ${name} 动画`) }
  }
  return {
    dispose,
    create() {
      if (disposed) throw new Error('Fantasy Queen 已释放')
      const root = new THREE.Group(), model = cloneSkeleton(gltf.scene)
      root.name = 'fantasy-queen'
      root.add(model)
      const mixer = new THREE.AnimationMixer(model)
      const actions = new Map([...clips].map(([name, clip]) => {
        const action = mixer.clipAction(clip).play()
        action.setEffectiveWeight(name === 'Idle' ? 1 : 0)
        return [name, action]
      }))
      const head = model.getObjectByName('Head'), headPosition = new THREE.Vector3()
      const springBones = createFantasyQueenSpringBones(model)
      let motion = 'idle', active = true
      mixer.update(0)
      return {
        root,
        pose(nextMotion = 'idle', delta = 0, clock = 0, reducedMotion = false, speed, sitBlend) {
          if (!active) return false
          motion = Object.hasOwn(CLIPS, nextMotion) ? nextMotion : 'idle'
          const target = CLIPS[motion], blend = reducedMotion || !delta ? 1 : 1 - Math.exp(-delta * 14)
          let settling = false
          for (const [name, action] of actions) {
            const seating=Number.isFinite(sitBlend)
            const amount=seating?THREE.MathUtils.clamp(sitBlend,0,1):0
            const desired = seating ? name==='Sit'?amount:name==='Idle'?1-amount:0 : name === target ? 1 : 0
            const weight = seating?desired:THREE.MathUtils.lerp(action.getEffectiveWeight(), desired, blend)
            const close = Math.abs(weight - desired) < .001
            action.setEffectiveWeight(close ? desired : weight)
            settling ||= !close
          }
          const moving=motion==='walk'||motion==='run'
          actions.get('Walk_InPlace').setEffectiveTimeScale(moving&&Number.isFinite(speed)?THREE.MathUtils.clamp(speed/3.8,.2,2.2):motion==='run'?1.65:1)
          mixer.update(delta)
          const springing = springBones.update(delta, reducedMotion)
          return settling || springing || motion === 'walk' || motion === 'run'
        },
        labelHeight() {
          root.updateMatrixWorld(true)
          return head ? root.worldToLocal(head.getWorldPosition(headPosition)).y + .36 : 2
        },
        getState: () => ({ model: 'Fantasy_Queen_Walk', motion, springBones: springBones.count }),
        dispose() {
          if (!active) return
          active = false
          root.removeFromParent()
          mixer.stopAllAction()
          mixer.uncacheRoot(model)
          model.traverse(object => { if (object.isSkinnedMesh) object.skeleton.dispose() })
        },
      }
    },
  }
}
