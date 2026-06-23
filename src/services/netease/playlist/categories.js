import { getPlaylistCategories, getPlaylistHotCategories } from '../../../api/modules/netease'
import { firstArrayValue } from './shared'

export const PLAYLIST_DEFAULT_CATEGORY = {
  id: 0,
  name: '\u5168\u90e8'
}

let playlistCategoryMetaPromise = null

export function getPlaylistCategoryMeta() {
  if (!playlistCategoryMetaPromise) {
    playlistCategoryMetaPromise = Promise.all([
      getPlaylistHotCategories().catch(() => ({})),
      getPlaylistCategories().catch(() => ({}))
    ]).then(([hotResponse, catResponse]) => mapPlaylistCategoryMeta(hotResponse, catResponse))
  }

  return playlistCategoryMetaPromise
}

export function mapPlaylistCategoryMeta(hotResponse = {}, catResponse = {}) {
  const fallbackTags = getPlaylistTagItems(catResponse)
  const mappedCategoryGroups = mapPlaylistCategoryGroups(catResponse)
  const categoryGroups = mappedCategoryGroups.length
    ? mappedCategoryGroups
    : fallbackTags.length
      ? [{
          id: 'playlist-tags',
          name: '\u5168\u90e8\u5206\u7c7b',
          tags: fallbackTags
        }]
      : []
  const allTags = uniquePlaylistCategories([
    ...categoryGroups.flatMap((group) => group.tags),
    ...fallbackTags,
    ...getPlaylistTagItems(hotResponse)
  ])
  const visibleTags = uniquePlaylistCategories([
    PLAYLIST_DEFAULT_CATEGORY,
    ...allTags
  ])
  const flattenedCategories = uniquePlaylistCategories([
    ...visibleTags,
    ...categoryGroups.flatMap((group) => group.tags)
  ])
  const categoryByName = Object.fromEntries(
    flattenedCategories.map((category) => [normalizePlaylistCategoryKey(category.name), category])
  )
  const categoryById = Object.fromEntries(
    flattenedCategories.map((category) => [String(category.id), category])
  )

  return {
    hotCategories: visibleTags,
    categoryGroups,
    categories: flattenedCategories,
    categoryByName,
    categoryById
  }
}

export function resolvePlaylistCategory(category, categoryMeta = {}) {
  const normalized = normalizePlaylistCategoryOption(category)
  const categoryByName = categoryMeta.categoryByName ?? {}
  const categoryById = categoryMeta.categoryById ?? {}

  if (normalized.id !== '' && normalized.id !== undefined && normalized.id !== null) {
    return categoryById[String(normalized.id)] ?? normalized
  }

  return categoryByName[normalizePlaylistCategoryKey(normalized.name)] ?? normalized
}

export function normalizePlaylistCategoryOption(category) {
  if (category && typeof category === 'object') {
    const name = getPlaylistCategoryName(category) || PLAYLIST_DEFAULT_CATEGORY.name
    const id = getPlaylistCategoryId(category)

    return {
      id: id === '' ? normalizePlaylistCategoryId(name) : id,
      name
    }
  }

  const name = String(category || PLAYLIST_DEFAULT_CATEGORY.name).trim() || PLAYLIST_DEFAULT_CATEGORY.name

  return {
    id: normalizePlaylistCategoryId(name),
    name
  }
}

export function normalizePlaylistCategoryId(category) {
  const value = String(category ?? '').trim()

  if (!value || value === '\u5168\u90e8' || value === '\u63a8\u8350') {
    return 0
  }

  if (value.toUpperCase() === 'HI-RES') {
    return 11292
  }

  return /^\d+$/.test(value) ? Number(value) : ''
}

