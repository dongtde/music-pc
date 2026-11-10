import { ShaderChunk } from 'three'

const optimized = new WeakSet()
// Keep the same light slots/program during fades, but skip zero-intensity lights
// before attenuation and BRDF work. Three's standard loop still evaluates them.
const lighting = ShaderChunk.lights_fragment_begin.replace(
  /(for \( int i = 0; i < NUM_(POINT|SPOT)_LIGHTS; i \+\+ \) \{)([\s\S]*?)(\n\t\}\n\t#pragma unroll_loop_end)/g,
  (_, start, kind, body, end) => {
    const lights = kind === 'POINT' ? 'pointLights' : 'spotLights'
    const shaded = body.replace(/(\bRE_Direct\([^;]+;)/g, 'if ( directLight.visible ) { $1 }')
    return `${start}\n\t\tif ( any( notEqual( ${lights}[ i ].color, vec3( 0.0 ) ) ) ) {${shaded}\n\t\t}${end}`
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
        shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>', lighting)
      }
      material.customProgramCacheKey = () => `${cacheKey}|world-direct-lights-v1`
      material.needsUpdate = true
    }
  })
}
