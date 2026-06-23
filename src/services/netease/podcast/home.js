import { CACHE_TTL } from '../../../config/app'
import { getCachedData } from '../../cache'
import { getRadioCatalogData } from './catalog'
import { uniqueRadioCards } from './mappers'

export async function getPodcastHomeData() {
  return getCachedData('radio-home', CACHE_TTL.podcast, async () => {
    const catalog = await getRadioCatalogData()
    const categories = catalog.classGroups.map((group) => ({
      id: group.id,
      name: group.name,
      description: `${group.radios.length} \u4e2a\u7535\u53f0`,
      radios: group.radios
    }))
    const firstCategory = categories[0]
    const featured = uniqueRadioCards([
      ...catalog.recommendRadios,
      ...catalog.libraryRadios,
      ...catalog.classRadios
    ]).slice(0, 12)
    const hot = uniqueRadioCards([
      ...catalog.recommendRadios,
      ...catalog.classRadios
    ]).slice(0, 18)
    const libraryGroups = catalog.libraryGroups.length
      ? catalog.libraryGroups
      : categories.slice(0, 4).map((category) => ({
        id: category.id,
        title: category.name,
        description: category.description,
        channels: category.radios.slice(0, 8)
      }))

    return {
      banners: featured.slice(0, 3).map((item) => ({
        id: item.id,
        title: item.title,
        coverUrl: item.bannerUrl || item.coverUrl,
        targetId: item.id,
        to: item.to
      })),
      featured,
      hot,
      categories,
      activeCategory: firstCategory ?? null,
      categoryRadios: firstCategory?.radios ?? hot,
      today: catalog.previewTracks,
      programToplist: catalog.previewTracks,
      paid: [],
      recent: [],
      subscribed: [],
      satiTags: categories.slice(0, 10).map((item) => ({
        id: item.id,
        tag: item.id,
        title: item.name,
        description: item.description
      })),
      satiResources: [],
      difm: libraryGroups,
      yuekuGroups: libraryGroups,
      broadcastMeta: {
        categories: categories.map(({ id, name }) => ({ id, name })),
        regions: []
      },
      broadcastChannels: uniqueRadioCards([
        ...catalog.libraryRadios,
        ...catalog.classRadios,
        ...catalog.recommendRadios
      ]).slice(0, 36),
      allRadios: catalog.allRadios
    }
  })
}

export async function getPodcastCategoryData({ cateId, limit = 18, offset = 0 } = {}) {
  const catalog = await getRadioCatalogData()
  const source = String(cateId) === 'recommend'
    ? catalog.recommendRadios
    : catalog.classGroups.find((group) => String(group.id) === String(cateId))?.radios ?? catalog.classRadios
  const radios = uniqueRadioCards(source)
  const items = radios.slice(offset, offset + limit)

  return {
    items,
    total: radios.length,
    more: offset + items.length < radios.length
  }
}

export async function getPodcastRankData({ type = 'hot', limit = 18, offset = 0 } = {}) {
  const catalog = await getRadioCatalogData()
  const sortByAddTime = (items) => [...items].sort((current, next) => {
    const currentTime = new Date(current.raw?.addtime || 0).getTime() || 0
    const nextTime = new Date(next.raw?.addtime || 0).getTime() || 0

    return nextTime - currentTime
  })
  const sortByHeat = (items) => [...items].sort((current, next) => Number(next.heat || 0) - Number(current.heat || 0))
  const sources = {
    hot: catalog.recommendRadios,
    new: sortByAddTime(catalog.allRadios),
    library: catalog.libraryRadios,
    classic: catalog.classGroups.find((group) => /\u4e3b\u9898|\u7ecf\u5178|\u5e74\u4ee3/.test(group.name))?.radios ?? catalog.classRadios,
    scene: catalog.classGroups.find((group) => /\u573a\u666f|\u5fc3\u60c5|\u8fd0\u52a8|\u751f\u6d3b/.test(group.name))?.radios ?? catalog.libraryRadios,
    heat: sortByHeat(catalog.allRadios)
  }
  const radios = uniqueRadioCards(sources[type] ?? sources.hot)
  const items = radios.slice(offset, offset + limit)

  return {
    items,
    total: radios.length,
    more: offset + items.length < radios.length
  }
}

export async function getPodcastCategoryRecommendationsData(type) {
  const data = await getPodcastCategoryData({ cateId: type, limit: 24, offset: 0 })

  return data.items
}
