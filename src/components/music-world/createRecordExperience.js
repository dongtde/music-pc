import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { createCoverSurface } from './worldTextures'

const ease = t => t*t*(3-2*t)

function release(object) {
  object.removeFromParent()
  const geometries=new Set(),materials=new Set()
  object.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material)})
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose())
}

function vinyl(item, invalidate) {
  const object=new THREE.Group(),art=createCoverSurface(invalidate,{caption:false})
  art.update(item,0)
  const rubber=new THREE.MeshPhysicalMaterial({color:'#111519',metalness:.24,roughness:.28,clearcoat:.6,clearcoatRoughness:.2})
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.675,.675,.016,96),rubber)
  object.add(body)
  const rings=[]
  for(let r=.245;r<.665;r+=.009)rings.push(new THREE.TorusGeometry(r,.0013,3,80).rotateX(Math.PI/2).translate(0,.009,0))
  object.add(new THREE.Mesh(mergeGeometries(rings),new THREE.MeshStandardMaterial({color:'#333d43',metalness:.65,roughness:.36})))
  rings.forEach(g=>g.dispose())
  const label=new THREE.Mesh(new THREE.CircleGeometry(.22,64),new THREE.MeshStandardMaterial({map:art.mesh.material.map,roughness:.65,metalness:.02}))
  label.rotation.x=-Math.PI/2;label.position.y=.010;object.add(label)
  const hole=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.021,16),new THREE.MeshStandardMaterial({color:'#080d11',roughness:1}));object.add(hole)
  return {object,dispose(){release(object);art.dispose();release(art.mesh)}}
}

export function createRecordExperience({camera,invalidate,onChange}) {
  let inspection=null,disposed=false
  function dismiss() {
    if(!inspection)return
    const old=inspection;inspection=null
    if(old.source)old.source.visible=true
    old.disc.dispose();old.art.dispose();release(old.art.mesh);release(old.object)
    onChange?.({inspecting:false});if(!disposed)invalidate()
  }
  function inspect(item,source) {
    dismiss()
    const object=new THREE.Group(),art=createCoverSurface(invalidate,{caption:false}),disc=vinyl(item,invalidate)
    art.update(item,0);art.mesh.scale.setScalar(.80);art.mesh.position.set(-.2,0,.03)
    object.add(new THREE.Mesh(new THREE.BoxGeometry(1.43,1.43,.055),new THREE.MeshStandardMaterial({color:'#d4ccba',roughness:.8})))
    object.children[0].position.x=-.2;object.add(art.mesh)
    disc.object.rotation.x=Math.PI/2;disc.object.position.set(.32,.03,-.018);object.add(disc.object)
    camera.add(object)
    const target=camera.aspect<1?new THREE.Vector3(0,.42,-3.2):new THREE.Vector3(.32,.08,-2.3),from=target.clone().add(new THREE.Vector3(0,-.22,-.6))
    if(source){source.getWorldPosition(from);camera.worldToLocal(from);source.visible=false}
    object.position.copy(from);object.rotation.set(-.08,-.15,-.045)
    inspection={object,art,disc,source,from,target,elapsed:0,item}
    onChange?.({inspecting:true});invalidate()
  }
  function update(dt,lighting,reducedMotion) {
    if(disposed||!inspection)return false
    inspection.elapsed=Math.min(1,inspection.elapsed+dt/.6)
    inspection.object.position.lerpVectors(inspection.from,inspection.target,reducedMotion?1:ease(inspection.elapsed))
    return !reducedMotion&&inspection.elapsed<1
  }
  return {inspect,dismiss,update,
    resize(){if(inspection)inspection.target.copy(camera.aspect<1?new THREE.Vector3(0,.42,-3.2):new THREE.Vector3(.32,.08,-2.3))},
    getState:()=>({trackId:inspection?.item?.id,inspecting:Boolean(inspection)}),
    dispose(){disposed=true;dismiss()},
  }
}
