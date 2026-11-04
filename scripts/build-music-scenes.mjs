import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries,mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { mkdir,writeFile } from 'node:fs/promises'

globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(data=>{this.result=data;this.onloadend?.()})}}
const material=(name,color,roughness=.7,metalness=0,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness,metalness,...extra});m.name=name;return m}
const wood=material('studio-oak','#806046'),felt=material('studio-felt','#564638',.95),brick=material('studio-brick','#826653'),cream=material('studio-plaster','#aa9b82',.95)
const dark=material('scene-graphite','#111823',.48,.55),metal=material('scene-metal','#53677b',.3,.85),gold=material('scene-brass','#b6a179',.4,.75)
const amber=material('studio-light','#ffdc9f',.4,.15,{emissive:'#ffc476',emissiveIntensity:1.8})
const cyan=material('stage-light','#329faf',.4,.45,{emissive:'#42e7ed',emissiveIntensity:1.1})
const violet=material('stage-violet','#69669a',.4,.5,{emissive:'#9380f5',emissiveIntensity:.6})
const carbon=material('stage-carbon','#101820',.42,.4)

function builder(name){
 const root=new THREE.Group();root.name=name
 const add=(geometry,mat,pos=[0,0,0])=>{const m=new THREE.Mesh(geometry,mat);m.position.fromArray(pos);root.add(m);return m}
 const box=(s,m,p,r=0)=>add(r?new RoundedBoxGeometry(...s,1,r):new THREE.BoxGeometry(...s),m,p)
 const cylinder=(r,h,m,p)=>add(new THREE.CylinderGeometry(r,r,h,32),m,p)
 const beam=(a,b,r,m)=>{const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),mesh=cylinder(r,start.distanceTo(end),m,start.clone().add(end).multiplyScalar(.5).toArray());mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());return mesh}
 return{root,add,box,cylinder,beam}
}

function makeStudio(){
 const {root,add,box,cylinder,beam}=builder('vinyl-studio-shell')
 box([31,.22,43],wood,[0,-.09,0])
 for(let x=-15;x<15;x+=.6)for(let z=-21;z<21;z+=4.2)box([.585,.025,4.18],wood,[x+.3,.038,z+2.1+(Math.round(x/.6)%2)*.4])
 for(const side of [-1,1]){
  box([.3,8.5,43],brick,[side*15,4.25,0])
  for(let z=-20;z<21;z+=4){
   box([.15,2.5,3.65],felt,[side*14.79,3.25,z],.04)
   for(let i=0;i<16;i++)box([.16+(i%3)*.035,2.45,.035],wood,[side*14.68,3.25,z-1.65+i*.22])
   box([.08,1.15,2.7],amber,[side*14.76,6.3,z],.025)
   for(const dz of [-1.4,0,1.4])box([.14,1.35,.065],gold,[side*14.62,6.3,z+dz])
  }
  box([.14,.1,42],amber,[side*14.7,7.9,0])
 }
 box([30,8.5,.3],wood,[0,4.25,-20.6])
 box([30,8.5,.3],brick,[0,4.25,21])
 for(const side of [-1,1])for(let i=0;i<22;i++)box([.16,6.3,.18+(i%5)*.06],felt,[side*(7.1+i*.35),3.4,-20.32])
 box([30,.18,42.5],cream,[0,8.4,0])
 for(let z=-19;z<=21;z+=4){
  box([30,.45,.3],wood,[0,8.06,z],.04)
  for(let x=-12;x<=12;x+=6){box([4.5,.12,2.8],felt,[x,8.05,z-1.8],.045);box([2.8,.025,.035],amber,[x,7.97,z-1.8])}
 }
 for(const x of [-5.5,5.5])for(const z of [-9,-3,3,9])beam([x,6.9,z],[x,8.4,z],.023,metal)
 box([8,.025,4.5],felt,[0,.065,-9.1],.025)
 for(let x=-3.8;x<=3.8;x+=.16)box([.024,.005,4.2],wood,[x,.081,-9.1])
 // Wall-mounted reel decks: spools, tape path, controls and a metal front panel.
 for(const side of [-1,1]){
  const group=new THREE.Group();group.name=`studio-reel-deck-${side}`;group.position.set(side*14.6,4.4,11);group.rotation.y=side<0?Math.PI/2:-Math.PI/2;root.add(group)
  const parts=[];const local=(mesh)=>{root.remove(mesh);group.add(mesh);parts.push(mesh);return mesh}
  local(box([2.1,2.35,.24],dark,[0,0,0],.08));local(box([1.95,2.2,.035],metal,[0,0,.14],.035))
  for(const x of [-.56,.56]){
   const reel=local(cylinder(.42,.045,gold,[x,.48,.23]));reel.rotation.x=Math.PI/2
   for(let i=0;i<3;i++){const a=i*Math.PI*2/3;const hole=local(cylinder(.105,.05,dark,[x+Math.cos(a)*.21,.48+Math.sin(a)*.21,.26]));hole.rotation.x=Math.PI/2}
   const hub=local(cylinder(.08,.08,metal,[x,.48,.29]));hub.rotation.x=Math.PI/2
  }
  local(box([1.4,.025,.025],dark,[0,-.1,.24]))
  for(const x of [-.5,-.2,.2,.5]){const knob=local(cylinder(.065,.08,dark,[x,-.77,.22]));knob.rotation.x=Math.PI/2}
  for(const x of [-.4,.4])local(box([.46,.25,.035],amber,[x,-.4,.18],.025))
 }
 return root
}

