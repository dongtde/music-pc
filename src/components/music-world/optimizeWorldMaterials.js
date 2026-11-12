import { ShaderChunk } from 'three'

const optimized = new WeakSet()
// Test the finite light volume before normalization, attenuation and BRDF work.
// Coordinates match getPointLightInfo/getSpotLightInfo (both are in view space).
const lightVolumes = `
#if NUM_POINT_LIGHTS > 0
bool worldPointLightAffects( const in PointLight light, const in vec3 position ) {
  vec3 offset = light.position - position;
  return light.distance <= 0.0 || dot( offset, offset ) < light.distance * light.distance;
}
#endif
#if NUM_SPOT_LIGHTS > 0
bool worldSpotLightAffects( const in SpotLight light, const in vec3 position ) {
  vec3 offset = light.position - position;
  float distanceSquared = dot( offset, offset );
  float alongCone = dot( offset, light.direction );
  // Non-positive coneCos describes a wide cone; leave its test to Three.js.
  bool insideCone = light.coneCos <= 0.0 || ( alongCone > 0.0 && alongCone * alongCone > distanceSquared * light.coneCos * light.coneCos );
  return insideCone && ( light.distance <= 0.0 || distanceSquared < light.distance * light.distance );
}
#endif
`
// Keep the same light slots/program during fades, but skip zero-intensity lights
// before attenuation and BRDF work. Three's standard loop still evaluates them.
const lighting = ShaderChunk.lights_fragment_begin.replace(
  /(for \( int i = 0; i < NUM_(POINT|SPOT)_LIGHTS; i \+\+ \) \{)([\s\S]*?)(\n\t\}\n\t#pragma unroll_loop_end)/g,
  (_, start, kind, body, end) => {
    const lights = kind === 'POINT' ? 'pointLights' : 'spotLights'
    const affects = kind === 'POINT' ? 'worldPointLightAffects' : 'worldSpotLightAffects'
    const shaded = body.replace(/(\bRE_Direct\([^;]+;)/g, 'if ( directLight.visible ) { $1 }')
    return `${start}\n\t\tif ( any( notEqual( ${lights}[ i ].color, vec3( 0.0 ) ) ) && ${affects}( ${lights}[ i ], geometryPosition ) ) {${shaded}\n\t\t}${end}`
  },
)

export function optimizeWorldMaterials(root) {
  root.traverse(object => {
    if (!object.isMesh) return
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material.isMeshStandardMaterial || optimized.has(material)) continue
      optimized.add(material)
      const compile = material.onBeforeCompile, cacheKey = material.customProgramCacheKey()
      material.onBeforeCompile = function (shader, renderer) {
        compile.call(this, shader, renderer)
        shader.fragmentShader = shader.fragmentShader.replace('#include <lights_pars_begin>', '#include <lights_pars_begin>\n' + lightVolumes)
        shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>', lighting)
      }
      material.customProgramCacheKey = () => `${cacheKey}|world-direct-lights-v2`
      material.needsUpdate = true
    }
  })
}
