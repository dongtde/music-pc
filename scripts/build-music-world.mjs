// Original, reproducible music pavilion asset. No third-party models or textures.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { mkdir, writeFile } from 'node:fs/promises'

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((data) => { this.result = data; this.onloadend?.() }) }
}
const scene = new THREE.Scene()
scene.name = 'LANYIN · Resonance Pavilion'
const shell=new THREE.Group();shell.name='pavilion-shell';shell.userData.staticBatch=true;scene.add(shell)
const equipment=new THREE.Group();equipment.name='pavilion-equipment';equipment.userData.staticBatch=true;scene.add(equipment)
let constructionRoot=shell
const material = (name, color, metalness, roughness, extra = {}) => {
  const value = new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra }); value.name = name; return value
}
const stone = material('basalt', '#363c40', .18, .5)
const dark = material('graphite', '#131e25', .55, .36)
const metal = material('brushed-aluminium', '#a3adb3', .92, .27)
const brass = material('champagne-metal', '#b6a381', .82, .3)
const wood = material('walnut', '#473227', .03, .72)
const fabric = material('woven-fabric', '#677473', .01, .93)
const rubber = material('rubber', '#15181a', .02, .92)
const light = material('warm-light', '#ffeac5', .15, .32, { emissive: '#ffd39c', emissiveIntensity: 2.3 })
const cyan = material('cyan-light', '#7edadd', .3, .2, { emissive: '#69cad4', emissiveIntensity: 2 })
const glass = material('architectural-glass', '#8caab7', .3, .16, { transparent: true, opacity: .10, side: THREE.DoubleSide, depthWrite: false })
const add = (geometry, mat, pos = [0,0,0], parent = scene) => {
  const mesh = new THREE.Mesh(geometry,mat); mesh.position.fromArray(pos); mesh.castShadow = mesh.receiveShadow = true; (parent===scene?constructionRoot:parent).add(mesh); return mesh
}
const box = (s,m,p,r=.04,parent=scene) => add(r?new RoundedBoxGeometry(...s,2,r):new THREE.BoxGeometry(...s),m,p,parent)
const cylinder = (r,h,m,p,parent=scene) => add(new THREE.CylinderGeometry(r,r,h,48),m,p,parent)
const torus = (r,t,m,p,parent=scene) => add(new THREE.TorusGeometry(r,t,8,96),m,p,parent)
const tube = (points,r,m,parent=scene) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),64,r,8,false),m,[0,0,0],parent)
const anchor = (name,p,rotation=0) => { const g=new THREE.Group();g.name=name;g.position.fromArray(p);g.rotation.y=rotation;constructionRoot.add(g);return g }
const joint = (name,p,parent) => { const g=new THREE.Group();g.name=name;g.position.fromArray(p);g.userData.articulated=true;parent.add(g);return g }

// Sunken foundation, stone tile joints, inset brass wayfinding.
box([31,.4,43],dark,[0,-.22,0],.1)
for(let x=-14;x<=14;x+=2)for(let z=-20;z<=20;z+=2)box([1.982,.06,1.982],stone,[x,.005,z],0)
for(const x of [-2.1,2.1])box([.025,.014,34],brass,[x,.046,-1],0)
for(let z=-16;z<=16;z+=4)for(const x of [-2.1,2.1])box([.24,.015,.04],cyan,[x,.052,z],0)
for(const side of [-1,1]) {
  box([.3,.6,42],dark,[side*15,.3,0])
  box([.10,.04,41],light,[side*14.8,.6,0])
  // Curtain walls and mullions: the city remains visible through the glass.
  for(let z=-19;z<=19;z+=3.8) {
    box([.11,7.1,.14],metal,[side*15,3.9,z],.01)
    box([.025,6.5,3.64],glass,[side*15,3.9,z+1.9],0)
  }
  for(const y of [1.4,4.1,7.2])box([.15,.09,41.8],metal,[side*15,y,0],.015)
  tube([[side*14.65,1.2,-20],[side*14.65,1.2,0],[side*14.65,1.2,20]],.038,brass)
}
// Barrel-vaulted glass roof with curved structural ribs, modeled as extrusions.
for(let z=-20;z<=20;z+=5) {
  const outer=[]
  for(let i=0;i<=64;i++){const a=Math.PI*i/64;outer.push(new THREE.Vector2(Math.cos(a)*15.1,7.1+Math.sin(a)*5.2))}
  for(let i=64;i>=0;i--){const a=Math.PI*i/64;outer.push(new THREE.Vector2(Math.cos(a)*14.82,7.1+Math.sin(a)*4.95))}
  const shape=new THREE.Shape(outer)
  add(new THREE.ExtrudeGeometry(shape,{depth:.22,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.025,bevelThickness:.025,curveSegments:48}),metal,[0,0,z])
}
for(let a=.2;a<Math.PI;a+=.24) {
  const x=Math.cos(a)*15,y=7.1+Math.sin(a)*5.05
  box([.055,.055,41.7],dark,[x,y,0],.008)
}
const vault=new THREE.CylinderGeometry(15,15,42,64,1,true,0,Math.PI)
vault.rotateZ(Math.PI/2);vault.rotateY(Math.PI/2)
// Individual curved panes use the same profile as the roof ribs.
const roofPoints=[]
for(let i=0;i<=64;i++)roofPoints.push(new THREE.Vector2(Math.cos(Math.PI*i/64)*15,7.1+Math.sin(Math.PI*i/64)*5.14))
const positions=[],indices=[]
for(const z of [-21,21])for(const p of roofPoints)positions.push(p.x,p.y,z)
for(let i=0;i<64;i++){indices.push(i,i+1,65+i,i+1,66+i,65+i)}
const roof=new THREE.BufferGeometry();roof.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));roof.setIndex(indices);roof.computeVertexNormals();add(roof,glass)
vault.dispose()
for(const x of [-5.5,5.5])for(const z of [-9,-3,3,9]){
  cylinder(.021,4.9,metal,[x,9.38,z])
  box([.26,.10,.30],dark,[x,11.85,z],.025)
}

