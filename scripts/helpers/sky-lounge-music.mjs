import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

// All exhibits face the aisle and fit inside the existing cabinet footprints.
export function buildLoungeMusicExhibits(root, { walnut, marble, bronze, graphite, light }) {
  const material = (name, color, roughness, metalness = 0, extra = {}) => {
    const value = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }); value.name = name; return value
  }
  const alloy = material('sky-audio-aluminium', '#abb1b2', .32, .8)
  const rubber = material('sky-audio-rubber', '#151a1b', .82)
  const cloth = material('sky-audio-cloth', '#333c3b', .98)
  const ivory = material('sky-audio-ivory', '#e2dac5', .5)
  const red = material('sky-audio-oxblood', '#793d36', .65)
  const blue = material('sky-audio-petrol', '#31565e', .72)
  const amber = material('sky-audio-meter', '#e4bb78', .65, 0, { emissive: '#c08d43', emissiveIntensity: .35 })
  const green = material('sky-audio-led', '#a8c2a0', .45, 0, { emissive: '#8ba978', emissiveIntensity: .55 })
  let parent = root
  function group(name, position = [0, 0, 0], data = {}) {
    const object = new THREE.Group(); object.name = name; object.position.fromArray(position); object.userData = data; parent.add(object); return object
  }
  function within(object, build) { const previous = parent; parent = object; build(); parent = previous }
  function add(geometry, mat, position = [0, 0, 0]) { const mesh = new THREE.Mesh(geometry, mat); mesh.position.fromArray(position); parent.add(mesh); return mesh }
  const box = (size, mat, position, radius = .008) => add(radius ? new RoundedBoxGeometry(...size, 2, radius) : new THREE.BoxGeometry(...size), mat, position)
  const cylinder = (r, h, mat, position, axis = 'y', segments = 40) => {
    const mesh = add(new THREE.CylinderGeometry(r, r, h, segments), mat, position)
    if (axis === 'z') mesh.rotation.x = Math.PI / 2
    if (axis === 'x') mesh.rotation.z = Math.PI / 2
    return mesh
  }
  const ring = (r, t, mat, position, axis = 'z', arc = Math.PI * 2) => {
    const mesh = add(new THREE.TorusGeometry(r, t, 6, 64, arc), mat, position)
    if (axis === 'y') mesh.rotation.x = Math.PI / 2
    if (axis === 'x') mesh.rotation.y = Math.PI / 2
    return mesh
  }
  const tube = (points, r, mat) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 32, r, 6, false), mat)
  function knob(x, y, z, radius = .05) {
    cylinder(radius, .07, alloy, [x, y, z], 'z', 24)
    box([.006, radius * .52, .004], rubber, [x, y + radius * .38, z + .038], 0)
  }
  function meter(x, y, z, width = .32) {
    box([width + .04, .23, .025], rubber, [x, y, z])
    box([width, .19, .009], amber, [x, y, z + .016], .005)
    for (let i = 0; i < 9; i++) {
      const angle = -.88 + i * .22, radius = .13
      const tick = box([.006, i % 2 ? .017 : .026, .004], i > 6 ? red : graphite, [x + Math.sin(angle) * radius, y - .07 + Math.cos(angle) * radius, z + .023], 0)
      tick.rotation.z = -angle
    }
    const needle = group('sky-vu-needle', [x, y - .065, z + .029], { musicMotion: 'needle' })
    within(needle, () => { box([.005, .126, .004], red, [0, .06, 0], 0); cylinder(.015, .012, graphite, [0, 0, 0], 'z', 16) })
    needle.rotation.z = .7
  }
  function sleeve(x, y, z, color, size = .78) {
    const cover = group('sky-record-sleeve', [x, y, z])
    within(cover, () => {
      box([size, size, .03], ivory, [0, 0, 0], .005)
      box([size - .025, size - .025, .008], color, [0, 0, .022], 0)
      for (let i = 0; i < 5; i++) ring(size * (.12 + i * .035), .0035, ivory, [size * .05, size * .05, .03])
      box([size * .5, .012, .006], bronze, [-size * .15, -size * .32, .032], 0)
      box([size * .32, .006, .006], ivory, [-size * .24, -size * .37, .032], 0)
    })
    cover.rotation.x = -.10
    return cover
  }
  function taskLight() {
    cylinder(.13, .027, bronze, [-1.38, 1.12, -.70])
    tube([[-1.38, 1.14, -.70], [-1.38, 1.80, -.70], [-1.29, 2.04, -.62], [-1.02, 2.04, -.35]], .014, bronze)
    const head = box([.25, .055, .15], bronze, [-1.02, 2.04, -.32], .018); head.rotation.x = -.35
    const diffuser = box([.21, .01, .115], light, [-1.02, 2.01, -.31], .008); diffuser.rotation.x = -.35
  }
  function cabinet() {
    box([3.02, .12, 1.88], graphite, [0, .12, 0], .045)
    box([3.24, .79, 2.08], walnut, [0, .59, 0], .05)
    box([3.31, .028, 2.14], bronze, [0, .999, 0], .025)
    box([3.34, .075, 2.18], marble, [0, 1.05, 0], .025)
    box([2.89, .51, .015], cloth, [0, .56, 1.047], .018)
    // Closely spaced threads read as speaker cloth without adding a texture dependency.
    for (let x = -1.42; x < 1.43; x += .045) box([.006, .47, .006], graphite, [x, .56, 1.06], 0)
    for (const x of [-1.48, 1.48]) box([.014, .54, .02], bronze, [x, .56, 1.057], .003)
    box([2.89, .012, .012], bronze, [0, .294, 1.057], .003)
    box([2.78, .012, .009], light, [0, .221, 1.022], .002)
    box([1.02, .18, .019], graphite, [0, .877, 1.054], .008)
  }
  function turntable() {
    for (const x of [-1.11, .20]) for (const z of [-.45, .48]) cylinder(.08, .085, rubber, [x, 1.13, z])
    box([1.83, .16, 1.35], walnut, [-.46, 1.23, .02], .035)
    box([1.79, .045, 1.31], graphite, [-.46, 1.33, .02], .017)
    cylinder(.562, .055, alloy, [-.72, 1.38, .025])
    const disc = group('sky-vinyl-platter', [-.72, 1.418, .025], { musicMotion: 'record' })
    within(disc, () => {
      cylinder(.537, .015, rubber, [0, 0, 0], 'y', 96)
      for (let r = .21; r < .53; r += .024) ring(r, .0017, graphite, [0, .009, 0], 'y')
      cylinder(.16, .003, red, [0, .01, 0])
      box([.13, .002, .019], ivory, [0, .013, .069], 0)
      cylinder(.017, .045, alloy, [0, .02, 0], 'y', 20)
    })
    cylinder(.093, .14, alloy, [.24, 1.42, -.39])
    cylinder(.041, .20, graphite, [.24, 1.49, -.44], 'z')
    tube([[.24, 1.50, -.40], [.28, 1.5, -.02], [.12, 1.46, .31], [-.08, 1.44, .39]], .015, alloy)
    const cartridge = box([.067, .034, .15], graphite, [-.08, 1.423, .39]); cartridge.rotation.y = -.75
    cylinder(.053, .025, bronze, [-1.19, 1.375, .53], 'y', 24)
    cylinder(.018, .009, green, [-1.07, 1.365, .53], 'y', 16)
    box([.94, .055, .48], walnut, [.98, 1.13, -.17], .02)
    sleeve(.98, 1.64, -.22, blue, .94)
    const art = group('sky-now-playing-art', [.98, 1.64, -.185], { musicCover: true }); art.rotation.x = -.10
  }
  function tapeMachine() {
    box([2.0, .08, .73], graphite, [0, 1.14, -.10], .025)
    box([1.93, 1.42, .46], walnut, [0, 1.91, -.18], .03)
    box([1.81, 1.34, .035], alloy, [0, 1.92, .07], .017)
    for (const x of [-.48, .48]) {
      cylinder(.404, .048, rubber, [x, 2.17, .12], 'z', 64)
      const reel = group('sky-tape-reel', [x, 2.17, .17], { musicMotion: 'reel' })
      within(reel, () => {
        ring(.415, .016, alloy, [0, 0, 0]); ring(.39, .009, alloy, [0, 0, .012])
        cylinder(.10, .055, alloy, [0, 0, .014], 'z')
        for (let i = 0; i < 3; i++) {
          const spoke = box([.073, .36, .024], alloy, [Math.sin(i * 2 * Math.PI / 3) * .235, Math.cos(i * 2 * Math.PI / 3) * .235, .009], .012)
          spoke.rotation.z = -i * 2 * Math.PI / 3
        }
        cylinder(.035, .067, bronze, [0, 0, .028], 'z')
      })
    }
    tube([[-.77, 1.9, .143], [-.40, 1.70, .143], [.40, 1.70, .143], [.77, 1.9, .143]], .009, rubber)
    box([.40, .18, .11], graphite, [0, 1.72, .17], .018)
    for (const x of [-.38, .38]) cylinder(.035, .045, bronze, [x, 1.72, .18], 'z')
    meter(-.30, 1.465, .106, .36); meter(.30, 1.465, .106, .36)
    for (let i = 0; i < 5; i++) box([.11, .055, .025], i === 1 ? red : graphite, [-.30 + i * .15, 1.27, .116], .006)
    knob(-.70, 1.43, .14, .062); knob(.70, 1.43, .14, .062)
  }
  function recordLibrary() {
    box([2.75, .07, 1.24], walnut, [0, 1.15, 0], .02)
    for (const x of [-1.33, -.44, .44, 1.33]) box([.035, .32, 1.2], bronze, [x, 1.33, 0], .009)
    box([2.73, .18, .04], walnut, [0, 1.25, .60], .009)
    const colors = [blue, ivory, red]
    for (let column = 0; column < 3; column++) {
      const x = (column - 1) * .88
      for (let row = 0; row < 4; row++) sleeve(x, 1.70 - row * .025, -.43 + row * .24, colors[(column + row) % 3], .79)
      cylinder(.31, .014, rubber, [x, 2.025, -.46], 'z', 64)
      cylinder(.09, .018, bronze, [x, 2.025, -.446], 'z')
    }
  }
  function headphones() {
    const stand = group('sky-headphone-stand', [-.51, 0, -.05])
    within(stand, () => {
      box([.61, .07, .51], graphite, [0, 1.14, 0], .07)
      cylinder(.025, 1.07, bronze, [0, 1.69, -.075])
      box([.23, .08, .12], walnut, [0, 2.24, -.025], .028)
      ring(.40, .045, rubber, [0, 1.91, 0], 'z', Math.PI)
      ring(.412, .012, bronze, [0, 1.91, -.04], 'z', Math.PI)
      for (const side of [-1, 1]) {
        tube([[side * .40, 1.93, -.015], [side * .43, 1.79, -.015], [side * .39, 1.73, .05]], .014, alloy)
        const cup = cylinder(.194, .12, graphite, [side * .38, 1.78, .025], 'x'); cup.scale.set(1, 1.18, 1)
        const cushion = ring(.143, .048, rubber, [side * .305, 1.78, .025], 'x'); cushion.scale.y = 1.18
        const outer = cylinder(.17, .012, walnut, [side * .447, 1.78, .025], 'x'); outer.scale.y = 1.18
        ring(.16, .009, bronze, [side * .457, 1.78, .025], 'x').scale.y = 1.18
      }
    })
    box([1.04, .20, .72], graphite, [.83, 1.23, .12], .021)
    box([1.04, .19, .018], alloy, [.83, 1.23, .489], .01)
    knob(1.08, 1.235, .53, .10)
    cylinder(.030, .018, rubber, [.46, 1.235, .505], 'z', 20)
    cylinder(.013, .007, green, [.67, 1.235, .505], 'z', 12)
    for (let i = 0; i < 10; i++) box([.50, .003, .012], rubber, [.77, 1.334, -.10 + i * .039], 0)
    tube([[-.90, 1.60, 0], [-.92, 1.12, .32], [-.45, 1.10, .67], [.16, 1.11, .54], [.46, 1.235, .55]], .012, rubber)
  }
  function hiFi() {
    for (const x of [-1.02, 1.02]) {
      box([.68, .07, .69], graphite, [x, 1.14, -.08], .014)
      box([.64, 1.06, .61], walnut, [x, 1.705, -.08], .025)
      box([.588, 1.00, .025], rubber, [x, 1.705, .243], .015)
      for (const [y, radius] of [[1.53, .225], [2.015, .085]]) {
        cylinder(radius, .035, graphite, [x, y, .274], 'z', 48)
        ring(radius * .95, .012, alloy, [x, y, .298])
        ring(radius * .80, .015, rubber, [x, y, .312])
        const cap = add(new THREE.SphereGeometry(radius * .66, 32, 16), cloth, [x, y, .303]); cap.scale.z = .24
        for (let i = 0; i < 4; i++) cylinder(.009, .005, alloy, [x + Math.cos(Math.PI / 4 + i * Math.PI / 2) * radius * 1.15, y + Math.sin(Math.PI / 4 + i * Math.PI / 2) * radius * 1.15, .264], 'z', 8)
      }
      box([.31, .045, .025], graphite, [x, 1.26, .269], .012)
    }
    box([1.16, .32, .82], graphite, [0, 1.28, .14], .018)
    box([1.17, .30, .02], alloy, [0, 1.28, .56], .008)
    meter(-.20, 1.31, .58, .28); meter(.20, 1.31, .58, .28)
    knob(-.48, 1.26, .60, .055); knob(.48, 1.26, .60, .055)
    for (let i = 0; i < 13; i++) box([.67, .003, .015], rubber, [0, 1.443, -.18 + i * .045], 0)
  }
  function synthesizer() {
    box([2.71, .14, 1.31], graphite, [0, 1.20, .02], .03)
    for (const x of [-1.32, 1.32]) box([.12, .25, 1.31], walnut, [x, 1.26, .02], .021)
    box([2.49, .09, .58], graphite, [0, 1.365, -.34], .012)
    for (let i = 0; i < 21; i++) {
      const x = -1.15 + i * .114
      box([.108, .055, .65], ivory, [x, 1.326, .30], .007)
      if (i < 20 && [0, 1, 3, 4, 5].includes(i % 7)) box([.067, .07, .40], rubber, [x + .057, 1.38, .166], .005)
    }
    box([.42, .013, .29], rubber, [-.91, 1.417, -.32], .008)
    for (let i = 0; i < 28; i++) box([.009, .003, .015 + Math.sin(i * .5) ** 2 * .15], green, [-1.09 + i * .013, 1.426, -.32], 0)
    for (let column = 0; column < 8; column++) for (let row = 0; row < 2; row++) {
      const x = -.48 + column * .228, z = -.47 + row * .27
      cylinder(.039, .065, row ? alloy : rubber, [x, 1.444, z], 'y', 20)
      box([.004, .003, .021], ivory, [x, 1.479, z - .011], 0)
    }
    box([2.4, .012, .013], bronze, [0, 1.39, -.015], .003)
  }
  const layouts = [
    { side: -1, z: 6, id: 'vinyl', title: '黑胶唱机', subtitle: 'VINYL / 33 RPM', build: turntable },
    { side: -1, z: 1, id: 'tape', title: '开盘磁带机', subtitle: 'REEL TO REEL', build: tapeMachine },
    { side: -1, z: -4, id: 'records', title: '唱片收藏', subtitle: 'RECORD LIBRARY', build: recordLibrary },
    { side: 1, z: 6, id: 'headphones', title: '耳机试听', subtitle: 'PERSONAL LISTENING', build: headphones },
    { side: 1, z: 1, id: 'hifi', title: '高保真音响', subtitle: 'STEREO / HIGH FIDELITY', build: hiFi },
    { side: 1, z: -4, id: 'synth', title: '模拟合成器', subtitle: 'KEYS / ANALOG SYNTH', build: synthesizer },
  ]
  for (const side of [-1, 1]) {
    const bank = group(`sky-music-bank-${side}`, [0, 0, 0], { musicBatch: true })
    within(bank, () => {
      for (const layout of layouts.filter(item => item.side === side)) {
        const exhibit = group(`sky-music-${layout.id}`, [side * 11.9, 0, layout.z], { musicExhibit: layout.id })
        exhibit.rotation.y = -side * Math.PI / 2
        within(exhibit, () => {
          cabinet(); layout.build(); taskLight()
          group(`sky-music-label-${layout.id}`, [0, .877, 1.067], { musicLabel: layout.title, musicSubtitle: layout.subtitle })
        })
      }
    })
  }
}
