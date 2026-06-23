import { getRadioClasses, getRadioImages, getRadioLibrary, getRadioRecommend } from '../../../api/modules/netease'
import { CACHE_TTL } from '../../../config/app'
import { getCachedData } from '../../cache'
import { mapRadioCard, uniqueRadioCards } from './mappers'
import { getRadioRecommendPayload } from './payloads'
import { asArray, normalizeKugouMediaUrl, uniqueSongs, uniqueValues } from './shared'

export async function getRadioCatalogData() {
  return getCachedData('radio-catalog', CACHE_TTL.podcast, async () => {
    const [classResponse, recommendResponse, libraryResponse] = await Promise.all([
      getRadioClasses().catch(() => ({})),
      getRadioRecommend().catch(() => ({})),
      getRadioLibrary().catch(() => ({}))
    ])
    const classGroups = getRadioClassGroups(classResponse)
    const classRadios = classGroups.flatMap((group) =>
      group.radios.map((radio) => ({
        ...radio,
        category: radio.category || group.name,
        primaryCategory: radio.primaryCategory || group.name
      }))
    )
    const recommendRadios = getRadioRecommendPayload(recommendResponse).map((item, index) => mapRadioCard(item, index))
    const libraryGroups = getRadioLibraryGroups(libraryResponse)
    const libraryRadios = libraryGroups.flatMap((group) =>
      group.channels.map((radio) => ({
        ...radio,
        sectionTitle: group.title
      }))
    )
    const allRadios = uniqueRadioCards([
      ...recommendRadios,
      ...libraryRadios,
      ...classRadios
    ])
    const imageMap = await getRadioImageMap(allRadios.slice(0, 80))
    const hydratedRadios = allRadios.map((radio) => hydrateRadioImage(radio, imageMap))
    const radiosById = new Map(hydratedRadios.map((radio) => [String(radio.id), radio]))
    const hydratedClassGroups = classGroups.map((group) => ({
      ...group,
      radios: group.radios.map((radio) => hydrateRadioImage(radiosById.get(String(radio.id)) ?? radio, imageMap))
    }))
    const hydratedLibraryGroups = libraryGroups.map((group) => ({
      ...group,
      channels: group.channels.map((radio) => hydrateRadioImage(radiosById.get(String(radio.id)) ?? radio, imageMap))
    }))
    const hydratedRecommendRadios = recommendRadios.map((radio) => hydrateRadioImage(radiosById.get(String(radio.id)) ?? radio, imageMap))
    const previewTracks = uniqueSongs(
      hydratedRecommendRadios
        .flatMap((radio) => radio.previewTracks ?? [])
        .map((track, index) => ({ ...track, rank: String(index + 1).padStart(2, '0') }))
    ).slice(0, 12)

    return {
      classGroups: hydratedClassGroups,
      classRadios: hydratedClassGroups.flatMap((group) => group.radios),
      recommendRadios: uniqueRadioCards(hydratedRecommendRadios),
      libraryGroups: hydratedLibraryGroups,
      libraryRadios: hydratedLibraryGroups.flatMap((group) => group.channels),
      allRadios: hydratedRadios,
      radiosById,
      previewTracks
    }
  })
}

export function getRadioClassGroups(response = {}) {
  const data = response.data ?? response
  const groups = asArray(data.class_list ?? data.classList ?? data.classes ?? response.class_list)

  return groups.map((group, groupIndex) => {
    const radios = asArray(group.fmlist ?? group.fm_list ?? group.radios ?? group.list)
      .map((item, index) => mapRadioCard({
        ...item,
        classid: item.classid ?? group.classid,
        classname: item.classname ?? group.classname
      }, index))
      .filter((radio) => radio.id)

    return {
      id: group.classid ?? group.id ?? `class-${groupIndex + 1}`,
      name: group.classname ?? group.name ?? `\u7535\u53f0\u5206\u7c7b ${groupIndex + 1}`,
      count: group.class_count ?? radios.length,
      sort: Number(group.sort_app ?? group.sort ?? groupIndex),
      radios
    }
  }).filter((group) => group.radios.length)
}

export function getRadioLibraryGroups(response = {}) {
  const groups = asArray(response.data ?? response.list ?? response.items)

  return groups.map((group, groupIndex) => {
    const title = group.time_fm_cn || group.title || group.name || `\u4e50\u5e93\u7535\u53f0 ${groupIndex + 1}`
    const description = group.rcm_text || group.description || ''
    const channels = asArray(group.fm_list ?? group.fmlist ?? group.radios ?? group.list)
      .map((item, index) => mapRadioCard({
        ...item,
        sectionTitle: title,
        sectionDescription: description
      }, index))
      .filter((radio) => radio.id)

    return {
      id: group.id ?? group.time_fm_cn ?? `library-${groupIndex + 1}`,
      title,
      description,
      source: 'yueku',
      channels
    }
  }).filter((group) => group.channels.length)
}

export async function getRadioImageMap(radios = []) {
  const ids = uniqueValues(radios.map((radio) => radio.id)).slice(0, 80)

  if (!ids.length) {
    return new Map()
  }

  const response = await getRadioImages({ fmid: ids.join(',') }).catch(() => ({}))
  const items = asArray(response.data ?? response.list ?? response.items)

  return new Map(items.map((item) => [
    String(item.fmid ?? item.fmId ?? item.id),
    {
      coverUrl: normalizeKugouMediaUrl(item.imgUrl480 || item.imgUrl100 || item.imgurl || item.picUrl, 520),
      fmtype: item.fmtype
    }
  ]))
}

export function hydrateRadioImage(radio = {}, imageMap = new Map()) {
  const image = imageMap.get(String(radio.id))

  if (!image) {
    return radio
  }

  return {
    ...radio,
    fmtype: radio.fmtype ?? image.fmtype,
    coverUrl: radio.coverUrl || image.coverUrl
  }
}
