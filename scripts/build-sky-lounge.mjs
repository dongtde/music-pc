// Reproducible architecture for the sky lounge; shared interactive furniture stays in the pavilion.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { mkdir, writeFile } from 'node:fs/promises'

globalThis.FileReader = class { readAsArrayBuffer(blob) { blob.arrayBuffer().then(value => { this.result = value; this.onloadend?.() }) } }
const root = new THREE.Group(); root.name = 'sky-lounge-shell'
let seed = 421903
const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
const material = (name, color, roughness = .5, metalness = 0, extra = {}) => {
  const value = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }); value.name = name; return value
}
const stone = material('sky-limestone', '#d5cbb9', .46)
const marble = material('sky-marble', '#e0d9cb', .24, .08)
const plaster = material('sky-plaster', '#ece2ce', .78)
const walnut = material('sky-walnut', '#493428', .5)
const parquet = material('sky-parquet', '#ffffff', .46)
const leather = material('sky-leather', '#675443', .74)
const porcelain = material('sky-porcelain', '#d7d1bd', .22)
const book = material('sky-book', '#c8b491', .88)
const bronze = material('sky-bronze', '#a48a60', .3, .78)
const graphite = material('sky-graphite', '#202b31', .36, .55)
const rug = material('sky-carpet', '#82796e', .97)
const light = material('sky-cove-light', '#fff0cf', .35, .2, { emissive: '#ffcf8b', emissiveIntensity: 2.3 })
const glass = material('sky-glass', '#b4c9cc', .13, .12, { transparent: true, opacity: .055, side: THREE.DoubleSide, depthWrite: false })
const add = (geometry, mat, position = [0, 0, 0]) => { const mesh = new THREE.Mesh(geometry, mat); mesh.position.fromArray(position); root.add(mesh); return mesh }
const box = (size, mat, position, radius = 0) => add(radius ? new RoundedBoxGeometry(...size, 2, radius) : new THREE.BoxGeometry(...size), mat, position)
const cylinder = (radius, height, mat, position, top = radius, segments = 32) => add(new THREE.CylinderGeometry(top, radius, height, segments), mat, position)
const tube = (points, radius, mat, closed = false, segments = 96) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed), segments, radius, 8, closed), mat)
const beam = (a, b, radius, mat) => {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b)
  const mesh = cylinder(radius, start.distanceTo(end), mat, start.clone().add(end).multiplyScalar(.5).toArray(), radius, 12)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize()); return mesh
}
function ellipse(rx, rz, y, z, thickness, mat, tilt = 0) {
  const points = Array.from({ length: 96 }, (_, i) => {
    const a = i / 96 * Math.PI * 2
    return [Math.cos(a) * rx, y + Math.sin(a) * tilt, z + Math.sin(a) * rz]
  })
  return tube(points, thickness, mat, true, 192)
}

// Floating slab and an exterior deck: the interior floor remains at the shared navigation height.
box([41, .65, 53], stone, [0, -.45, 1.6], .28)
box([40.5, .18, 52.5], graphite, [0, -.86, 1.6], .14)
for (const x of [-20.1, 20.1]) box([.035, .05, 51.7], light, [x, -.25, 1.6])
box([39.7, .05, .035], light, [0, -.25, 27.3])
for (let x = -2; x <= 2; x += 2) for (let z = -20; z <= 22; z += 2) {
  const mesh = box([1.987, .055, 1.987], marble, [x, -.01, z])
  if ((x + z) % 4 === 0) mesh.rotation.y = Math.PI
}
for (const side of [-1, 1]) for(let i=0;i<38;i++) for(let j=0;j<12;j++) {
  const z=-20+j*3.6, mesh=box([.31,.055,3.585],parquet,[side*(3.17+i*.313),-.01,z])
  const uv=mesh.geometry.attributes.uv,shift=random()
  for(let n=0;n<uv.count;n++)uv.setXY(n,uv.getY(n)*1.6+shift,uv.getX(n)*.19+shift)
}
for (const x of [-3.03, 3.03]) box([.018, .007, 39.8], bronze, [x, .023, -.1])
for (const z of [-14.1, 9.8, 15.8]) box([6.05, .007, .018], bronze, [0, .023, z])
for (const side of [-1, 1]) for (let x = 15.6; x < 20; x += .25) box([.235, .035, 50], walnut, [side * x, -.1, 1.5])
for (let x = -14.5; x < 15; x += .26) box([.247, .035, 3.8], walnut, [x, -.1, 25.3])
for (const [x, z, w, d] of [[0, -9.5, 5, 4], [-5, -10.8, 3.7, 3.3], [5, -10.8, 3.7, 3.3], [-5, 12, 3.7, 3.3], [5, 12, 3.7, 3.3]]) box([w, .008, d], rug, [x, .026, z], .06)