function makeStage(){
 const {root,add,box,beam}=builder('future-live-shell')
 box([31,.3,43],carbon,[0,-.12,0])
 for(let x=-14;x<=14;x+=2)for(let z=-20;z<=20;z+=2){box([1.98,.02,1.98],dark,[x,.042,z]);if((x+z)%6===0)box([.32,.025,.02],metal,[x,.06,z-.9])}
 box([30,10,.3],carbon,[0,5,-20.6]);box([30,10,.3],carbon,[0,5,21])
 for(const side of [-1,1]){
  box([.35,10,42],carbon,[side*15,5,0])
  for(let z=-18;z<=20;z+=4.5){
   box([.4,6.8,2.4],dark,[side*14.7,3.6,z],.1)
   box([.06,5.5,.04],cyan,[side*14.42,3.8,z-1.2])
   for(let i=0;i<5;i++)box([.06,.03,2.2],metal,[side*14.4,1.4+i*.9,z])
  }
 }
 box([30,.2,42],carbon,[0,10.15,0])
 // Faceted proscenium portals form a full architectural volume around the stage.
 for(const z of [-18,-11,-4,3,10,17]){
  const points=[[-14.5,.1,z],[-14.5,6.1,z],[-10.5,9.4,z],[10.5,9.4,z],[14.5,6.1,z],[14.5,.1,z]]
  for(let i=0;i<points.length-1;i++){
   beam(points[i],points[i+1],.12,metal)
   const a=[...points[i]],b=[...points[i+1]];a[2]+=.13;b[2]+=.13;beam(a,b,.025,z%2?cyan:violet)
  }
 }
 for(const x of [-5.5,5.5])for(const z of [-9,-3,3,9])beam([x,6.9,z],[x,9.9,z],.026,metal)
 for(const side of [-1,1]){
  box([6.5,.12,1.6],dark,[side*10.6,.13,-19.5],.05)
  for(let i=0;i<8;i++)box([.36,5.8,.1],metal,[side*(7.8+i*.72),3.6,-20.3],.025)
  // Angled acoustic wings frame the shared music screen, leaving the walkways clear.
  for(let i=0;i<5;i++){const panel=box([.22,7.5,.65],dark,[side*(7.25+i*1.35),4.1,-20.05],.025);panel.rotation.z=side*-.07}
 }
 return root
}

async function save(root,file){
 root.updateMatrixWorld(true);const batches=new Map(),meshes=[]
 root.traverse(o=>{if(!o.isMesh)return;meshes.push(o);const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);g.clearGroups();const list=batches.get(o.material)||[];list.push(g);batches.set(o.material,list)})
 meshes.forEach(m=>{m.removeFromParent();m.geometry.dispose()})
 for(const [mat,list] of batches){const merged=mergeGeometries(list,false),mesh=new THREE.Mesh(mergeVertices(merged),mat);mesh.name=mat.name;root.add(mesh);merged.dispose();list.forEach(g=>g.dispose())}
 const buffer=await new GLTFExporter().parseAsync(root,{binary:true})
 await writeFile(`public/models/${file}`,Buffer.from(buffer));console.log(`${file}: ${(buffer.byteLength/1048576).toFixed(2)} MB`)
}
await mkdir('public/models',{recursive:true})
await save(makeStudio(),'vinyl-studio.glb')
await save(makeStage(),'future-live.glb')
