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
    tag: banner.typeTitle || '\u63a8\u8350',
    title: target?.name || banner.typeTitle || '\u9177\u72d7\u97f3\u4e50\u63a8\u8350',
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
    return '\u70b9\u51fb\u8fdb\u5165\u6b4c\u5355\u8be6\u60c5'
  }

  if (banner.url?.startsWith('http')) {
    return '\u70b9\u51fb\u67e5\u770b\u6d3b\u52a8\u8be6\u60c5'
  }

  return '\u6765\u81ea\u9177\u72d7\u97f3\u4e50\u7684\u7cbe\u9009\u5185\u5bb9'
}

export function getBannerAction(targetType) {
  const actions = {
    1: '\u7acb\u5373\u64ad\u653e',
    10: '\u67e5\u770b\u4e13\u8f91',
    100: '\u67e5\u770b\u6b4c\u624b',
    1000: '\u67e5\u770b\u6b4c\u5355',
    1004: '\u89c2\u770b MV'
  }

  return actions[targetType] ?? '\u7acb\u5373\u67e5\u770b'
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