// Acoustic canopy: two machined elliptical rings suspended by cables.
for(const [z,y,s] of [[-3,8.6,1],[6.5,9.1,.8]]){
  const group=new THREE.Group();group.position.set(0,y,z);group.scale.set(1.38,.16,.82);shell.add(group)
  const hoop=torus(5.2,.32,dark,[0,0,0],group);hoop.rotation.x=Math.PI/2
  const rim=torus(5.21,.036,light,[0,-.37,0],group);rim.rotation.x=Math.PI/2
  for(let i=0;i<80;i++){const a=i/80*Math.PI*2;const slot=box([.055,.14,.44],brass,[Math.cos(a)*5.2,-.30,Math.sin(a)*5.2],.01,group);slot.rotation.y=-a}
  for(const x of [-5,5])cylinder(.013,2,metal,[x,y+1.1,z])
  group.scale.multiplyScalar(s)
}

// Listening end: a walnut wall, inset cinema screen and acoustic diffusion fins.
box([29.9,7.5,.35],wood,[0,3.75,-20.5],.04)
for(const side of [-1,1])for(let i=0;i<26;i++)box([.085,6.2,.14+(i%4)*.08],wood,[side*(7+i*.3),3.4,-20.12],.016)
constructionRoot=equipment
box([13.4,5.8,.44],metal,[0,3.55,-19.94],.14)
box([13.12,5.55,.20],dark,[0,3.55,-19.64],.09)
for(const x of [-6.7,6.7])box([.028,5.62,.028],light,[x,3.55,-19.67],.009)
anchor('music-screen',[0,3.55,-19.5])

function speaker(x,z) {
 const group=anchor(`reference-speaker-${x}`,[x,0,z])
 box([1.62,4.6,1.65],wood,[0,2.48,0],.16,group)
 box([1.42,4.3,.12],dark,[0,2.48,.85],.11,group)
 box([1.85,.12,1.9],metal,[0,.16,0],.03,group)
 for(const x of [-.61,.61])for(const z of [-.55,.55])cylinder(.07,.2,rubber,[x,.24,z],group)
 for(const [y,r] of [[1.1,.48],[2.4,.48],[3.7,.24]]){
  torus(r,.06,rubber,[0,y,.93],group)
  const profile=[[.01,-.14],[r*.3,-.15],[r*.83,-.07],[r,.0]].map(p=>new THREE.Vector2(...p))
  const cone=add(new THREE.LatheGeometry(profile,64),metal,[0,y,.93],group);cone.rotation.x=Math.PI/2
  const cap=add(new THREE.SphereGeometry(r*.3,24,16),rubber,[0,y,.94],group);cap.scale.z=.36
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;const bolt=cylinder(.017,.018,metal,[Math.cos(a)*(r+.08),y+Math.sin(a)*(r+.08),.94],group);bolt.rotation.x=Math.PI/2}
 }
 box([.035,4,.02],brass,[-.67,2.48,.93],.007,group)
 for(let i=0;i<8;i++)box([.065,.22,.06],dark,[-.35+i*.1,.62,.92],.025,group)
}
speaker(-8.3,-16.9);speaker(8.3,-16.9)

