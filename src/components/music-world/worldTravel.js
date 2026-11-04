import { WORLD_EYE_HEIGHT, planWorldPath } from './worldNavigation.js'

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value))
export const angleDelta=(to,from)=>Math.atan2(Math.sin(to-from),Math.cos(to-from))
export function worldViewToward(position,look){
  const dx=look[0]-position.x,dz=look[2]-position.z
  return {yaw:Math.atan2(-dx,-dz),pitch:clamp(Math.atan2(look[1]-position.y,Math.hypot(dx,dz)),-.9,1.12)}
}
export function smoothWorldView(view,target,delta){
  const blend=1-Math.exp(-delta*6)
  return {
    yaw:view.yaw+clamp(angleDelta(target.yaw,view.yaw)*blend,-1.8*delta,1.8*delta),
    pitch:view.pitch+clamp((target.pitch-view.pitch)*blend,-.85*delta,.85*delta),
  }
}
export function createWorldTravel(start,destination){
  const path=planWorldPath(start,destination)
  if(!path.length)return null
  const points=[{x:start.x,z:start.z}],lengths=[0]
  for(const point of path){
    const previous=points.at(-1),distance=Math.hypot(point.x-previous.x,point.z-previous.z)
    if(distance<1e-8)continue
    points.push(point);lengths.push(lengths.at(-1)+distance)
  }
  return {points,lengths,total:lengths.at(-1),distance:0,speed:0,destination}
}
function sample(travel,distance){
  for(let i=1;i<travel.points.length;i++)if(distance<travel.lengths[i]){
    const from=travel.points[i-1],to=travel.points[i],t=(distance-travel.lengths[i-1])/(travel.lengths[i]-travel.lengths[i-1])
    return {x:from.x+(to.x-from.x)*t,z:from.z+(to.z-from.z)*t}
  }
  return travel.points.at(-1)
}
export function stepWorldTravel(travel,view,delta){
  const dt=clamp(delta,0,.1),before=sample(travel,travel.distance)
  const ahead=sample(travel,travel.distance+1.4)
  const heading=Math.atan2(-(ahead.x-before.x),-(ahead.z-before.z))
  const remaining=travel.total-travel.distance
  // Turn before starting; slow down for turns and the final approach.
  const alignment=clamp((Math.cos(angleDelta(heading,view.yaw))+.1)/1.1,0,1)
  const targetSpeed=Math.min(4.4,Math.sqrt(2*3.5*remaining))*(remaining<2.4?1:alignment)
  travel.speed+=(targetSpeed-travel.speed)*(1-Math.exp(-dt*5))
  const step=travel.speed*dt
  travel.distance=remaining<.002?travel.total:Math.min(travel.total,travel.distance+step)
  const position=sample(travel,travel.distance),left=travel.total-travel.distance
  const finalView=worldViewToward({...travel.destination,y:WORLD_EYE_HEIGHT},travel.destination.look)
  const lookAhead=sample(travel,travel.distance+1.4)
  const routeYaw=left<.001?finalView.yaw:Math.atan2(-(lookAhead.x-position.x),-(lookAhead.z-position.z))
  const t=clamp(1-left/2.4,0,1),blend=t*t*(3-2*t)
  const target={yaw:routeYaw+angleDelta(finalView.yaw,routeYaw)*blend,pitch:finalView.pitch*blend}
  const nextView=smoothWorldView(view,target,dt)
  const arrived=left<1e-8&&Math.abs(angleDelta(finalView.yaw,nextView.yaw))<.002&&Math.abs(finalView.pitch-nextView.pitch)<.002
  return {...position,y:WORLD_EYE_HEIGHT,...nextView,arrived}
}
