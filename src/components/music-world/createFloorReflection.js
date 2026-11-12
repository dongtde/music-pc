import * as THREE from 'three'
import { Reflector } from 'three/addons/objects/Reflector.js'

// Clip in homogeneous space first: a floor usually crosses the camera's near
// plane, where projecting its four original corners would give invalid bounds.
export function createReflectionViewport(width, height, padding = 4) {
  const pools = [Array.from({ length: 16 }, () => new THREE.Vector4()), Array.from({ length: 16 }, () => new THREE.Vector4())]
  const projection = new THREE.Matrix4(), rect = new THREE.Vector4(), crop = new THREE.Matrix4()
  const distance = (v, plane) => v.w + (plane % 2 ? -1 : 1) * v.getComponent(Math.floor(plane / 2))
  return {
    rect, crop,
    update(mesh, camera) {
      const { width: w, height: h } = mesh.geometry.parameters
      projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(mesh.matrixWorld)
      let input = pools[0], output = pools[1], count = 4
      input[0].set(-w / 2, -h / 2, 0, 1).applyMatrix4(projection)
      input[1].set(w / 2, -h / 2, 0, 1).applyMatrix4(projection)
      input[2].set(w / 2, h / 2, 0, 1).applyMatrix4(projection)
      input[3].set(-w / 2, h / 2, 0, 1).applyMatrix4(projection)
      for (let plane = 0; plane < 6 && count; plane++) {
        let nextCount = 0, previous = input[count - 1], previousDistance = distance(previous, plane)
        for (let i = 0; i < count; i++) {
          const current = input[i], currentDistance = distance(current, plane)
          if ((previousDistance >= 0) !== (currentDistance >= 0)) output[nextCount++].copy(previous).lerp(current, previousDistance / (previousDistance - currentDistance))
          if (currentDistance >= 0) output[nextCount++].copy(current)
          previous = current; previousDistance = currentDistance
        }
        count = nextCount; [input, output] = [output, input]
      }
      if (!count) return false
      let left = 1, right = -1, bottom = 1, top = -1
      for (let i = 0; i < count; i++) {
        const point = input[i]
        if (point.w <= 0) return false
        const x = point.x / point.w, y = point.y / point.w
        left = Math.min(left, x); right = Math.max(right, x); bottom = Math.min(bottom, y); top = Math.max(top, y)
      }
      const x = Math.max(0, Math.floor((left * .5 + .5) * width) - padding)
      const y = Math.max(0, Math.floor((bottom * .5 + .5) * height) - padding)
      const endX = Math.min(width, Math.ceil((right * .5 + .5) * width) + padding)
      const endY = Math.min(height, Math.ceil((top * .5 + .5) * height) + padding)
      if (endX <= x || endY <= y) return false
      rect.set(x, y, endX - x, endY - y)
      // A cropped frustum mapped back into the corresponding original viewport
      // produces identical texel coordinates, resolution and blur radius.
      crop.set(width / rect.z, 0, 0, (width - 2 * x - rect.z) / rect.z,
        0, height / rect.w, 0, (height - 2 * y - rect.w) / rect.w,
        0, 0, 1, 0, 0, 0, 0, 1)
      return true
    },
  }
}

