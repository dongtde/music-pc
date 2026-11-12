import * as THREE from 'three'

// Baked skyline and cloud data: no raymarching, dynamic uploads or extra lights.
export function createLoungeAtmosphere(root, sky, { mask, noise } = {}) {
  if (noise) noise.wrapS = noise.wrapT = THREE.RepeatWrapping
  const uniforms = {
    loungeMask: { value: mask }, loungeNoise: { value: noise },
    loungeSkyTop: { value: new THREE.Color() }, loungeHorizon: { value: new THREE.Color() },
    loungeCityTint: { value: new THREE.Color() }, loungeSunColor: { value: new THREE.Color() },
    loungeSunDirection: { value: new THREE.Vector3() }, loungeDay: { value: 1 },
    loungeBrightness: { value: 1 }, loungeCloud: { value: 0 }, loungeMist: { value: 0 }, loungeTime: { value: 0 },
  }
  sky.material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = 'varying vec3 loungeDirection;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nloungeDirection = normalize(position);')
    shader.fragmentShader = `
      varying vec3 loungeDirection;
      uniform sampler2D loungeMask, loungeNoise;
      uniform vec3 loungeSkyTop, loungeHorizon, loungeCityTint, loungeSunColor, loungeSunDirection;
      uniform float loungeDay, loungeBrightness, loungeCloud, loungeMist, loungeTime;
    ` + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #include <map_fragment>
      vec3 source = diffuseColor.rgb;
      vec3 direction = normalize(loungeDirection);
      vec4 masks = texture2D(loungeMask, vMapUv);
      // Night detail excludes the photograph's golden sunlight. Reusing mask
      // alpha keeps this relighting within the existing texture fetch/pass.
      vec3 nightFacade = vec3(.32,.45,.65) * masks.a;
      vec3 city = mix(nightFacade, source * loungeCityTint, loungeDay) * loungeBrightness;
      city += vec3(.28,.135,.045) * masks.g * (1.0-loungeDay) * (1.0-loungeMist*.65);
      vec3 skyColor = mix(loungeHorizon,loungeSkyTop,smoothstep(0.0,.72,direction.y));
      if (masks.r > .002) {
        vec2 cloudUV = direction.xz / (max(direction.y,.0)+.32)*.34;
        vec4 layer = texture2D(loungeNoise,cloudUV+vec2(loungeTime*.0017,loungeTime*.0005));
        vec4 detail = texture2D(loungeNoise,cloudUV*2.17-vec2(loungeTime*.0008,0.0));
        float density = layer.r*.76+detail.r*.24;
        float clouds = smoothstep(.73-loungeCloud*.48,.92-loungeCloud*.3,density);
        float sunFacing = max(0.0,dot(direction,loungeSunDirection));
        float glow = pow(sunFacing,32.0)*(1.0-loungeCloud)*loungeDay;
        skyColor += loungeSunColor*glow*.22;
        skyColor += loungeSunColor*smoothstep(.99978,.99994,sunFacing)*loungeDay*(1.0-loungeCloud)*.8;
        vec3 cloudShade = mix(vec3(.002,.004,.008),loungeHorizon*.55,loungeDay);
        vec3 cloudLight = mix(vec3(.008,.012,.021),vec3(.88,.9,.91),loungeDay);
        vec3 cloudColor = mix(cloudShade,cloudLight,clamp(layer.g*.7+detail.g*.2,.0,1.0));
        cloudColor += loungeSunColor*glow*(1.0-clouds)*.18;
        skyColor = mix(skyColor,cloudColor,clouds*(.65+loungeCloud*.3));
        float stars = texture2D(loungeNoise,vMapUv*vec2(3.0,1.5)).a;
        skyColor += vec3(.26,.33,.45)*stars*(1.0-loungeDay)*(1.0-loungeCloud)*(1.0-clouds);
        float moonDisc = smoothstep(.9997,.99988,dot(direction,-loungeSunDirection));
        skyColor += vec3(.5,.57,.67)*moonDisc*(1.0-loungeDay)*(1.0-clouds)*(1.0-loungeCloud);
      }
      vec3 result = mix(city,skyColor,masks.r);
      float haze = (1.0-exp(-loungeMist*masks.b*2.5))*(1.0-masks.r*.45);
      diffuseColor.rgb = mix(result,loungeHorizon*(.64+loungeDay*.36),haze);
    `)
  }
  sky.material.customProgramCacheKey = () => 'lounge-atmosphere-v3-night'
  sky.material.needsUpdate = true
  const base = new THREE.PlaneGeometry(1,1), geometry = new THREE.InstancedBufferGeometry()
  geometry.index = base.index; geometry.attributes.position = base.attributes.position; geometry.attributes.uv = base.attributes.uv
  const origins = [], seeds = []
  let seed = 31827
  const random = () => { seed = (seed*1664525+1013904223)>>>0; return seed/4294967296 }
  for (let i=0;i<1000;i++) {
    const rear=i%4===0
    origins.push(rear?(random()-.5)*29:(i%2?1:-1)*(16.8+random()*17),0,rear?25.5+random()*12:-23+random()*48)
    seeds.push(random(),random(),random())
  }
  geometry.setAttribute('dropOrigin',new THREE.InstancedBufferAttribute(new Float32Array(origins),3))
  geometry.setAttribute('dropSeed',new THREE.InstancedBufferAttribute(new Float32Array(seeds),3))
  const material = new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,toneMapped:false,
    uniforms:{time:{value:0},strength:{value:0},daylight:{value:1},mist:{value:0}},
    vertexShader:`attribute vec3 dropOrigin,dropSeed; uniform float time; varying vec2 dropUV; varying float dropFade;
      void main() {
        vec3 p=dropOrigin; p.y=mod(dropSeed.x*24.0-time*(8.0+dropSeed.y*5.0),24.0)+.1;
        p.z+=sin(time*.38+dropSeed.z*6.28)*.35;
        vec4 view=modelViewMatrix*vec4(p,1.0); float depth=-view.z;
        view.xy+=vec2(position.x*(.009+dropSeed.z*.012)+position.y*.045,position.y*(.15+dropSeed.y*.35));
        dropUV=uv; dropFade=smoothstep(.1,1.5,p.y)*(1.0-smoothstep(21.0,24.0,p.y))*(1.0-smoothstep(28.0,65.0,depth));
        gl_Position=projectionMatrix*view;
      }`,
    fragmentShader:`uniform float strength,daylight,mist; varying vec2 dropUV; varying float dropFade;
      void main() {
        float edge=1.0-smoothstep(.08,.5,abs(dropUV.x-.5));
        gl_FragColor=vec4(mix(vec3(.34,.43,.55),vec3(.7,.78,.82),daylight),edge*sin(dropUV.y*3.14159)*dropFade*strength*.38*(1.0-mist*.3));
        #include <colorspace_fragment>
      }`,
  })
  const rain=new THREE.Mesh(geometry,material)
  rain.name='sky-lounge-outdoor-rain'; rain.frustumCulled=false; rain.visible=false; root.add(rain)
  // Exterior glass droplets share a single tiny instanced batch.
  const beadGeometry=new THREE.InstancedBufferGeometry()
  beadGeometry.index=base.index; beadGeometry.attributes.position=base.attributes.position; beadGeometry.attributes.uv=base.attributes.uv
  const beads=[],beadSeeds=[]
  for(let i=0;i<200;i++){beads.push(i%2?15.04:-15.04,1+random()*10,-19+random()*41);beadSeeds.push(random(),random(),random())}
  beadGeometry.setAttribute('dropOrigin',new THREE.InstancedBufferAttribute(new Float32Array(beads),3))
  beadGeometry.setAttribute('dropSeed',new THREE.InstancedBufferAttribute(new Float32Array(beadSeeds),3))
  const beadMaterial=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
    uniforms:{time:material.uniforms.time,strength:{value:0}},
    vertexShader:`attribute vec3 dropOrigin,dropSeed; uniform float time; varying vec2 dropUV; varying float beadFade;
      void main(){vec3 p=dropOrigin;float slide=fract(time*(.012+dropSeed.x*.014)+dropSeed.z);p.y-=slide*.6;
        p.zy+=position.xy*vec2(.025+dropSeed.x*.025,.055+dropSeed.y*.08);dropUV=uv*2.0-1.0;
        beadFade=smoothstep(.0,.08,slide)*(1.0-smoothstep(.9,1.0,slide));gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
    fragmentShader:`uniform float strength; varying vec2 dropUV; varying float beadFade;
      void main(){float r=dot(dropUV,dropUV);float edge=smoothstep(.28,.65,r)*(1.0-smoothstep(.65,1.0,r));
        float glint=max(0.0,dot(normalize(vec3(dropUV,sqrt(max(.0,1.0-r)))),normalize(vec3(-.4,.7,.5))));
        gl_FragColor=vec4(mix(vec3(.23,.31,.4),vec3(.8,.85,.87),glint*glint),edge*strength*beadFade*.3);
        #include <colorspace_fragment>
      }`,
  })
  const droplets=new THREE.Mesh(beadGeometry,beadMaterial)
  droplets.name='sky-lounge-window-droplets';droplets.visible=false;droplets.frustumCulled=false;root.add(droplets)
  const coveMaterials=new Set()
  const environmentTint={value:new THREE.Color(1,1,1)}, tinted=new Set()
  root.traverse(object=>{for(const item of Array.isArray(object.material)?object.material:[object.material]){
    if(item?.name==='sky-cove-light')coveMaterials.add(item)
    if(!item?.isMeshStandardMaterial||tinted.has(item))continue
    tinted.add(item)
    const compile=item.onBeforeCompile,cacheKey=item.customProgramCacheKey()
    item.onBeforeCompile=function(shader,renderer){
      compile.call(this,shader,renderer);shader.uniforms.loungeEnvironmentTint=environmentTint
      shader.fragmentShader=shader.fragmentShader.replace('#include <envmap_physical_pars_fragment>',
        'uniform vec3 loungeEnvironmentTint;\n'+THREE.ShaderChunk.envmap_physical_pars_fragment.replaceAll('envMapColor.rgb * envMapIntensity','envMapColor.rgb * envMapIntensity * loungeEnvironmentTint'))
    }
    item.customProgramCacheKey=()=>cacheKey+'|lounge-environment-tint-v2';item.needsUpdate=true
  }})
  let quality='balanced',budget=1,wetness=0
  function applyBudget(){geometry.instanceCount=Math.round((quality==='smooth'?240:quality==='high'?1000:550)*budget);beadGeometry.instanceCount=quality==='smooth'?0:Math.round((quality==='high'?200:100)*budget)}
  applyBudget()
  return {
    update(frame,time,reducedMotion,dt=1/60){
      uniforms.loungeSkyTop.value.copy(frame.skyTop);uniforms.loungeHorizon.value.copy(frame.horizon)
      uniforms.loungeCityTint.value.copy(frame.cityTint);uniforms.loungeSunColor.value.copy(frame.sunColor)
      const angle=(frame.hour-6)/24*Math.PI*2,rotation=-sky.rotation.y,x=-Math.cos(angle),z=-.45
      uniforms.loungeSunDirection.value.set(x*Math.cos(rotation)+z*Math.sin(rotation),frame.elevation,-x*Math.sin(rotation)+z*Math.cos(rotation)).normalize()
      uniforms.loungeDay.value=frame.daylight;uniforms.loungeBrightness.value=frame.cityBrightness
      uniforms.loungeCloud.value=frame.cloud;uniforms.loungeMist.value=frame.mist;uniforms.loungeTime.value=time
      rain.visible=frame.rain>.01&&!reducedMotion
      wetness+=(frame.rain-wetness)*(reducedMotion?1:1-Math.exp(-dt*.7))
      droplets.visible=wetness>.02&&beadGeometry.instanceCount>0;beadMaterial.uniforms.strength.value=wetness
      material.uniforms.time.value=time;material.uniforms.strength.value=frame.rain;material.uniforms.daylight.value=frame.daylight;material.uniforms.mist.value=frame.mist
      coveMaterials.forEach(item=>{item.emissiveIntensity=1.05+(1-frame.daylight)*1.5})
      environmentTint.value.setRGB(1,1,1).lerp(frame.ambientColor,.4)
      return !reducedMotion && Math.abs(wetness-frame.rain)>.002
    },
    setQuality(value){quality=value;applyBudget()},
    setBudget(value){const next=value<.8?.6:1;if(next!==budget){budget=next;applyBudget()}},
    getState:()=>({version:2,rainVisible:rain.visible,rainDrops:geometry.instanceCount,windowDroplets:beadGeometry.instanceCount,budget,extraDrawCalls:Number(rain.visible)+Number(droplets.visible)}),
    // Textures belong to the lounge; geometry/material disposal belongs to its tree.
  }
}
