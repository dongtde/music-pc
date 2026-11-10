// Small Canvas 2D command vocabulary shared by the screen worker and its fallback.
const paths = new Map()
export function paintScreen(ctx, frame, images) {
  const value = input => {
    if (input?.gradient) {
      const gradient = ctx.createLinearGradient(...input.points)
      for (const stop of input.stops) gradient.addColorStop(...stop)
      return gradient
    }
    return input
  }
  // Every screen submits a complete region. Reset also makes dropped intermediate
  // submissions independent of the worker's previous Canvas state.
  ctx.reset()
  ctx.scale(frame.scale, frame.scale)
  for (const [key, entry] of Object.entries(frame.state)) ctx[key] = value(entry)
  for (const [op, ...args] of frame.commands) {
    if (op === 'set') ctx[args[0]] = value(args[1])
    else if (op === 'drawImage') {
      const image = images.get(args[0])
      if (image) ctx.drawImage(image, ...args.slice(1))
    } else if (op === 'strokeSvg') {
      if (!paths.has(args[0])) paths.set(args[0], new Path2D(args[0]))
      ctx.stroke(paths.get(args[0]))
    } else ctx[op](...args)
  }
}
