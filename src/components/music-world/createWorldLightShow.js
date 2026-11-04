import * as THREE from 'three'
import { createStageChoreography } from './stageChoreography.js'

export function createWorldLightShow(scene, concert) {
  const group=new THREE.Group();group.name='listening-room-light-ribbons';scene.add(group)
  const materials=[],geometry=new THREE.BoxGeometry(.055,.035,1.15),director=createStageChoreography()
  for(let i=0;i<6;i++){
    const material=new THREE.MeshStandardMaterial({color:'#1e363c',emissive:'#92d7cf',emissiveIntensity:0,metalness:.35,roughness:.35});materials.push(material)
    for(const side of [-1,1]){
      const floor=new THREE.Mesh(geometry,material);floor.position.set(side*2.17,.065,-14.5+i*2.3);group.add(floor)
      const edge=new THREE.Mesh(geometry,material);edge.rotation.x=Math.PI/2;edge.scale.z=.72;edge.position.set(side*6.85,1.3+i*.84,-19.6);group.add(edge)
    }
  }
  const panels=new THREE.Group();panels.name='live-spectrum-wings';scene.add(panels)
  const barGeometry=new THREE.BoxGeometry(.30,1,.07),bars=[]
  for(const side of [-1,1])for(let i=0;i<9;i++){
    const material=new THREE.MeshBasicMaterial({color:'#337b86',toneMapped:false})
    const mesh=new THREE.Mesh(barGeometry,material);mesh.position.set(side*(7.8+i*.72),1,-20.12);panels.add(mesh);bars.push(mesh)
  }
  const color=new THREE.Color(),secondary=new THREE.Color()
  let cue='等待音乐'
  return {
    update(state,config,reducedMotion,dt,seated=false,quality='balanced',section){
      const show=director.update(state,dt,{reducedMotion,seated,intensity:config.lightIntensity,section})
      cue=show.cue
      concert.update(state,config.palette,reducedMotion,show.commands)
      concert.fixtures.forEach((fixture,i)=>{fixture.spot.visible=state.power>.002&&(quality!=='smooth'||i%3===0)})
      color.set(config.palette.primary);secondary.set(config.palette.secondary)
      materials.forEach((material,i)=>{
        const command=show.commands[i]
        material.emissive.copy(color).lerp(secondary,command.mix)
        material.emissiveIntensity=command.intensity*(.65+state.bass*.8)
      })
      panels.visible=config.id==='stage'
      bars.forEach((bar,i)=>{
        const strength=state.live&&!reducedMotion?(i%3===0?state.bass:i%3===1?state.mid:state.treble):.12
        const height=.15+strength*(3.1+Math.sin(state.phase+i*.6)*.8)
        bar.scale.y=height;bar.position.y=.65+height/2
        bar.material.color.copy(color).lerp(secondary,(i%9)/8).multiplyScalar(.13+state.power*(.3+strength*.8))
      })
      return show.settling
    },
    getState(){return{cue,fixtures:concert.fixtures.map(f=>({x:f.spot.target.position.x,z:f.spot.target.position.z,angle:f.spot.angle,intensity:f.spot.intensity,color:f.spot.color.getHexString()}))}},
    reset(){director.reset()},
  }
}