export function createFloorReflection() {
  const shader = {
    uniforms: THREE.UniformsUtils.clone(Reflector.ReflectorShader.uniforms),
    vertexShader: Reflector.ReflectorShader.vertexShader,
    fragmentShader: Reflector.ReflectorShader.fragmentShader
      .replace('vec4 base = texture2DProj( tDiffuse, vUv );', `
        vec2 uv = vUv.xy / vUv.w, offset = vec2(.0025);
        vec4 base = texture2D(tDiffuse, uv) * .4;
        base += texture2D(tDiffuse, uv + offset) * .15;
        base += texture2D(tDiffuse, uv - offset) * .15;
        base += texture2D(tDiffuse, uv + vec2(offset.x, -offset.y)) * .15;
        base += texture2D(tDiffuse, uv + vec2(-offset.x, offset.y)) * .15;`)
      .replace('vec4( blendOverlay( base.rgb, color ), 1.0 )', 'vec4( base.rgb, .18 )'),
  }
  const mesh = new Reflector(new THREE.PlaneGeometry(6.02, 42), { textureWidth: 512, textureHeight: 512, multisample: 0, clipBias: .003, shader })
  mesh.name = 'sky-lounge-floor-reflection'; mesh.rotation.x = -Math.PI / 2; mesh.position.set(0, .021, 1)
  mesh.material.transparent = true; mesh.material.depthWrite = false
  const renderTarget = mesh.getRenderTarget(), viewport = createReflectionViewport(512, 512)
  const lastCamera = new THREE.Matrix4(), lastProjection = new THREE.Matrix4(), rotation = new THREE.Matrix4()
  const origin = new THREE.Vector3(), eye = new THREE.Vector3(), normal = new THREE.Vector3(), view = new THREE.Vector3(), look = new THREE.Vector3(), target = new THREE.Vector3()
  const plane = new THREE.Plane(), clip = new THREE.Vector4(), q = new THREE.Vector4()
  const textureMatrix = mesh.material.uniforms.textureMatrix.value
  const metrics = { renders: 0, viewportPixels: 0, fullPixels: 512 * 512 }
  let lastUpdate = -Infinity, framesSinceUpdate = 0, croppedCache = false
  mesh.userData.reflectionMetrics = metrics
  // Based on Three.js Reflector's projection and oblique near-plane clipping.
  // Only the reflection frustum/viewport and redundant matrix traversal differ.
  mesh.onBeforeRender = function (renderer, scene, camera) {
    const now = performance.now(), moving = !lastCamera.equals(camera.matrixWorld) || !lastProjection.equals(camera.projectionMatrix)
    framesSinceUpdate++
    // A moving camera can expose texels outside a stationary cropped cache.
    // Refresh that cache immediately once, then keep the original moving cadence
    // with full reflections. Crop only while the camera is stationary.
    if (!this.forceUpdate && !(moving && croppedCache) && (framesSinceUpdate < (moving ? 3 : 6) || now - lastUpdate < (moving ? 50 : 100))) return
    origin.setFromMatrixPosition(mesh.matrixWorld); eye.setFromMatrixPosition(camera.matrixWorld)
    rotation.extractRotation(mesh.matrixWorld); normal.set(0, 0, 1).applyMatrix4(rotation)
    view.subVectors(origin, eye)
    if (view.dot(normal) > 0) return
    view.reflect(normal).negate().add(origin)
    rotation.extractRotation(camera.matrixWorld)
    look.set(0, 0, -1).applyMatrix4(rotation).add(eye)
    target.subVectors(origin, look).reflect(normal).negate().add(origin)
    const reflected = mesh.getReflectionCamera(camera)
    reflected.position.copy(view); reflected.up.set(0, 1, 0).applyMatrix4(rotation).reflect(normal); reflected.lookAt(target)
    reflected.far = camera.far; reflected.updateMatrixWorld()
    reflected.projectionMatrix.copy(camera.projectionMatrix)
    if (!viewport.update(mesh, reflected)) return
    if (moving) { viewport.rect.set(0, 0, 512, 512); viewport.crop.identity() }
    textureMatrix.set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1)
      .multiply(reflected.projectionMatrix).multiply(reflected.matrixWorldInverse).multiply(mesh.matrixWorld)
    plane.setFromNormalAndCoplanarPoint(normal, origin).applyMatrix4(reflected.matrixWorldInverse)
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant)
    const elements = reflected.projectionMatrix.elements
    q.set((Math.sign(clip.x) + elements[8]) / elements[0], (Math.sign(clip.y) + elements[9]) / elements[5],
      reflected.isOrthographicCamera ? -camera.far : -1, reflected.isOrthographicCamera ? 1 : (1 + elements[10]) / elements[14])
    clip.multiplyScalar(2 / clip.dot(q))
    elements[2] = clip.x; elements[6] = clip.y
    elements[10] = clip.z + (reflected.isOrthographicCamera ? 0 : 1) - .003
    elements[14] = clip.w - (reflected.isOrthographicCamera ? 1 : 0)
    reflected.projectionMatrix.premultiply(viewport.crop)
    reflected.projectionMatrixInverse.copy(reflected.projectionMatrix).invert()
    renderTarget.viewport.copy(viewport.rect); renderTarget.scissor.copy(viewport.rect); renderTarget.scissorTest = true
    const previousTarget = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel()
    const xr = renderer.xr.enabled, shadows = renderer.shadowMap.autoUpdate, matrices = scene.matrixWorldAutoUpdate, visible = mesh.visible
    mesh.visible = false; renderer.xr.enabled = false; renderer.shadowMap.autoUpdate = false
    scene.matrixWorldAutoUpdate = false // The outer render has already updated every transform.
    try {
      renderer.setRenderTarget(renderTarget); renderer.state.buffers.depth.setMask(true)
      if (renderer.autoClear === false) renderer.clear()
      renderer.render(scene, reflected)
    } finally {
      scene.matrixWorldAutoUpdate = matrices; renderer.xr.enabled = xr; renderer.shadowMap.autoUpdate = shadows
      renderer.setRenderTarget(previousTarget, face, mip)
      if (camera.viewport) renderer.state.viewport(camera.viewport)
      mesh.visible = visible
    }
    this.forceUpdate = false; lastUpdate = now; framesSinceUpdate = 0
    lastCamera.copy(camera.matrixWorld); lastProjection.copy(camera.projectionMatrix)
    croppedCache = viewport.rect.z * viewport.rect.w < metrics.fullPixels
    metrics.renders++; metrics.viewportPixels = viewport.rect.z * viewport.rect.w
  }
  return mesh
}
