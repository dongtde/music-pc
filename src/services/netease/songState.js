import { checkSongLike, updateSongLike } from '../../api/modules/netease'

export async function getSongLikeStateData(ids = []) {
  const songIds = ids
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id))

  if (!songIds.length) {
    return new Set()
  }

  const response = await checkSongLike({
    ids: JSON.stringify(songIds),
    timestamp: Date.now()
  })
  const likedIds = Array.isArray(response.data)
    ? response.data
    : Array.isArray(response.ids)
      ? response.ids
      : []

  return new Set(likedIds.map((id) => String(id)))
}

export async function updateSongLikeStateData({ id, uid, like }) {
  return updateSongLike({
    id,
    uid,
    like: Boolean(like),
    timestamp: Date.now()
  })
}
