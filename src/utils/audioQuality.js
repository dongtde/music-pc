export const DEFAULT_AUDIO_QUALITY = '128'

export const PLAYBACK_AUDIO_QUALITIES = ['high', 'flac', '320', '128']

export const AUDIO_QUALITY_DEFINITIONS = [
  {
    value: '128',
    label: '标准音质',
    shortLabel: '128K',
    badgeLabel: '128',
    description: '快速清晰的音质',
    rank: 10
  },
  {
    value: '320',
    label: '高品音质',
    shortLabel: '320K',
    badgeLabel: 'HQ',
    description: '高频细节还原清晰细节',
    rank: 20
  },
  {
    value: 'flac',
    label: '无损音质',
    shortLabel: 'FLAC',
    badgeLabel: 'SQ',
    description: '高保真无损品质',
    rank: 30
  },
  {
    value: 'high',
    label: 'Hi-Res 音质',
    shortLabel: 'Hi-Res',
    badgeLabel: 'Hi-Res',
    description: '超越 CD 品质',
    rank: 40
  }
]

const AUDIO_QUALITY_MAP = new Map(AUDIO_QUALITY_DEFINITIONS.map((item) => [item.value, item]))

const AUDIO_QUALITY_ALIASES = new Map([
  ['standard', '128'],
  ['normal', '128'],
  ['low', '128'],
  ['mp3', '128'],
  ['128k', '128'],
  ['128kbps', '128'],
  ['hq', '320'],
  ['highquality', '320'],
  ['320k', '320'],
  ['320kbps', '320'],
  ['sq', 'flac'],
  ['lossless', 'flac'],
  ['无损', 'flac'],
  ['flac', 'flac'],
  ['hires', 'high'],
  ['hi-res', 'high'],
  ['high', 'high'],
  ['res', 'high'],
  ['viper', 'high'],
  ['viperclear', 'high'],
  ['viper_clear', 'high'],
  ['viperatmos', 'high'],
  ['viper_atmos', 'high'],
  ['atmos', 'high'],
  ['vipertape', 'high'],
  ['viper_tape', 'high'],
  ['master', 'high'],
  ['tape', 'high'],
  ['dsd', 'high'],
  ['super', 'high']
])

const QUALITY_FIELDS = {
  '128': [
    'hash',
    'Hash',
    'FileHash',
    'file_hash',
    'audio_hash',
    'hash_128',
    '128hash',
    'audio_info.hash_128',
    'audioInfo.hash_128',
    'deprecated.hash',
    'filesize',
    'FileSize',
    'file_size',
    'filesize_128',
    'file_size_128',
    'size_128',
    'audio_info.filesize_128',
    'audioInfo.filesize_128'
  ],
  '320': [
    'HQFileHash',
    'hq_file_hash',
    'hqhash',
    'hash_320',
    '320hash',
    'audio_info.hash_320',
    'audioInfo.hash_320',
    'HQFileSize',
    'hqfilesize',
    'filesize_320',
    'file_size_320',
    'size_320',
    'audio_info.filesize_320',
    'audioInfo.filesize_320'
  ],
  flac: [
    'SQFileHash',
    'sq_file_hash',
    'sqhash',
    'hash_flac',
    'flachash',
    'audio_info.hash_flac',
    'audioInfo.hash_flac',
    'SQFileSize',
    'sqfilesize',
    'filesize_flac',
    'file_size_flac',
    'size_flac',
    'audio_info.filesize_flac',
    'audioInfo.filesize_flac'
  ],
  high: [
    'ResFileHash',
    'res_file_hash',
    'reshash',
    'hash_high',
    'high_hash',
    'audio_info.hash_high',
    'audioInfo.hash_high',
    'ResFileSize',
    'resfilesize',
    'filesize_high',
    'file_size_high',
    'size_high',
    'audio_info.filesize_high',
    'audioInfo.filesize_high',
    'viper_clear_hash',
    'viperClearHash',
    'hash_viper_clear',
    'audio_info.viper_clear_hash',
    'audioInfo.viper_clear_hash',
    'viper_atmos_hash',
    'viperAtmosHash',
    'hash_viper_atmos',
    'audio_info.viper_atmos_hash',
    'audioInfo.viper_atmos_hash',
    'viper_tape_hash',
    'viperTapeHash',
    'hash_viper_tape',
    'audio_info.viper_tape_hash',
    'audioInfo.viper_tape_hash',
    'super_hash',
    'dsd_hash',
    'hash_super',
    'hash_dsd',
    'audio_info.super_hash',
    'audioInfo.super_hash'
  ]
}

const QUALITY_COLLECTION_KEYS = [
  'qualities',
  'qualityOptions',
  'quality_options',
  'audioQualities',
  'audio_qualities',
  'playable_qualities',
  'quality_list',
  'qualityList',
  'supported_quality',
  'supportedQuality'
]

export function normalizeAudioQualityValue(value) {
  if (value === undefined || value === null || value === '') {
    return ''
  }

  const raw = String(value).trim()
  const key = raw.toLowerCase().replace(/\s+/g, '').replace(/-/g, '_')

  if (AUDIO_QUALITY_MAP.has(raw)) {
    return raw
  }

  if (AUDIO_QUALITY_MAP.has(key)) {
    return key
  }

  return AUDIO_QUALITY_ALIASES.get(key) || ''
}

