import { Color, MathUtils } from 'three'

export const LOUNGE_CLIMATE_KEY = 'lanyin.world.lounge-climate'
export const LOUNGE_WEATHERS = [
  { id: 'clear', label: '晴天' }, { id: 'cloudy', label: '阴天' },
  { id: 'rain', label: '小雨' }, { id: 'fog', label: '雾天' },
]
export const LOUNGE_TIMES = [
  { hour: 6.5, label: '清晨' }, { hour: 12, label: '白天' },
  { hour: 17.5, label: '黄昏' }, { hour: 22, label: '夜晚' },
]
export const DEFAULT_LOUNGE_CLIMATE = { weather: 'clear', hour: 17.5, mode: 'manual' }
export const wrapHour = hour => ((hour % 24) + 24) % 24

export function normalizeLoungeClimate(value) {
  const source = value && typeof value === 'object' ? value : {}
  const hour = typeof source.hour === 'number' && Number.isFinite(source.hour) ? wrapHour(source.hour) : 17.5
  return {
    weather: LOUNGE_WEATHERS.some(item => item.id === source.weather) ? source.weather : 'clear',
    hour,
    mode: ['manual', 'local', 'cycle'].includes(source.mode) ? source.mode : 'manual',
  }
}

export function formatLoungeTime(hour) {
  const minutes = Math.round(wrapHour(hour) * 60) % 1440
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

export function loungeClockHour(settings, now, cycleStart = now, cycleHour = settings.hour) {
  if (settings.mode === 'local') {
    const date = new Date(now)
    return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600
  }
  // One full day in twelve minutes. Wall time also survives suspended rendering.
  return settings.mode === 'cycle' ? wrapHour(cycleHour + (now - cycleStart) / 30000) : settings.hour
}

const profiles = [
  [0, '#050c17', '#101923', '#7e9dcc', '#607b9a', '#687995'],
  [5, '#0a1426', '#343649', '#a5b5da', '#7385a2', '#8995aa'],
  [6.5, '#789bb8', '#edba9a', '#ffd0a5', '#c4d6e4', '#e2bca2'],
  [10, '#639ac3', '#c8deea', '#fff1d9', '#dceaf4', '#e4eff8'],
  [15, '#679dc5', '#d2e1e8', '#ffe4bd', '#dae6ee', '#f4ecdf'],
  [17.5, '#758ba8', '#e4a47b', '#ffc18a', '#d4d7e2', '#eec09a'],
  [19, '#283c61', '#bb7975', '#e7a78d', '#889bb9', '#ac9eac'],
  [20.5, '#050c17', '#101923', '#7e9dcc', '#607b9a', '#687995'],
  [24, '#050c17', '#101923', '#7e9dcc', '#607b9a', '#687995'],
]
const weatherProfiles = {
  clear: { cloud: .12, rain: 0, mist: 0, sun: 1 },
  cloudy: { cloud: .85, rain: 0, mist: .18, sun: .28 },
  rain: { cloud: 1, rain: 1, mist: .34, sun: .12 },
  fog: { cloud: .55, rain: 0, mist: .78, sun: .18 },
}
const profileColors = profiles.map(profile => profile.slice(1).map(color => new Color(color)))
const nightOvercast = new Color('#101923'), dayOvercast = new Color('#889eae'), overcast = new Color(), greyCity = new Color('#a7b8c8')
const colorKeys = ['skyTop', 'horizon', 'sunColor', 'ambientColor', 'cityTint']

export function sampleLoungeClimate(hour, weather = 'clear', output = {}) {
  hour = wrapHour(hour)
  const index = profiles.findIndex((profile, i) => i < profiles.length - 1 && hour >= profile[0] && hour < profiles[i + 1][0])
  const a = profiles[index], b = profiles[index + 1]
  const blend = MathUtils.smoothstep(hour, a[0], b[0])
  const elevation = Math.sin((hour - 6) / 24 * Math.PI * 2)
  const daylight = MathUtils.smoothstep(elevation, -.16, .45)
  const atmosphere = weatherProfiles[weather] || weatherProfiles.clear
  for (let i = 0; i < colorKeys.length; i++) {
    const key = colorKeys[i]
    if (!output[key]) output[key] = new Color()
    output[key].copy(profileColors[index][i]).lerp(profileColors[index + 1][i], blend)
  }
  const { skyTop, horizon, sunColor, ambientColor, cityTint } = output
  overcast.copy(nightOvercast).lerp(dayOvercast, daylight)
  skyTop.lerp(overcast, atmosphere.cloud * .72)
  horizon.lerp(overcast, atmosphere.cloud * .66)
  cityTint.lerp(greyCity, atmosphere.cloud * .45)
  return Object.assign(output, {
    hour, daylight, elevation, ...atmosphere, skyTop, horizon, sunColor, ambientColor, cityTint,
    sunIntensity: (.1 + daylight * 2.1) * atmosphere.sun,
    ambientIntensity: (.38 + daylight * .82) * (1 - atmosphere.cloud * .22),
    environmentIntensity: .08 + daylight * .34 * (1 - atmosphere.cloud * .35),
    practicalIntensity: 38 * (1.55 - daylight * .95),
    fogDensity: .0015 + atmosphere.mist * .002,
    cityBrightness: (.018 + daylight * .982) * (1 - atmosphere.cloud * .22),
  })
}
