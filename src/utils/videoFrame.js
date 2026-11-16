// Preserve the complete source frame. Only the decorative blurred backdrop uses cover.
export function fitVideoFrame(width, height, boxWidth, boxHeight, mode = 'contain') {
  const scale = (mode === 'cover' ? Math.max : Math.min)(boxWidth / width, boxHeight / height)
  return {
    width: width * scale,
    height: height * scale,
    left: (boxWidth - width * scale) / 2,
    top: (boxHeight - height * scale) / 2,
  }
}
