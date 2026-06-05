<template>
  <section
    v-if="enabled && danmakuItems.length"
    class="soda-danmaku"
    aria-label="歌曲评论弹幕"
    aria-live="off"
  >
    <span
      v-for="item in danmakuItems"
      :key="item.key"
      class="soda-danmaku__item"
      :class="{
        'soda-danmaku__item--hot': item.hot,
        'soda-danmaku__item--fallback': item.fallback
      }"
      :style="item.style"
    >
      <span class="soda-danmaku__avatar" aria-hidden="true">
        <img
          v-if="item.avatarUrl"
          :src="item.avatarUrl"
          :alt="item.userName"
          loading="lazy"
          decoding="async"
        />
        <template v-else>{{ item.avatarText }}</template>
      </span>
      <span class="soda-danmaku__text">{{ item.content }}</span>
    </span>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import '../styles/danmaku.css'

const props = defineProps({
  enabled: {
    type: Boolean,
    default: true
  },
  song: {
    type: Object,
    default: null
  },
  hotComments: {
    type: Array,
    default: () => []
  },
  comments: {
    type: Array,
    default: () => []
  }
})

const laneCount = 5
const maxDanmakuItems = 18
const fallbackNames = ['云听友', '耳机党', '夜航线', '旋律控', '今日循环']
const fallbackTexts = [
  '这段前奏一响就有画面了',
  '适合戴耳机慢慢听',
  '{song} 这首很有记忆点',
  '副歌进来的一瞬间很抓人',
  '今天的心情刚好对上了',
  '这首可以放进循环歌单',
  '越听越舒服',
  '这个音色太干净了',
  '旋律像慢慢亮起来',
  '突然想把音量调大一点'
]

const danmakuItems = computed(() => {
  const hotComments = props.hotComments.map((comment, index) =>
    normalizeComment(comment, `hot-${index}`, true)
  )
  const regularComments = props.comments.map((comment, index) =>
    normalizeComment(comment, `comment-${index}`, false)
  )
  const sourceComments = dedupeComments([...hotComments, ...regularComments])
  const comments = sourceComments.length ? sourceComments : createFallbackComments()

  return comments.slice(0, maxDanmakuItems).map(createDanmakuItem)
})

function normalizeComment(comment, fallbackId, hot) {
  const user = comment?.user ?? {}
  const content = clampCommentText(comment?.content)

  return {
    id: comment?.id ?? fallbackId,
    content,
    likedCount: Number(comment?.likedCount) || 0,
    userName: user.name || '匿名听友',
    avatarUrl: user.avatarUrl || '',
    avatarText: (user.name || '听').slice(0, 1),
    hot
  }
}

function dedupeComments(comments) {
  const seen = new Set()

  return comments.filter((comment) => {
    if (!comment.content || seen.has(comment.content)) {
      return false
    }

    seen.add(comment.content)
    return true
  })
}

function createFallbackComments() {
  const songName = props.song?.name || '这首歌'

  return fallbackTexts.map((text, index) => ({
    id: `fallback-${index}`,
    content: text.replace('{song}', songName),
    likedCount: 0,
    userName: fallbackNames[index % fallbackNames.length],
    avatarUrl: '',
    avatarText: fallbackNames[index % fallbackNames.length].slice(0, 1),
    hot: index < 2,
    fallback: true
  }))
}

function createDanmakuItem(comment, index) {
  const lane = index % laneCount
  const row = Math.floor(index / laneCount)
  const duration = 18 + (index % 4) * 2 + Math.min(5, comment.content.length / 8)
  const delay = -((index * 2.45 + lane * 0.7) % duration)
  const top = 8 + lane * 17 + (row % 2) * 3
  const isHot = comment.hot || comment.likedCount >= 500

  return {
    ...comment,
    key: `${props.song?.id ?? 'song'}-${comment.id}-${index}`,
    hot: isHot,
    style: {
      '--danmaku-top': `${top}%`,
      '--danmaku-duration': `${duration.toFixed(2)}s`,
      '--danmaku-delay': `${delay.toFixed(2)}s`,
      '--danmaku-scale': isHot ? 1.04 : 1,
      '--danmaku-lane': lane
    }
  }
}

function clampCommentText(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()

  return text.length > 28 ? `${text.slice(0, 28)}...` : text
}
</script>