// Record archive: illuminated compartments and individually sleeved records.
for(const side of [-1,1]) {
 const x=side*11.9
 for(const z of [-4,1,6]){
  box([.16,3.25,3.5],wood,[x+side*1.12,1.65,z],.04)
  for(const edge of [-1.72,1.72])box([2.4,3.25,.12],wood,[x,1.65,z+edge],.035)
  for(const y of [.42,1.37,2.32,3.21]){
   box([2.5,.08,3.55],brass,[x,y,z],.012)
   box([.04,.025,3.2],light,[x-side*1.15,y-.055,z],.006)
  }
  for(let row=0;row<3;row++)for(let i=0;i<20;i++){
   const record=box([1.2,.72,.085],i%4===0?brass:i%3===0?fabric:dark,[x-side*.42,.85+row*.95,z-1.42+i*.145],0)
   record.rotation.x=(i%6===0?.08:0)
  }
 }
}

// Display easels, with named surfaces populated from the live music library.
for(const side of [-1,1])for(let i=0;i<4;i++){
 const z=-7+i*4.7,x=side*8.2,rotation=side<0?Math.PI/2:-Math.PI/2
 const group=anchor(`record-display-${side<0?'archive':'discover'}-${i}`,[x,0,z],rotation)
 box([2.0,.12,1.35],metal,[0,.12,0],.06,group)
 box([.12,1.0,.12],brass,[0,.66,0],.025,group)
 const displayWidth=1.85,displayHeight=1.85,displayY=2
 box([displayWidth,displayHeight,.12],dark,[0,displayY,0],.04,group)
 box([displayWidth+.13,displayHeight+.13,.07],brass,[0,displayY,-.045],.04,group)
 box([displayWidth+.05,.018,.06],light,[0,displayY+displayHeight/2+.045,0],.006,group)
 const marker=new THREE.Group();marker.name=`cover-${side<0?'archive':'discover'}-${i}`;marker.position.set(0,displayY,.071);group.add(marker)
}

// Central control terminal: a machined housing, inclined touch display and vented pedestal.
const terminal=anchor('music-control-terminal',[0,0,1.5])
terminal.userData.staticBatch=true
box([3.6,.15,1.8],metal,[0,.12,0],.08,terminal)
box([3.3,.09,1.55],dark,[0,.23,0],.045,terminal)
for(const x of [-1.3,1.3]){
 box([.18,1.08,.45],metal,[x,.75,-.28],.025,terminal)
 box([.22,.10,.64],dark,[x,.26,-.23],.025,terminal)
}
box([2.7,.66,.16],dark,[0,.62,-.43],.05,terminal)
for(let i=0;i<22;i++)box([.036,.35,.03],metal,[-1.1+i*.105,.65,-.335],.009,terminal)
const terminalDisplay=new THREE.Group();terminalDisplay.name='terminal-display-housing';terminalDisplay.position.set(0,1.38,0);terminalDisplay.rotation.x=-.55;terminal.add(terminalDisplay)
box([4.46,2,.22],metal,[0,0,0],.11,terminalDisplay)
box([4.30,1.86,.09],dark,[0,0,.115],.065,terminalDisplay)
for(const x of [-2.15,2.15]){
 box([.026,1.67,.023],cyan,[x,0,.165],.008,terminalDisplay)
 for(const y of [-.86,.86]){const screw=cylinder(.035,.02,dark,[x,y,.13],terminalDisplay);screw.rotation.x=Math.PI/2}
}
for(let i=0;i<24;i++)box([.035,.09,.018],dark,[-1.8+i*.155,-.945,.085],.008,terminalDisplay)
const terminalScreen=new THREE.Group();terminalScreen.name='terminal-screen';terminalScreen.position.z=.17;terminalDisplay.add(terminalScreen)
anchor('terminal-label',[0,.54,2.43])

