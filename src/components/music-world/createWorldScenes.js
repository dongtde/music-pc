import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { getWorldScene } from './worldScenes.js'
import { optimizeWorldMaterials } from './optimizeWorldMaterials.js'
import { createSkyLounge } from './createSkyLounge.js'

function disposeTree(root){
  const materials=new Set(),geometries=new Set()
  root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material)})
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose())
}

function createRain(){
  const count=850,positions=[],offsets=[],seeds=[]
  let random=73127
  const next=()=>{random=(random*1664525+1013904223)>>>0;return random/4294967296}
  for(let i=0;i<count;i++){
    const x=(i%2?1:-1)*(15.4+next()*14),z=(next()-.5)*48,seed=next()
    for(let end=0;end<2;end++){positions.push(x,0,z);offsets.push(end*.28);seeds.push(seed)}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('fallOffset',new THREE.Float32BufferAttribute(offsets,1));geometry.setAttribute('seed',new THREE.Float32BufferAttribute(seeds,1))
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:{value:0}},vertexShader:`attribute float fallOffset;attribute float seed;uniform float time;void main(){vec3 p=position;p.y=mod(seed*17.-time*8.,17.)+1.5-fallOffset;p.x+=fallOffset*.18;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`void main(){gl_FragColor=vec4(.46,.72,.86,.23);#include <colorspace_fragment>}`.replace(';#include',';\n#include')})
  const rain=new THREE.LineSegments(geometry,material);rain.name='rain-outside-the-pavilion';rain.frustumCulled=false
  return rain
}

export function createWorldScenes({scene,pavilion,renderer,ambient,sun,practicals,concert,onChange,onInvalidate,loadAsset}){
  const original=pavilion.getObjectByName('pavilion-shell'),equipment=pavilion.getObjectByName('pavilion-equipment')
  if(!original||!equipment)throw new Error('Music pavilion scene groups are missing')
  const loader=loadAsset||((file)=>new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/${file}`))
  const assets=new Map(),requests=new Map(),originalColors=new Map()
  const originalEnvironment=scene.environment,originalSunPosition=sun.position.clone()
  let skyLounge,quality='balanced'
  let active=getWorldScene('rain'),revision=0,disposed=false,weatherTime=0
  equipment.traverse(o=>{
    if(!o.isMesh)return
    for(const material of Array.isArray(o.material)?o.material:[o.material]){
      if(material?.color&&!originalColors.has(material))originalColors.set(material,material.color.clone())
    }
  })
  const rain=createRain();scene.add(rain)
  function apply(config,asset){
    original.visible=config.id==='rain'
    assets.forEach(group=>{group.visible=false})
    if(asset){asset.visible=true;if(!asset.parent)scene.add(asset)}
    active=config;rain.visible=config.id==='rain'
    concert?.setLayout(config.id)
    scene.background.set(config.background);scene.fog.color.set(config.fog);scene.fog.density=config.fogDensity??(config.id==='studio'?.007:.012)
    scene.environment=config.id==='sky-lounge'?skyLounge.environment:originalEnvironment
    scene.environmentIntensity=config.environment;renderer.toneMappingExposure=config.exposure
    ambient.color.set(config.ambientColor||(config.id==='studio'?'#ffe0b7':'#bfdaed'));ambient.groundColor.set(config.groundColor||(config.id==='studio'?'#493523':'#20233d'))
    sun.color.set(config.sunColor||(config.id==='studio'?'#ffdab0':'#9ebff5'));sun.intensity=config.sun
    if(config.sunPosition)sun.position.fromArray(config.sunPosition);else sun.position.copy(originalSunPosition)
    practicals.forEach(light=>{light.color.set(config.practicalColor||(config.id==='studio'?'#ffd293':config.palette.primary));light.intensity=38*config.practical})
    originalColors.forEach((color,mat)=>mat.color.copy(color).set(config.materials[mat.name]||color))
    skyLounge?.setActive(config.id==='sky-lounge')
    scene.environmentRotation.y=config.id==='sky-lounge'?Math.PI*.55:0
    renderer.shadowMap.needsUpdate=true
    onChange?.({scene:config.id,sceneLoading:false,scenePending:'',sceneError:''})
  }
  apply(active)
  async function select(id){
    const config=getWorldScene(id),request=++revision
    if(disposed)return false
    if(config.id===active.id){onChange?.({sceneLoading:false,scenePending:''});return true}
    onChange?.({sceneLoading:true,scenePending:config.id,sceneError:''})
    try{
      let asset
      if(config.asset){
        if(!requests.has(config.id))requests.set(config.id,loader(config.asset).then(async result=>{
          const group=result.scene||result
          if(disposed){disposeTree(group);throw new DOMException('World closed','AbortError')}
          group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}})
          if(config.id==='sky-lounge'){
            let prepared
            try{prepared=await createSkyLounge({root:group,pavilion,renderer,quality,onUpdate:onInvalidate,isDisposed:()=>disposed})}catch(error){disposeTree(group);throw error}
            if(disposed){prepared.dispose();disposeTree(group);throw new DOMException('World closed','AbortError')}
            skyLounge=prepared;skyLounge.setQuality(quality)
          }
          optimizeWorldMaterials(group);group.visible=false;assets.set(config.id,group);return group
        }).catch(error=>{requests.delete(config.id);throw error}))
        asset=await requests.get(config.id)
      }
      if(disposed||request!==revision)return false
      apply(config,asset);return true
    }catch(error){
      if(!disposed&&request===revision)onChange?.({sceneLoading:false,scenePending:'',sceneError:'场景暂时无法加载，当前音乐和空间仍可继续使用。'})
      return false
    }
  }
  return {
    select,
    setQuality(value){quality=value;skyLounge?.setQuality(value)},
    getConfig:()=>active,
    update(dt,state,reducedMotion){
      ambient.intensity=active.ambient*(1-state.power*.3)
      const moving=active.id==='rain'&&state.power>.01&&!reducedMotion
      if(moving)weatherTime+=dt
      rain.material.uniforms.time.value=weatherTime
      return moving
    },
    getState:()=>({id:active.id,loaded:[...assets.keys()],rain:rain.visible,activeShell:active.id==='rain'?original.name:assets.get(active.id)?.name,skyLounge:skyLounge?.getState()}),
    dispose(){disposed=true;revision++;scene.environment=originalEnvironment;skyLounge?.dispose();rain.removeFromParent();rain.geometry.dispose();rain.material.dispose();assets.forEach(group=>{group.removeFromParent();disposeTree(group)});assets.clear()},
  }
}