export function mapPlaylistCategoryGroups(response = {}) {
  const data = response.data ?? response
  const legacyGroups = mapLegacyPlaylistCategoryGroups(data)

  if (legacyGroups.length) {
    return legacyGroups
  }

  return getPlaylistGroupItems(data)
    .map((group, groupIndex) => {
      const tags = uniquePlaylistCategories(getPlaylistGroupTags(group))

      if (!tags.length) {
        return null
      }

      return {
        id: getPlaylistCategoryId(group) || `group-${groupIndex}`,
        name:
          group.category_name ||
          group.categoryName ||
          group.classname ||
          group.class_name ||
          group.name ||
          group.title ||
          `\u5206\u7c7b ${groupIndex + 1}`,
        tags
      }
    })
    .filter(Boolean)
}

export function mapLegacyPlaylistCategoryGroups(data = {}) {
  const categories = data.categories ?? {}
  const sub = Array.isArray(data.sub) ? data.sub : []

  if (!categories || Array.isArray(categories) || !Object.keys(categories).length || !sub.length) {
    return []
  }

  return Object.entries(categories)
    .map(([key, name]) => ({
      id: key,
      name,
      tags: uniquePlaylistCategories(
        sub
          .filter((item) => String(item.category) === String(key))
          .map(mapPlaylistCategoryItem)
      )
    }))
    .filter((group) => group.tags.length)
}

export function getPlaylistGroupItems(data = {}) {
  const groups = firstArrayValue(
    Array.isArray(data) ? data : null,
    data.category,
    data.categories,
    data.category_list,
    data.categoryList,
    data.info,
    data.list,
    data.tags
  )

  return groups.filter((item) => getPlaylistGroupTags(item).length)
}

export function getPlaylistTagItems(response = {}) {
  const data = response.data ?? response
  const directTags = firstArrayValue(
    Array.isArray(data) ? data : null,
    data.tags,
    data.hot,
    data.hot_tags,
    data.hotTags,
    data.list,
    data.info,
    data.data
  )

  return uniquePlaylistCategories([
    ...directTags.filter((item) => !getPlaylistGroupTags(item).length).map(mapPlaylistCategoryItem),
    ...getPlaylistGroupItems(data).flatMap((group) => getPlaylistGroupTags(group).map(mapPlaylistCategoryItem))
  ])
}

export function getPlaylistGroupTags(group = {}) {
  return firstArrayValue(
    group.son,
    group.sons,
    group.tags,
    group.tag_list,
    group.tagList,
    group.children,
    group.child,
    group.list,
    group.info,
    group.items,
    group.sub,
    group.subs
  )
}

export function mapPlaylistCategoryItem(item = {}) {
  if (typeof item === 'string' || typeof item === 'number') {
    const name = String(item).trim()

    return {
      id: normalizePlaylistCategoryId(name),
      name
    }
  }

  const name = getPlaylistCategoryName(item)
  const id = getPlaylistCategoryId(item)

  return {
    id: id === '' ? normalizePlaylistCategoryId(name) : id,
    name
  }
}

export function getPlaylistCategoryId(item = {}) {
  return (
    item.tag_id ??
    item.tagId ??
    item.id ??
    item.category_id ??
    item.categoryId ??
    item.classid ??
    item.class_id ??
    ''
  )
}

export function getPlaylistCategoryName(item = {}) {
  return String(
    item.tag_name ??
      item.tagName ??
      item.name ??
      item.title ??
      item.category_name ??
      item.categoryName ??
      item.classname ??
      item.class_name ??
      item.label ??
      ''
  ).trim()
}

export function normalizePlaylistCategoryKey(name = '') {
  return String(name).trim().toLowerCase()
}

export function uniquePlaylistCategories(categories = []) {
  const seen = new Set()

  return categories
    .map(mapPlaylistCategoryItem)
    .filter((category) => category.name)
    .filter((category) => {
      const key = category.id !== '' ? `id:${category.id}` : `name:${normalizePlaylistCategoryKey(category.name)}`

      if (seen.has(key)) {
        return false
      }

      seen.add(key)
      return true
    })
}
