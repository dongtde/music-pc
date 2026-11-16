// The DOM overlays and canvas screens share the same button palette.
export const worldControls = Object.freeze({
  accent: '#d6dbaa',
  accentHover: '#e9edc3',
  accentPressed: '#c2c995',
  onAccent: '#081d2a',
  surface: '#102d3c',
  hover: '#23434d',
  selected: '#344744',
  disabled: '#1b3036',
  muted: '#82989b',
  border: '#d6dbaa44',
  borderHover: '#d6dbaa88',
  hoverTint: '#d6dbaa29',
  selectedTint: '#d6dbaa18',
})

export const worldControlStyle = Object.freeze(Object.fromEntries(
  Object.entries(worldControls).map(([name, value]) => [
    `--world-control-${name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`,
    value,
  ]),
))