// Upholstered listening chairs with piping and a curved supporting frame.
for(const side of [-1,1])for(const z of [-10.8,12]){
 const chair=anchor(`listening-chair-${side}-${z}`,[side*5,0,z],side*.22)
 box([1.55,.3,1.48],fabric,[0,.58,0],.16,chair)
 const back=box([1.55,1.1,.26],fabric,[0,1.07,.63],.13,chair);back.rotation.x=-.17
 for(const x of [-.8,.8]){
  tube([[x,.18,.6],[x,.18,-.55],[x,.7,-.61],[x,.96,.64]],.035,brass,chair)
  box([.16,.15,1.5],wood,[x,.94,0],.075,chair)
 }
 for(const x of [-.47,0,.47])box([.008,.012,1.15],brass,[x,.738,-.04],.004,chair)
 // Welt seams trace the cushion, with upholstered buttons in the backrest.
 tube([[-.70,.70,-.64],[.70,.70,-.64],[.70,.70,.58],[-.70,.70,.58],[-.70,.70,-.64]],.012,wood,chair)
 for(const x of [-.45,0,.45])for(const y of [.95,1.3]){const button=cylinder(.021,.012,dark,[x,y,.465],chair);button.rotation.x=Math.PI/2}
}

// Centered two-seat listening sofa, aligned with the stereo speakers and screen.
const sofa=anchor('listening-sofa',[0,0,-9])
box([3.05,.22,1.5],wood,[0,.38,0],.08,sofa)
for(const x of [-.73,.73])box([1.42,.29,1.4],fabric,[x,.63,0],.13,sofa)
const sofaBack=box([2.96,1.12,.27],fabric,[0,1.03,.66],.13,sofa);sofaBack.rotation.x=-.13
for(const side of [-1,1]){
 box([.18,.5,1.55],wood,[side*1.55,.68,0],.07,sofa)
 box([.22,.10,1.5],fabric,[side*1.55,.98,0],.05,sofa)
 for(const z of [-.52,.54])cylinder(.038,.31,brass,[side*1.35,.2,z],sofa)
}
for(const x of [-1,-.5,0,.5,1])for(const y of [.9,1.25]){const button=cylinder(.022,.012,dark,[x,y,.49],sofa);button.rotation.x=Math.PI/2}
tube([[-1.42,.745,-.61],[1.42,.745,-.61],[1.42,.745,.6]],.012,wood,sofa)

// A city modeled beyond the curtain wall, with inset illuminated windows.
constructionRoot=shell
for(let i=0;i<68;i++){
 const a=i/68*Math.PI*2, radius=40+(i%4)*9
 const x=Math.sin(a)*radius,z=Math.cos(a)*radius,h=4+(Math.sin(i*17.3)+1)*13
 box([2.5+(i%3),h,3.8],dark,[x,h/2-12,z],0)
 for(let y=-10;y<h-12;y+=1.4)for(let k=0;k<3;k++)if((i+k+Math.round(y))%3!==0)box([.33,.28,.025],i%3?light:cyan,[x-.8+k*.8,y,z+1.92],0)
}

// Merge static geometry by material, but retain the local geometry of moving joints.
scene.updateMatrixWorld(true)
const batches=new Map()
scene.traverse(object=>{
 if(!object.isMesh)return
 let root=object.parent
 while(root!==scene&&!root.userData.articulated&&!root.userData.staticBatch)root=root.parent
 if(!batches.has(root))batches.set(root,new Map())
 const materials=batches.get(root),list=materials.get(object.material)||[]
 const geometry=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone()
 if(!geometry.getAttribute('uv'))geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count*2),2))
 geometry.applyMatrix4(new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(object.matrixWorld));geometry.clearGroups();list.push(geometry);materials.set(object.material,list)
})
const remove=[];scene.traverse(o=>{if(o.isMesh)remove.push(o)});remove.forEach(o=>{o.parent.remove(o);o.geometry.dispose()})
for(const [root,materials] of batches)for(const [mat,list] of materials){const merged=mergeGeometries(list,false);const mesh=new THREE.Mesh(mergeVertices(merged),mat);merged.dispose();mesh.name=mat.name;root.add(mesh);list.forEach(g=>g.dispose())}
const result=await new GLTFExporter().parseAsync(scene,{binary:true,onlyVisible:true})
await mkdir('public/models',{recursive:true})
await writeFile('public/models/resonance-pavilion.glb',Buffer.from(result))
await writeFile('public/models/README.md','# Resonance music environments\n\nRun `node scripts/build-music-world.mjs` for the glass pavilion and shared equipment. Run `node scripts/build-music-scenes.mjs` for the vinyl studio and live stage shells. Version 3 separates the architecture from the equipment so changing scenes retains the player, archive interactions and seating. The central control terminal includes a modeled housing, inclined touchscreen, supports and ventilation slots. All geometry is authored programmatically for this project with PBR materials; no external model licenses are required.\n')
console.log(`Generated resonance-pavilion.glb: ${(result.byteLength/1024/1024).toFixed(2)} MB`)
