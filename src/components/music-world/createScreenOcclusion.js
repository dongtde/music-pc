import { Box3, Matrix4, Plane, Vector3 } from 'three'

// Clip the HTML screen by foreground triangles, in the screen's own coordinates.
// Unlike a few visibility rays, this also preserves partially exposed content.
export function createScreenOcclusion(size) {
  const inverse = new Matrix4(), transform = new Matrix4(), bounds = new Box3()
  const eye = new Vector3(), vertex = new Vector3(), screenPlane = new Plane()
  const cameraPlane = new Plane(), normal = new Vector3(), cameraPosition = new Vector3()
  const boxPoints = Array.from({ length: 8 }, () => new Vector3())
  const cache = new WeakMap()
  const trees = new WeakMap(), localPlanes = Array.from({ length: 6 }, () => new Plane())
  const toObject = new Matrix4()
  const epsilon = 1e-5

  function clip(polygon, distance) {
    const result = []
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length]
      const da = distance(a), db = distance(b)
      if (da >= 0) result.push(a)
      if ((da >= 0) !== (db >= 0)) {
        const t = da / (da - db)
        result.push(a.map((value, axis) => value + (b[axis] - value) * t))
      }
    }
    return result
  }
  const area = polygon => polygon.reduce((sum, p, i) => {
    const q = polygon[(i + 1) % polygon.length]
    return sum + p[0] * q[1] - p[1] * q[0]
  }, 0)

  return (screen, camera, roots) => {
    inverse.copy(screen.matrixWorld).invert()
    eye.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(inverse)
    const width = screen.geometry.parameters.width, height = screen.geometry.parameters.height
    screenPlane.set(new Vector3(0, 0, 1), -.003)
    cameraPosition.setFromMatrixPosition(camera.matrixWorld)
    normal.set(0, 0, -1).transformDirection(camera.matrixWorld)
    cameraPlane.setFromNormalAndCoplanarPoint(normal, cameraPosition.addScaledVector(normal, camera.near))
    cameraPlane.applyMatrix4(inverse)
    const project = p => {
      const t = eye.z / (eye.z - p[2])
      return [(eye.x + (p[0] - eye.x) * t) / width * size + size / 2,
        size / 2 - (eye.y + (p[1] - eye.y) * t) / height * size]
    }
    const distance = (plane, p) => plane.normal.x * p[0] + plane.normal.y * p[1] + plane.normal.z * p[2] + plane.constant
    const cutters = []
    const planes = [screenPlane, new Plane(new Vector3(0, 0, -1), eye.z - epsilon),
      new Plane(new Vector3(eye.z, 0, -eye.x - width / 2), eye.z * width / 2),
      new Plane(new Vector3(-eye.z, 0, eye.x - width / 2), eye.z * width / 2),
      new Plane(new Vector3(0, eye.z, -eye.y - height / 2), eye.z * height / 2),
      new Plane(new Vector3(0, -eye.z, eye.y - height / 2), eye.z * height / 2)].map(plane => plane.clone().normalize())
    for (const root of roots) root?.traverseVisible(object => {
      if (!object.isMesh || object === screen || !object.geometry || !object.material) return
      const mats = Array.isArray(object.material) ? object.material : [object.material]
      if (!mats.some(m => m.visible && m.depthWrite && (!m.transparent || m.opacity >= .98))) return
      transform.multiplyMatrices(inverse, object.matrixWorld)
      if (object.isSkinnedMesh) { object.computeBoundingBox(); bounds.copy(object.boundingBox) }
      else { if (!object.geometry.boundingBox) object.geometry.computeBoundingBox(); bounds.copy(object.geometry.boundingBox) }
      let index = 0
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) boxPoints[index++].set(x, y, z).applyMatrix4(transform)
      if (boxPoints.every(p => p.z < .003) || boxPoints.every(p => cameraPlane.distanceToPoint(p) < 0)) return
      if (boxPoints.every(p => p.z < eye.z - epsilon)) {
        const projected = boxPoints.map(p => project(p.toArray()))
        if (projected.every(p => p[0] < 0) || projected.every(p => p[0] > size) || projected.every(p => p[1] < 0) || projected.every(p => p[1] > size)) return
      }
      const geometry = object.geometry, indices = geometry.index, positions = geometry.attributes.position
      const start = geometry.drawRange.start, end = Math.min(indices?.count ?? positions.count, start + geometry.drawRange.count)
      // Batched hall meshes span the entire room. A cached triangle tree avoids
      // projecting thousands of unrelated floor/wall faces every animation frame.
      let candidates = []
      if (!object.isSkinnedMesh && !geometry.morphAttributes.position?.length) {
        if (!trees.has(geometry)) {
          const triangles = []
          for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
            const box = new Box3()
            for (let k = 0; k < 3; k++) box.expandByPoint(vertex.fromBufferAttribute(positions, indices ? indices.getX(i + k) : i + k))
            triangles.push({ i, box, center: box.getCenter(new Vector3()) })
          }
          const build = items => {
            const box = new Box3(); items.forEach(t => box.union(t.box))
            if (items.length <= 16) return { box, items }
            const span = box.getSize(new Vector3()), axis = span.x > span.y && span.x > span.z ? 'x' : span.y > span.z ? 'y' : 'z'
            items.sort((a, b) => a.center[axis] - b.center[axis])
            const mid = items.length >> 1
            return { box, children: [build(items.slice(0, mid)), build(items.slice(mid))] }
          }
          trees.set(geometry, build(triangles))
        }
        toObject.copy(transform).invert()
        planes.forEach((plane, i) => localPlanes[i].copy(plane).applyMatrix4(toObject))
        const outside = box => localPlanes.some(plane => {
          const n = plane.normal
          return plane.distanceToPoint(vertex.set(n.x >= 0 ? box.max.x : box.min.x, n.y >= 0 ? box.max.y : box.min.y, n.z >= 0 ? box.max.z : box.min.z)) < 0
        })
        const visit = node => {
          if (outside(node.box)) return
          if (node.items) node.items.forEach(t => { if (t.i >= start && t.i < end && !outside(t.box)) candidates.push(t.i) })
          else node.children.forEach(visit)
        }
        visit(trees.get(geometry))
      } else for (let i = start; i < end; i += 3) candidates.push(i)
      for (const i of candidates) {
        const group = mats.length > 1 ? geometry.groups.find(g => i >= g.start && i < g.start + g.count) : null
        const material = mats[group?.materialIndex ?? 0]
        if (!material?.visible || !material.depthWrite || material.transparent && material.opacity < .98) continue
        let triangle = [0, 1, 2].map(offset => {
          object.getVertexPosition(indices ? indices.getX(i + offset) : i + offset, vertex)
          return vertex.applyMatrix4(transform).toArray()
        })
        triangle = clip(triangle, p => distance(screenPlane, p))
        triangle = clip(triangle, p => distance(cameraPlane, p))
        triangle = clip(triangle, p => eye.z - epsilon - p[2])
        if (triangle.length < 3) continue
        let polygon = triangle.map(project)
        for (const side of [p => p[0], p => size - p[0], p => p[1], p => size - p[1]]) polygon = clip(polygon, side)
        if (polygon.length < 3 || Math.abs(area(polygon)) < .01) continue
        if (area(polygon) < 0) polygon.reverse()
        cutters.push(polygon)
      }
    })
    if (!cutters.length) return ''
    const signature = cutters.map(p => p.map(v => v.map(n => n.toFixed(2)).join(',')).join(' ')).join('|')
    if (cache.get(screen)?.signature === signature) return cache.get(screen).path
    // Union covered intervals at one logical pixel per row. Repeated polygon
    // subtraction fragments bevelled furniture into thousands of tiny shapes;
    // scanlines bound both the work and the CSS path size, including on mobile.
    const rows = Array.from({ length: size }, () => [])
    for (const cutter of cutters) {
      const first = Math.max(0, Math.floor(Math.min(...cutter.map(p => p[1]))))
      const last = Math.min(size, Math.ceil(Math.max(...cutter.map(p => p[1]))))
      for (let y = first; y < last; y++) {
        let left = size, right = 0
        for (let i = 0; i < cutter.length; i++) {
          const a = cutter[i], b = cutter[(i + 1) % cutter.length]
          if (a[1] >= y && a[1] <= y + 1) { left = Math.min(left, a[0]); right = Math.max(right, a[0]) }
          if (Math.abs(b[1] - a[1]) < epsilon) continue
          for (const edge of [y, y + 1]) {
            const t = (edge - a[1]) / (b[1] - a[1])
            if (t >= 0 && t <= 1) { const x = a[0] + (b[0] - a[0]) * t; left = Math.min(left, x); right = Math.max(right, x) }
          }
        }
        if (right > left) rows[y].push([Math.max(0, Math.floor(left)), Math.min(size, Math.ceil(right))])
      }
    }
    const rectangles = [], open = new Map()
    rows.forEach((intervals, y) => {
      intervals.sort((a, b) => a[0] - b[0])
      const visible = []; let end = 0
      for (const [left, right] of intervals) { if (left > end) visible.push([end, left]); end = Math.max(end, right) }
      if (end < size) visible.push([end, size])
      const keys = new Set()
      for (const [left, right] of visible) {
        const key = left + ':' + right; keys.add(key)
        if (open.has(key)) open.get(key).bottom = y + 1
        else { const rect = { left, right, top: y, bottom: y + 1 }; rectangles.push(rect); open.set(key, rect) }
      }
      for (const key of open.keys()) if (!keys.has(key)) open.delete(key)
    })
    const path = rectangles.length ? `path("${rectangles.map(r => `M${r.left} ${r.top}H${r.right}V${r.bottom}H${r.left}Z`).join('')}")` : 'path("M0 0Z")'
    cache.set(screen, { signature, path })
    return path
  }
}
