import { likeResource as likeNeteaseResource, subscribeMv as subscribeNeteaseMv } from '../../../api/modules/netease'

export async function toggleMvSubscribeData({ id, subscribe }) {
  return subscribeNeteaseMv({
    mvid: id,
    t: subscribe ? 1 : 0,
    timestamp: Date.now()
  })
}

export async function toggleMvLikeData({ id, like }) {
  return likeNeteaseResource({
    id,
    type: 1,
    t: like ? 1 : 0,
    timestamp: Date.now()
  })
}