// Glass curtain walls and bronze fins beneath a deep cantilevered roof.
for (const side of [-1, 1]) {
  box([.28, .25, 46], stone, [side * 15, .12, 1])
  for (let z = -20; z < 23; z += 3.9) {
    box([.075, 11.8, .09], bronze, [side * 15, 6.05, z], .014)
    box([.02, 11.5, 3.78], glass, [side * 15, 6.05, z + 1.95])
  }
  box([.16, .14, 47], bronze, [side * 15, 11.95, 1])
  box([.08, .045, 45.5], light, [side * 14.82, 11.7, 1])
  // Glass balustrade on the external sky deck.
  box([.025, 1.26, 50], glass, [side * 20.1, .55, 1.5])
  box([.055, .055, 50], bronze, [side * 20.1, 1.2, 1.5], .012)
  for (let z = -22; z <= 26; z += 4) box([.055, 1.25, .055], bronze, [side * 20.1, .56, z])
}
for (let x = -14.8; x <= 14.8; x += 3.7) {
  box([.085, 11.8, .09], bronze, [x, 6.05, 23.5])
  box([3.59, 11.5, .02], glass, [x + 1.85, 6.05, 23.5])
}
box([40, 1.26, .025], glass, [0, .55, 27.3])
box([40, .055, .055], bronze, [0, 1.2, 27.3], .012)

// One continuous oval aperture and layered soffit create a tall, open ceiling.
const ceiling = new THREE.Shape().moveTo(-20.6, -26).lineTo(20.6, -26).lineTo(20.6, 26).lineTo(-20.6, 26).closePath()
const aperture = new THREE.Path(); aperture.absellipse(0, 0, 8.8, 17.2, 0, Math.PI * 2, true); ceiling.holes.push(aperture)
const roof = add(new THREE.ExtrudeGeometry(ceiling, { depth: .65, bevelEnabled: true, bevelSize: .16, bevelThickness: .16, bevelSegments: 3, curveSegments: 96 }), plaster, [0, 12.2, 0]); roof.rotation.x = -Math.PI / 2
ellipse(8.92, 17.3, 12.08, 0, .12, bronze)
ellipse(8.94, 17.32, 12.0, 0, .028, light)
ellipse(9.2, 17.55, 12.08, 0, .1, stone)
const skylight = add(new THREE.CircleGeometry(1, 128), glass, [0, 12.5, 0]); skylight.rotation.x = -Math.PI / 2; skylight.scale.set(8.8, 17.2, 1)
for (const side of [-1, 1]) {
  box([4.7, .14, 50.5], walnut, [side * 17.45, 12.05, 0], .03)
  for (let z = -24; z <= 24; z += .48) box([4.55, .1, .037], bronze, [side * 17.4, 11.95, z])
}
// Three interleaving, tilted luminous ribbons, suspended on fine cables.
for (const [rx, rz, y, z, tilt] of [[6.2, 3.3, 8.6, -6.4, .35], [7.7, 4.2, 9.35, 1.5, -.36], [5.8, 3.0, 8.8, 9.0, .24]]) {
  ellipse(rx, rz, y, z, .10, bronze, tilt)
  ellipse(rx, rz, y - .085, z, .029, light, tilt)
  for (const a of [.5, 2.6, 4.7]) {
    const x = Math.cos(a) * rx, zz = z + Math.sin(a) * rz
    const rimX = Math.sign(x) * 8.8 * Math.sqrt(1 - (zz / 17.2) ** 2)
    beam([x, y + Math.sin(a) * tilt, zz], [rimX, 12.16, zz], .008, graphite)
  }
}

// A fluted stone portal frames the existing screen without touching its hit target.
box([14.7, 9.6, .34], walnut, [0, 4.8, -20.45], .09)
for (const side of [-1, 1]) {
  box([1.0, 10.6, .72], stone, [side * 7.95, 5.3, -20.3], .1)
  box([.035, 9.7, .05], light, [side * 7.36, 5.1, -20.05])
  for (let x = 8.65; x < 14.7; x += .3) {
    box([.11, 10.2, .26], stone, [side * x, 5.1, -20.6], .025)
    if (Math.round(x * 10) % 3 === 0) box([.02, 9.8, .04], bronze, [side * (x + .075), 5.1, -20.42])
  }
}
box([16.7, .38, .75], stone, [0, 10.55, -20.3], .1)
box([14.4, .025, .05], light, [0, 9.66, -20.04])
box([29.8, 2.1, .025], glass, [0, 11.65, -20.6])

