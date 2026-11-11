import { Matrix4, Vector3, Vector4 } from 'three'

export const SCREEN_INPUT_SIZE = 512

// Map a DOM surface's logical pixels onto the same plane used by WebGL.
// Keeping the perspective denominator preserves alignment at oblique angles.
export function createScreenProjection() {
  const local = new Matrix4(), clip = new Matrix4(), point = new Vector4()
  const position = new Vector3(), normal = new Vector3(), eye = new Vector3()
  return (mesh, camera, { width, height, left = 0, top = 0 }) => {
    if (!mesh || width <= 0 || height <= 0) return null
    for (let parent = mesh; parent; parent = parent.parent) if (!parent.visible) return null
    mesh.updateWorldMatrix(true, false)
    camera.updateWorldMatrix(true, false)
    position.setFromMatrixPosition(mesh.matrixWorld)
    normal.set(0, 0, 1).transformDirection(mesh.matrixWorld)
    eye.setFromMatrixPosition(camera.matrixWorld).sub(position)
    if (normal.dot(eye) <= 0) return null
    const { width: planeWidth, height: planeHeight } = mesh.geometry.parameters
    local.set(
      planeWidth / SCREEN_INPUT_SIZE, 0, 0, -planeWidth / 2,
      0, -planeHeight / SCREEN_INPUT_SIZE, 0, planeHeight / 2,
      0, 0, 1, 0,
      0, 0, 0, 1,
    )
    clip.copy(camera.projectionMatrix).multiply(camera.matrixWorldInverse).multiply(mesh.matrixWorld).multiply(local)
    const corners = []
    for (const [x, y] of [[0, 0], [SCREEN_INPUT_SIZE, 0], [SCREEN_INPUT_SIZE, SCREEN_INPUT_SIZE], [0, SCREEN_INPUT_SIZE]]) {
      point.set(x, y, 0, 1).applyMatrix4(clip)
      if (point.w <= 0 || point.z < -point.w || point.z > point.w) return null
      corners.push({ x: point.x / point.w, y: point.y / point.w })
    }
    if (corners.every(p => p.x < -1) || corners.every(p => p.x > 1) || corners.every(p => p.y < -1) || corners.every(p => p.y > 1)) return null
    const e = clip.elements, sx = width / 2, sy = height / 2, divisor = e[15]
    const x = i => (sx * e[i] + (sx + left) * e[i + 3]) / divisor
    const y = i => (-sy * e[i + 1] + (sy + top) * e[i + 3]) / divisor
    const matrix = [x(0), y(0), 0, e[3] / divisor, x(4), y(4), 0, e[7] / divisor, 0, 0, 1, 0, x(12), y(12), 0, 1]
    return { transform: `matrix3d(${matrix.map(value => Number(value.toFixed(10))).join(',')})`, size: SCREEN_INPUT_SIZE }
  }
}
