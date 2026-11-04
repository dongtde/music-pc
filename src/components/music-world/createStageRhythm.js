import { createConcertRhythm } from '../music-room/createConcertRhythm.js'

const follow=(a,b,rate,dt)=>a+(b-a)*(1-Math.exp(-rate*dt))
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)]

export function createStageRhythm(){
  const base=createConcertRhythm(),scaled=new Float32Array(48),previous=new Float32Array(48)
  let peak=.5,midBaseline=0,fluxBaseline=0,sinceBeat=2,seen=false,baseBeats=0,beats=0,pulse=0,phase=0,mid=0,intervals=[]
  function reset(){base.reset();previous.fill(0);peak=.5;midBaseline=fluxBaseline=baseBeats=beats=pulse=phase=mid=0;sinceBeat=2;seen=false;intervals=[]}
  function update({levels,playing,reducedMotion},delta){
    const dt=Math.min(.1,Math.max(0,delta)),live=Boolean(playing&&!reducedMotion&&levels?.length)
    let rawMid=0,flux=0
    if(live){
      let maximum=0;for(let i=0;i<48;i++)maximum=Math.max(maximum,Number(levels[i])||0)
      peak=follow(peak,maximum,maximum>peak?16:.65,dt)
      const gain=Math.min(3,.85/Math.max(.22,peak))
      for(let i=0;i<48;i++){
        const value=Math.min(1,Math.max(0,(Number(levels[i])||0)*gain));scaled[i]=value
        if(i>=14&&i<32){rawMid+=value/18;flux+=Math.max(0,value-previous[i])/18}
        previous[i]=value
      }
    }
    const state=base.update({levels:live?scaled:null,playing,reducedMotion},dt)
    sinceBeat+=dt
    const midOnset=seen&&rawMid>.075&&rawMid>midBaseline*1.12+.012&&flux>Math.max(.018,fluxBaseline*1.65)
    const onset=live&&sinceBeat>.24&&(state.beats>baseBeats||midOnset)
    baseBeats=state.beats
    if(onset){
      if(sinceBeat>.28&&sinceBeat<1.5){intervals.push(sinceBeat);if(intervals.length>8)intervals.shift()}
      sinceBeat=0;beats++;pulse=1
    }else pulse*=Math.exp(-dt*6.5)
    midBaseline=follow(midBaseline,rawMid,2.5,dt);fluxBaseline=follow(fluxBaseline,flux,3,dt);mid=follow(mid,rawMid,10,dt)
    if(live&&state.energy>.015)phase+=dt*(.4+state.energy*3.3)
    if(!live){seen=false;previous.fill(0);midBaseline=fluxBaseline=pulse=0}else seen=true
    let tempo=0
    if(intervals.length>=4&&sinceBeat<2){const period=median(intervals),deviation=median(intervals.map(n=>Math.abs(n-period)));if(deviation/period<.14)tempo=Math.round(60/period)}
    return {...state,beats,pulse,phase,mid,tempo,onset}
  }
  return{update,reset}
}
