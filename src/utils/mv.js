const MV_ID_KEYS = [
  'mvId',
  'mvid',
  'mv_id',
  'videoId',
  'video_id',
  'videoid',
  'vid',
  'mv'
]

const MV_HASH_KEYS = [
  'mvHash',
  'MVHash',
  'mvhash',
  'mv_hash',
  'videoHash',
  'VideoHash',
  'video_hash',
  'mkv_hash',
  'mkv_sd_hash',
  'mkv_hd_hash',
  'mkv_sq_hash',
  'fhd_hash',
  'fhd_hash_265',
  'qhd_hash',
  'qhd_hash_265',
  'hd_hash',
  'hd_hash_265',
  'sd_hash',
  'sd_hash_265',
  'ld_hash',
  'ld_hash_265'
]

const NESTED_MV_KEYS = ['mv', 'video', 'videoInfo', 'video_info', 'trans_param']

export function getMvRouteMeta(...sources) {
  const mvId = normalizeRouteValue(getFirstMvValue(MV_ID_KEYS, sources))
  const hash = getFirstMvValue(MV_HASH_KEYS, sources)
  const fallbackHash = mvId && !/^\d+$/.test(mvId) ? mvId : ''
  const mvHash = normalizeRouteValue(hash || fallbackHash)

  return {
    hasVideo: Boolean(mvId || mvHash),
    mvId: mvId || mvHash,
    mvHash
  }
}

export function createMvRouteQuery(...sources) {
  const meta = getMvRouteMeta(...sources)

  if (!meta.mvId) {
    return null
  }

  return {
    mvId: meta.mvId,
    ...(meta.mvHash ? { mvHash: meta.mvHash } : {})
  }
}

export function createKugouMvRouteTarget(...sources) {
  const query = createMvRouteQuery(...sources)

  if (!query?.mvId) {
    return { name: 'kugou-video' }
  }

  return {
    name: 'kugou-video',
    params: { id: query.mvId },
    query: query.mvHash ? { mvHash: query.mvHash } : {}
  }
}

function getFirstMvValue(keys, sources, depth = 0) {
  if (depth > 4) {
    return ''
  }

  for (const source of sources) {
    if (!source || typeof source !== 'object') {
      continue
    }

    for (const key of keys) {
      const value = source[key]

      if (isPresent(value)) {
        return value
      }
    }

    for (const key of NESTED_MV_KEYS) {
      const value = source[key]

      if (!value || value === source) {
        continue
      }

      if (typeof value !== 'object') {
        if (keys.includes(key) && isPresent(value)) {
          return value
        }
        continue
      }

      const nestedValue = getFirstMvValue(keys, [value], depth + 1)

      if (isPresent(nestedValue)) {
        return nestedValue
      }
    }
  }

  return ''
}

function normalizeRouteValue(value) {
  return isPresent(value) ? String(value) : ''
}

function isPresent(value) {
  return value !== undefined && value !== null && value !== ''
}
