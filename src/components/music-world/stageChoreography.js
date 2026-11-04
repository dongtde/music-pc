const clamp=(v,min=0,max=1)=>Math.min(max,Math.max(min,v))
export const LIGHT_CUES=['波浪扫光','交叉扫光','扇形展开','逐灯追光']

export function createStageChoreography(){
  const commands=Array.from({length:12},(_,i)=>({x:i<6?-2:2,y:.055,z:-8+(i%6)*3.3,angle:.12,intensity:0,mix:0,white:0,hue:0}))
  let cue=0
  return {
    update(state,dt,{reducedMotion=false,seated=false,intensity=1,section}={}){
      const live=state.live&&!reducedMotion,phase=live?state.phase:0,energy=clamp(state.energy),pulse=state.pulse||0
      if(live)cue=(Math.floor(state.beats/8)+Math.floor(phase/(Math.PI*5)))%4
      const sectionGain=({intro:.45,verse:.72,chorus:1.15,bridge:.55,outro:.3})[section?.type]||1
      if(live&&section?.type==='chorus')cue=state.beats%16<8?2:1
      if(live&&['intro','outro','bridge'].includes(section?.type))cue=0
      for(let n=0;n<12;n++){
        const side=n<6?-1:1,index=n%6,z=-8+index*3.3,p=phase+index*.55
        let x=side*2,targetZ=z,brightness=live?energy*1.5+state.bass*.25+pulse*.3:.32
        if(live){
          if(cue===0){x=Math.sin(p)*6;targetZ=z+Math.cos(p*.7+side)*3}
          if(cue===1){x=-side*(3.2+Math.sin(p*.8)*2.5);targetZ=z+Math.sin(p*.65+side)*3.8}
          if(cue===2){x=(index-2.5)*(1.7+energy*.8)+side*.65;targetZ=-12+Math.cos(p*.6)*2.5}
          if(cue===3){x=side*(2.5+Math.sin(p)*2);targetZ=z-2+Math.cos(p*.7)*2;brightness*=.38+.62*Math.max(0,Math.cos(index*1.05-phase*2-state.beats*.65))}
        }
        const command=commands[n],rate=reducedMotion?1:1-Math.exp(-Math.min(.1,dt)*(2.6+energy*4))
        command.x+=(clamp(x,-12.5,12.5)-command.x)*rate
        command.z+=(clamp(targetZ,-17,14)-command.z)*rate
        command.angle+=(.065+energy*.11+(cue===2?.035:0)-command.angle)*rate
        const target=state.power*clamp(brightness*sectionGain,0,1.35)*intensity*(seated?.82:1)
        command.intensity+=(target-command.intensity)*(reducedMotion?1:1-Math.exp(-dt*(target>command.intensity?14:7)))
        if(command.intensity<.001)command.intensity=0
        command.mix=live?(Math.sin(phase*.32+index*.55+side*.9)+1)*.5:index%2
        command.white=live?clamp(state.treble*.24+pulse*.12,0,.32):0
        command.hue=live?Math.sin(phase*.12)*.10:0
      }
      return {commands,cue:live?LIGHT_CUES[cue]:reducedMotion?'柔和常亮':state.power>0?'氛围照明':'等待音乐',settling:commands.some(c=>c.intensity>.001)&&state.power===0}
    },
    reset(){cue=0},
  }
}
