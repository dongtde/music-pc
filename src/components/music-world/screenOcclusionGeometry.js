import { Box3, Matrix4, Vector3 } from 'three'

// Keep exact triangles, but reject animated body parts using conservative bone
// bounds before skinning vertices. Trees are shared by instances of a geometry.
export function createOcclusionGeometry() {
  const trees = new WeakMap(), poses = new WeakMap()
  const vertex = new Vector3(), point = new Vector3(), matrix = new Matrix4()
  let frame = 0
  function treeFor(object) {
    const geometry = object.geometry
    if (trees.has(geometry)) return trees.get(geometry)
    const position = geometry.attributes.position, indices = geometry.index
    const skin = object.isSkinnedMesh && geometry.attributes.skinIndex && geometry.attributes.skinWeight
    const triangles = []
    for (let i = 0; i < (indices?.count ?? position.count); i += 3) {
      const box = new Box3()
      for (let k = 0; k < 3; k++) box.expandByPoint(vertex.fromBufferAttribute(position, indices ? indices.getX(i + k) : i + k))
      triangles.push({ i, box, center: box.getCenter(new Vector3()) })
    }
    function build(items) {
      const box = new Box3(); items.forEach(item => box.union(item.box))
      const node = { box, bones: skin ? new Map() : null }
      if (items.length <= 32) {
        node.items = items
        if (skin) {
          const vertices = new Set()
          for (const item of items) for (let k = 0; k < 3; k++) vertices.add(indices ? indices.getX(item.i + k) : item.i + k)
          for (const id of vertices) {
            vertex.fromBufferAttribute(position, id).applyMatrix4(object.bindMatrix)
            for (let k = 0; k < 4; k++) {
              if (geometry.attributes.skinWeight.getComponent(id, k) <= 0) continue
              const bone = geometry.attributes.skinIndex.getComponent(id, k)
              if (!node.bones.has(bone)) node.bones.set(bone, new Box3())
              node.bones.get(bone).expandByPoint(vertex)
            }
          }
        }
      } else {
        const span = box.getSize(new Vector3()), axis = span.x > span.y && span.x > span.z ? 'x' : span.y > span.z ? 'y' : 'z'
        items.sort((a, b) => a.center[axis] - b.center[axis])
        const mid = items.length >> 1
        node.children = [build(items.slice(0, mid)), build(items.slice(mid))]
        if (skin) for (const child of node.children) for (const [bone, bound] of child.bones) {
          if (!node.bones.has(bone)) node.bones.set(bone, bound.clone())
          else node.bones.get(bone).union(bound)
        }
      }
      return node
    }
    const tree = build(triangles)
    trees.set(geometry, tree)
    return tree
  }
  function poseFor(object) {
    let pose = poses.get(object)
    if (!pose) {
      pose = { frame: -1, bounds: new WeakMap(), matrices: object.skeleton.bones.map(() => new Matrix4()) }
      poses.set(object, pose)
    }
    if (pose.frame !== frame) {
      pose.frame = frame
      object.skeleton.bones.forEach((bone, i) => pose.matrices[i].multiplyMatrices(object.bindMatrixInverse, matrix.multiplyMatrices(bone.matrixWorld, object.skeleton.boneInverses[i])))
    }
    return pose
  }
  function boundsFor(node, object) {
    if (!node.bones) return node.box
    const pose = poseFor(object)
    let entry = pose.bounds.get(node)
    if (!entry) { entry = { frame: -1, box: new Box3() }; pose.bounds.set(node, entry) }
    if (entry.frame === frame) return entry.box
    entry.frame = frame; entry.box.makeEmpty()
    for (const [bone, bound] of node.bones) {
      const transform = pose.matrices[bone]
      for (let i = 0; i < 8; i++) entry.box.expandByPoint(point.set(i & 1 ? bound.max.x : bound.min.x, i & 2 ? bound.max.y : bound.min.y, i & 4 ? bound.max.z : bound.min.z).applyMatrix4(transform))
    }
    return entry.box
  }
  return {
    beginFrame() { frame++ },
    prepare(root) { root.traverse(object => { if (object.isMesh && object.geometry?.attributes.position) treeFor(object) }) },
    bounds(object) { return boundsFor(treeFor(object), object) },
    candidates(object, outside) {
      const geometry = object.geometry, start = geometry.drawRange.start
      const end = Math.min(geometry.index?.count ?? geometry.attributes.position.count, start + geometry.drawRange.count)
      const result = []
      const visit = node => {
        if (outside(boundsFor(node, object))) return
        if (node.items) {
          for (const item of node.items) if (item.i >= start && item.i < end && (node.bones || !outside(item.box))) result.push(item.i)
        } else node.children.forEach(visit)
      }
      visit(treeFor(object))
      return result
    },
  }
}
