import * as THREE from 'three'
import { loadFantasyQueen } from './fantasyQueenAvatar.js'

export function createWorldAvatars(invalidate) {
  const group=new THREE.Group(), peers=new Map();group.name='world-avatars'
  let local=null, asset=null, disposed=false, selfId='', clock=0
  const position=new THREE.Vector3()
  async function load(renderer, onProgress) {
    const loaded=await loadFantasyQueen(renderer, onProgress)
    if(disposed){loaded.dispose();throw new DOMException('World closed','AbortError')}
    asset=loaded;local=asset.create();group.add(local.root);invalidate()
  }
  const deltaAngle=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b))
  function label(name) {
    const canvas=document.createElement('canvas');canvas.width=384;canvas.height=80
    const ctx=canvas.getContext('2d');ctx.fillStyle='rgba(18,36,49,.83)';ctx.beginPath();ctx.roundRect(6,7,372,64,28);ctx.fill()
    ctx.fillStyle='#f5f4e9';ctx.font='500 30px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(name,192,40,340)
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthWrite:false}));sprite.position.y=2;sprite.scale.set(1.2,.25,1);return sprite
  }
  function remove(peer){peer.label.material.map.dispose();peer.label.material.dispose();peer.avatar.dispose()}
  function setPeers(value, memberId, connected=true) {
    if(disposed||!asset)return
    selfId=memberId
    const rows=connected?(value?.players||[]).filter(p=>p.id!==selfId):[],ids=new Set(rows.map(p=>p.id))
    for(const [id,peer]of peers)if(!ids.has(id)){remove(peer);peers.delete(id)}
    for(const p of rows){
      let peer=peers.get(p.id)
      if(!peer){const avatar=asset.create(),tag=label(p.name);avatar.root.add(tag);group.add(avatar.root);avatar.root.position.set(p.x,p.y,p.z);avatar.root.rotation.y=p.yaw;peer={avatar,label:tag,target:p,remaining:0};peers.set(p.id,peer)}
      const moved=Math.hypot(peer.target.x-p.x,peer.target.y-p.y,peer.target.z-p.z)>.002||Math.abs(deltaAngle(peer.target.yaw,p.yaw))>.002||peer.target.motion!==p.motion
      peer.target=p;if(moved)peer.remaining=.45
    }
    invalidate()
  }
  return {
    group,setPeers,load,
    update(pose,delta,{firstPerson=false,reducedMotion=false}={}) {
      if(disposed||!local)return false
      clock+=delta
      if(pose.transition&&!reducedMotion)local.root.position.lerp(position.set(pose.x,pose.y,pose.z),1-Math.exp(-delta*12));else local.root.position.set(pose.x,pose.y,pose.z)
      local.root.rotation.y=pose.yaw;local.root.visible=!firstPerson
      let moving=local.pose(pose.motion,delta,clock,reducedMotion)
      for(const peer of peers.values()){
        const p=peer.target,root=peer.avatar.root,blend=1-Math.exp(-delta*18),distance=Math.hypot(root.position.x-p.x,root.position.z-p.z)
        if(distance>4)root.position.set(p.x,p.y,p.z);else root.position.lerp(position.set(p.x,p.y,p.z),blend)
        root.rotation.y+=deltaAngle(p.yaw,root.rotation.y)*blend
        peer.remaining=Math.max(0,peer.remaining-delta)
        // If movement packets stop, settle to idle instead of walking forever.
        const motion=peer.remaining===0&&['walk','run','jump'].includes(p.motion)?'idle':p.motion
        const animating=peer.avatar.pose(motion,delta,clock,reducedMotion)
        peer.label.position.y=peer.avatar.labelHeight()
        moving ||= peer.remaining>0||animating
      }
      return moving
    },
    getState:()=>({self:local?.getState(),peers:[...peers.keys()]}),
    dispose(){if(disposed)return;disposed=true;local?.dispose();peers.forEach(remove);peers.clear();asset?.dispose();group.removeFromParent()},
  }
}