// Low, detailed millwork replaces tall storage in this scene and opens the city view.
function vase(x,y,z,scale=1) {
  const profile=[[.13,0],[.23,.04],[.27,.25],[.2,.45],[.095,.55],[.085,.73],[.105,.76]].map(([r,h])=>new THREE.Vector2(r*scale,h*scale))
  add(new THREE.LatheGeometry(profile,48),porcelain,[x,y,z])
}
function lamp(x,y,z) {
  cylinder(.26,.035,bronze,[x,y+.025,z]);cylinder(.023,.64,bronze,[x,y+.34,z])
  add(new THREE.CylinderGeometry(.28,.38,.38,48,1,true),porcelain,[x,y+.75,z])
  cylinder(.2,.025,light,[x,y+.58,z])
}
for(const side of [-1,1])for(const z of [-4,1,6]) {
  const x=side*11.9
  box([2.35,.14,3.46],graphite,[x,.13,z],.035)
  box([2.35,.94,3.46],walnut,[x,.65,z],.085)
  box([2.46,.11,3.58],marble,[x,1.17,z],.04)
  for(let zz=-1.6;zz<1.65;zz+=.13)box([.04,.78,.047],bronze,[x-side*1.19,.68,z+zz],.012)
  box([.03,.025,3.2],light,[x-side*1.2,.22,z])
  lamp(x,1.23,z-1.03)
  for(let i=0;i<3;i++) {const volume=box([.54,.06,.7],i%2?leather:book,[x-side*.35,1.26+i*.065,z+.5],.008);volume.rotation.y=side*.13*i}
  if(z!==1)vase(x,1.23,z+1.07,.62)
  if(z===1){
    const sculpture=add(new THREE.TorusKnotGeometry(.32,.068,96,12,2,3),bronze,[x,1.9,z+.85]);sculpture.rotation.z=.3
    box([.58,.06,.58],graphite,[x,1.25,z+.85],.015)
  }
}
// Layered lounge textiles and round stone side tables stay within the existing seat footprints.
for(const side of [-1,1])for(const z of [-10.8,12]) {
  const x=side*5
  cylinder(.27,.035,bronze,[x+side*.81,.035,z-.55]);cylinder(.027,.53,bronze,[x+side*.81,.31,z-.55])
  cylinder(.31,.065,marble,[x+side*.81,.61,z-.55]);vase(x+side*.81,.65,z-.55,.25)
}

// Merge static geometry by material to keep the detailed scene inexpensive to draw.
root.updateMatrixWorld(true)
const batches = new Map(), meshes = []
root.traverse(object => {
  if (!object.isMesh) return
  meshes.push(object)
  const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone()
  geometry.applyMatrix4(object.matrixWorld); geometry.clearGroups()
  if(object.material===walnut){
    const position=geometry.attributes.position,normal=geometry.attributes.normal,uv=geometry.attributes.uv
    for(let i=0;i<uv.count;i++){
      const vertical=Math.abs(normal.getY(i))<.6
      uv.setXY(i,vertical?position.getY(i):position.getZ(i),Math.abs(normal.getX(i))>.6?position.getZ(i):position.getX(i))
    }
  }
  const list = batches.get(object.material) || []; list.push(geometry); batches.set(object.material, list)
})
meshes.forEach(mesh => { mesh.removeFromParent(); mesh.geometry.dispose() })
let triangles = 0
for (const [mat, list] of batches) {
  const joined = mergeGeometries(list, false), geometry = mergeVertices(joined), mesh = new THREE.Mesh(geometry, mat)
  mesh.name = mat.name; root.add(mesh); triangles += geometry.index.count / 3
  joined.dispose(); list.forEach(g => g.dispose())
}
const data = await new GLTFExporter().parseAsync(root, { binary: true })
await mkdir('public/models', { recursive: true })
await writeFile('public/models/sky-lounge.glb', Buffer.from(data))
console.log(`sky-lounge.glb: ${(data.byteLength / 1048576).toFixed(2)} MB, ${batches.size} material batches, ${triangles} triangles`)
