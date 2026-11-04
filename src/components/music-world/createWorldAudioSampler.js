import { createAudioSampler } from '../music-room/createAudioSampler.js'

// Analyse the original capture first. If its origin prevents capture, route an
// independent CORS-enabled copy through an analyser and a zero-gain output.
// The original audio element is never reconnected, muted, paused or reloaded.
export function createWorldAudioSampler(audio) {
  const direct=createAudioSampler(audio),levels=new Float32Array(48)
  let mirror=null,context=null,node=null,analyser=null,silent=null,data=null
  let source='',active=false,disposed=false,attempted=false,failed=false,started=0,lastSignal=0,mode='waiting',playPending=null
  function clearMirror(){
    const previous=mirror;mirror=null
    if(previous){previous.pause();previous.removeAttribute('src');previous.load()}
    node?.disconnect();analyser?.disconnect();silent?.disconnect()
    context?.close().catch(()=>{})
    context=node=analyser=silent=data=null;attempted=false;failed=false;playPending=null
  }
  function playMirror(){
    if(!mirror||!active||failed||playPending)return
    const element=mirror
    context?.resume().catch(()=>{})
    const pending=element.play().catch(error=>{
      if(mirror===element&&active&&error.name!=='AbortError'){failed=true;mode='unavailable'}
    }).finally(()=>{if(playPending===pending)playPending=null})
    playPending=pending
  }
  function synchronize(){
    if(!mirror||!active)return
    mirror.playbackRate=audio.playbackRate||1
    if(mirror.readyState>=1&&Math.abs(mirror.currentTime-audio.currentTime)>.18){try{mirror.currentTime=audio.currentTime}catch{}}
    if(mirror.readyState>=2&&mirror.paused)playMirror()
  }
  function startMirror(){
    if(attempted||!source||disposed||!active)return
    attempted=true
    try{
      const AudioContext=window.AudioContext||window.webkitAudioContext
      if(!AudioContext){failed=true;mode='unavailable';return}
      mirror=new Audio();mirror.crossOrigin='anonymous';mirror.preload='auto'
      const element=mirror
      const silentSink=typeof AudioContext.prototype.setSinkId==='function'
      context=new AudioContext(silentSink?{sinkId:{type:'none'}}:undefined)
      node=context.createMediaElementSource(mirror)
      analyser=context.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=.45
      data=new Uint8Array(analyser.frequencyBinCount)
      silent=context.createGain();silent.gain.value=0
      node.connect(analyser);analyser.connect(silent);silent.connect(context.destination)
      mirror.addEventListener('error',()=>{if(mirror===element){failed=true;mode='unavailable'}},{once:true})
      mirror.addEventListener('loadedmetadata',()=>{if(mirror===element)synchronize()})
      mirror.addEventListener('playing',()=>{if(mirror===element)synchronize()})
      mirror.src=source
      playMirror()
    }catch{clearMirror();attempted=true;failed=true;mode='unavailable'}
  }
  function sampleMirror(){
    if(!analyser||context.state!=='running'||mirror.readyState<2||failed)return null
    analyser.getByteFrequencyData(data)
    const hz=context.sampleRate/analyser.fftSize
    for(let i=0;i<48;i++){
      const first=Math.max(1,Math.min(data.length-1,Math.floor(40*400**(i/48)/hz)))
      const last=Math.min(data.length,Math.max(first+1,Math.ceil(40*400**((i+1)/48)/hz)))
      let sum=0;for(let bin=first;bin<last;bin++)sum+=data[bin]
      levels[i]=sum/(last-first)/255
    }
    return levels
  }
  return {
    start(){
      if(disposed||audio.paused)return
      const next=audio.currentSrc||audio.src
      if(next!==source){clearMirror();source=next;started=lastSignal=performance.now();mode='waiting'}
      if(!active){active=true;started=lastSignal=performance.now();playMirror()}
      direct.start();synchronize()
    },
    sample(){
      if(disposed||!active)return null
      synchronize()
      const fallback=sampleMirror()
      if(fallback){mode='mirror';return fallback}
      const captured=direct.sample(),now=performance.now()
      if(captured?.some(value=>value>.002))lastSignal=now
      if(now-started>650&&(!captured||now-lastSignal>1500))startMirror()
      if(failed&&(!captured||now-lastSignal>1500)){mode='unavailable';return null}
      if(captured){mode='direct';return captured}
      if(failed)mode='unavailable'
      return null
    },
    stop(){active=false;direct.stop();mirror?.pause();context?.suspend().catch(()=>{})},
    getStatus(){return mode},
    dispose(){disposed=true;active=false;direct.dispose();clearMirror()},
  }
}