export function getAudioQualityDefinition(value) {
  const normalized = normalizeAudioQualityValue(value) || DEFAULT_AUDIO_QUALITY

  return AUDIO_QUALITY_MAP.get(normalized) ?? AUDIO_QUALITY_MAP.get(DEFAULT_AUDIO_QUALITY)
}

export function normalizeAudioQualities(source = {}) {
  const values = new Set()

  collectQualityValues(source).forEach((value) => addQuality(values, value))

  Object.entries(QUALITY_FIELDS).forEach(([quality, fields]) => {
    if (fields.some((field) => isPresentValue(readPath(source, field)))) {
      values.add(quality)
    }
  })

  return sortAudioQualityValues([...values])
}

export function getAudioQualityOptions(track = {}, options = {}) {
  return getAudioQualityValuesForTrack(track, options)
    .map((quality) => AUDIO_QUALITY_MAP.get(quality))
    .filter(Boolean)
}

export function getAudioQualityValuesForTrack(track = {}, options = {}) {
  const highestQuality = getTrackHighestAudioQuality(track, options)
  const highestRank = getAudioQualityRank(highestQuality)

  return PLAYBACK_AUDIO_QUALITIES.filter((quality) => getAudioQualityRank(quality) <= highestRank)
}

export function getTrackHighestAudioQuality(track = {}, options = {}) {
  const fallbackQuality =
    normalizeAudioQualityValue(options.fallbackQuality) ||
    PLAYBACK_AUDIO_QUALITIES[0] ||
    DEFAULT_AUDIO_QUALITY
  const detectedQualities = normalizeTrackQualityValues(track)
  const qualities =
    shouldUseFallbackQuality(detectedQualities, options)
      ? [fallbackQuality]
      : detectedQualities

  return (
    qualities
      .filter(Boolean)
      .sort((current, next) => getAudioQualityRank(next) - getAudioQualityRank(current))[0] ||
    fallbackQuality
  )
}

export function getAudioQualityBadges(track = {}, options = {}) {
  const limit = Math.max(1, Number(options.limit) || 1)
  const includeDefault = options.includeDefault === true
  const fallbackQuality = includeDefault
    ? normalizeAudioQualityValue(options.fallbackQuality) ||
      PLAYBACK_AUDIO_QUALITIES[0] ||
      DEFAULT_AUDIO_QUALITY
    : ''
  const detectedQualities = normalizeTrackQualityValues(track)
  const qualities = (
    includeDefault && shouldUseFallbackQuality(detectedQualities, options)
      ? [fallbackQuality]
      : detectedQualities
  )
    .filter((quality) => includeDefault || quality !== DEFAULT_AUDIO_QUALITY)
    .sort((current, next) => getAudioQualityRank(next) - getAudioQualityRank(current))

  return (qualities.length ? qualities : [fallbackQuality])
    .filter(Boolean)
    .slice(0, limit)
    .map((quality) => AUDIO_QUALITY_MAP.get(quality))
    .filter(Boolean)
}

function normalizeTrackQualityValues(track = {}) {
  if (Array.isArray(track)) {
    return sortAudioQualityValues(track.map(normalizeAudioQualityValue).filter(Boolean))
  }

  if (Array.isArray(track?.qualities) && track.qualities.length) {
    return sortAudioQualityValues(track.qualities.map(normalizeAudioQualityValue).filter(Boolean))
  }

  return normalizeAudioQualities(track)
}

function collectQualityValues(source = {}) {
  if (!source || typeof source !== 'object') {
    return []
  }

  const values = []

  QUALITY_COLLECTION_KEYS.forEach((key) => {
    values.push(...splitQualityValues(source[key]))
  })

  values.push(...splitQualityValues(source.quality))
  values.push(...splitQualityValues(source.audio_info?.quality))
  values.push(...splitQualityValues(source.audioInfo?.quality))
  values.push(...splitQualityValues(source.trans_param?.quality))

  return values
}

function splitQualityValues(value) {
  if (value === undefined || value === null || value === '') {
    return []
  }

  if (Array.isArray(value)) {
    return value.flatMap(splitQualityValues)
  }

  if (typeof value === 'object') {
    return splitQualityValues(value.quality ?? value.type ?? value.value ?? value.name ?? value.label)
  }

  return String(value)
    .split(/[,|/]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function addQuality(values, value) {
  const normalized = normalizeAudioQualityValue(value)

  if (normalized) {
    values.add(normalized)
  }
}

function sortAudioQualityValues(values = []) {
  return [...new Set(values)]
    .filter((value) => AUDIO_QUALITY_MAP.has(value))
    .sort((current, next) => getAudioQualityRank(current) - getAudioQualityRank(next))
}

function shouldUseFallbackQuality(qualities = [], options = {}) {
  return (
    options.useFallbackForDefaultOnly !== false &&
    (!qualities.length || qualities.every((quality) => quality === DEFAULT_AUDIO_QUALITY))
  )
}

function getAudioQualityRank(value) {
  return AUDIO_QUALITY_MAP.get(value)?.rank ?? 0
}

function readPath(source, path) {
  return String(path)
    .split('.')
    .reduce((value, key) => (value && typeof value === 'object' ? value[key] : undefined), source)
}

function isPresentValue(value) {
  return value !== undefined && value !== null && value !== '' && value !== 0 && value !== '0'
}
