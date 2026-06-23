import { coverType } from './common'
import { mapBannerSong } from './tracks'

export function mapBanner(banner = {}, index = 0) {
  const targetType = Number(banner.targetType)
  const targetId = banner.targetId ?? ''
  const target = targetType === 1 && banner.song ? mapBannerSong(banner.song, index) : null

  return {
    id: `${targetType || 'banner'}-${targetId || index}`,
    targetType,
    targetId,
    targetKind: getBannerTargetKind(targetType),
    target,
    tag: banner.typeTitle || '推荐',
    title: target?.name || banner.typeTitle || '酷狗音乐推荐',
    desc: getBannerDescription(banner, target, targetType),
    action: getBannerAction(targetType),
    link: getBannerLink(targetType, targetId),
    externalUrl: banner.url?.startsWith('http') ? banner.url : '',
    tone: coverType(index),
    imageUrl: banner.imageUrl ?? banner.bigImageUrl
  }
}

export function getBannerTargetKind(targetType) {
  const targetKinds = {
    1: 'song',
    10: 'album',
    100: 'artist',
    1000: 'playlist',
    1004: 'mv'
  }

  return targetKinds[targetType] ?? 'other'
}

export function getBannerDescription(banner = {}, target = null, targetType = 0) {
  if (target?.artist) {
    return target.artist
  }

  if (targetType === 1000) {
    return '点击进入歌单详情'
  }

  if (banner.url?.startsWith('http')) {
    return '点击查看活动详情'
  }

  return '来自酷狗音乐的精选内容'
}

export function getBannerAction(targetType) {
  const actions = {
    1: '立即播放',
    10: '查看专辑',
    100: '查看歌手',
    1000: '查看歌单',
    1004: '观看 MV'
  }

  return actions[targetType] ?? '立即查看'
}

export function getBannerLink(targetType, targetId) {
  if (!targetId) {
    return ''
  }

  const links = {
    10: `/album/${targetId}`,
    100: `/artist/${targetId}`,
    1000: `/playlist/${targetId}`,
    1004: `/mv?mvId=${targetId}`
  }

  return links[targetType] ?? ''
}
