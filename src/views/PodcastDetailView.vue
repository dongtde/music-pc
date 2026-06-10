<template>
  <div class="view podcast-detail-view">
    <section
      v-if="loading && !podcast"
      class="podcast-detail-skeleton"
      aria-busy="true"
      aria-label="正在加载播客详情"
    >
      <section class="podcast-detail-skeleton__hero">
        <span class="podcast-detail-skeleton__cover" />
        <div class="podcast-detail-skeleton__content">
          <span class="podcast-detail-skeleton__line podcast-detail-skeleton__line--back" />
          <span class="podcast-detail-skeleton__line podcast-detail-skeleton__line--kicker" />
          <span class="podcast-detail-skeleton__line podcast-detail-skeleton__line--title" />
          <span class="podcast-detail-skeleton__line podcast-detail-skeleton__line--description" />
          <span class="podcast-detail-skeleton__line podcast-detail-skeleton__line--description-short" />
          <div class="podcast-detail-skeleton__meta">
            <span
              v-for="item in 5"
              :key="`podcast-detail-meta-${item}`"
              class="podcast-detail-skeleton__pill"
            />
          </div>
        </div>
      </section>

      <section class="podcast-detail-skeleton__table" aria-hidden="true">
        <header class="podcast-detail-table__head">
          <span>标题</span>
          <span>播客</span>
          <span>时长</span>
        </header>
        <div class="podcast-detail-skeleton__rows">
          <article
            v-for="item in 10"
            :key="`podcast-program-skeleton-${item}`"
            class="podcast-detail-skeleton__row"
          >
            <span class="podcast-detail-skeleton__song-main">
              <span class="podcast-detail-skeleton__thumb" />
              <span class="podcast-detail-skeleton__song-lines">
                <span class="podcast-detail-skeleton__line podcast-detail-skeleton__line--song" />
                <span class="podcast-detail-skeleton__line podcast-detail-skeleton__line--artist" />
              </span>
            </span>
            <span class="podcast-detail-skeleton__line podcast-detail-skeleton__line--album" />
            <span class="podcast-detail-skeleton__line podcast-detail-skeleton__line--duration" />
          </article>
        </div>
      </section>
    </section>

    <template v-else-if="podcast">
      <section class="podcast-detail-hero">
        <div class="podcast-detail-cover" :class="`podcast-detail-cover--${podcast.type}`">
          <img
            v-if="podcast.coverUrl"
            class="podcast-detail-cover__image"
            :src="podcast.coverUrl"
            :alt="podcast.title"
            loading="lazy"
            decoding="async"
          />
          <span class="podcast-detail-cover__badge">
            <MicVocal :size="22" />
          </span>
        </div>

        <div class="podcast-detail-content">
          <RouterLink class="podcast-detail-back" to="/podcast">
            <ChevronLeft :size="16" />
            <span>返回播客</span>
          </RouterLink>

          <span class="podcast-detail-kicker">{{ podcast.category || '播客' }}</span>
          <h1>{{ podcast.title }}</h1>
          <p>{{ podcast.description }}</p>

          <div class="podcast-detail-meta">
            <span>
              <ListMusic :size="14" />
              {{ podcast.programCountLabel || `${total} 期节目` }}
            </span>
            <span>
              <Heart :size="14" />
              {{ podcast.subCountLabel || 0 }} 订阅
            </span>
            <span>
              <MessageCircle :size="14" />
              {{ podcast.commentCount || 0 }} 评论
            </span>
            <span v-if="podcast.lastUpdated">
              <RefreshCw :size="14" />
              更新于 {{ podcast.lastUpdated }}
            </span>
          </div>

          <div class="podcast-detail-actions">
            <button
              class="podcast-action podcast-action--primary"
              type="button"
              :disabled="!programs.length"
              @click="playAll"
            >
              <Play :size="18" fill="currentColor" />
              <span>播放全部</span>
            </button>
            <button
              class="podcast-action"
              type="button"
              :disabled="subscribeLoading"
              @click="toggleSubscribe"
            >
              <Heart :size="17" :fill="podcast.subed ? 'currentColor' : 'none'" />
              <span>{{ podcast.subed ? '已订阅' : '订阅' }}</span>
            </button>
            <button class="podcast-action podcast-action--icon" type="button" :disabled="loading" @click="reload">
              <RefreshCw :size="17" :class="{ 'podcast-spin': loading }" />
              <span class="podcast-action__label">刷新</span>
            </button>
          </div>
        </div>
      </section>

      <div v-if="errorMessage" class="podcast-state podcast-state--error">
        {{ errorMessage }}
      </div>

      <section class="podcast-detail-layout">
        <article class="podcast-detail-main">
          <header class="podcast-detail-section-head">
            <div>
              <h2>节目列表</h2>
              <small>{{ total ? `${total} 期节目` : '可播放声音' }}</small>
            </div>
            <button
              class="podcast-text-button"
              type="button"
              :disabled="programLoading || !more"
              @click="loadMorePrograms"
            >
              <LoaderCircle v-if="programLoading" :size="15" class="podcast-spin" />
              <Plus v-else :size="15" />
              <span>{{ more ? '更多' : '已加载' }}</span>
            </button>
          </header>

          <section v-if="programs.length" class="podcast-detail-table" aria-label="播客节目列表">
            <header class="podcast-detail-table__head">
              <span>标题</span>
              <span>播客</span>
              <span>时长</span>
            </header>
            <div class="podcast-detail-programs">
              <SongListRow
                v-for="track in rankedPrograms"
                :key="track.programId || track.id"
                :track="track"
                @play="playProgram(track)"
              />
            </div>
          </section>

          <div v-else class="podcast-state">暂无节目。</div>

          <button
            v-if="more"
            class="podcast-load-more"
            type="button"
            :disabled="programLoading"
            @click="loadMorePrograms"
          >
            <LoaderCircle v-if="programLoading" :size="16" class="podcast-spin" />
            <span>加载更多节目</span>
          </button>
        </article>

        <aside class="podcast-detail-side" aria-label="播客补充信息">
          <section class="podcast-detail-panel">
            <header class="podcast-detail-section-head">
              <div>
                <h2>主播</h2>
                <small>{{ podcast.creator || '网易云音乐播客' }}</small>
              </div>
              <UserRound :size="18" />
            </header>

            <div class="podcast-host">
              <img
                v-if="podcast.creatorAvatarUrl"
                :src="podcast.creatorAvatarUrl"
                :alt="podcast.creator"
                loading="lazy"
                decoding="async"
              />
              <span v-else>{{ creatorInitial }}</span>
              <div>
                <strong>{{ podcast.creator || '播客主播' }}</strong>
                <small>{{ podcast.primaryCategory || podcast.category || '声音创作者' }}</small>
              </div>
            </div>
          </section>

          <section v-if="podcast.comments?.length" class="podcast-detail-panel">
            <header class="podcast-detail-section-head">
              <div>
                <h2>听友热评</h2>
                <small>来自播客详情</small>
              </div>
              <MessageCircle :size="18" />
            </header>

            <div class="podcast-comment-list">
              <article v-for="comment in podcast.comments.slice(0, 4)" :key="comment.id">
                <p>{{ comment.content }}</p>
                <small>{{ comment.user.name }} · {{ comment.programName }}</small>
              </article>
            </div>
          </section>
        </aside>
      </section>
    </template>

    <section v-else-if="errorMessage" class="podcast-state podcast-state--error">
      {{ errorMessage }}
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useMessage } from 'naive-ui'
import {
  ChevronLeft,
  Heart,
  ListMusic,
  LoaderCircle,
  MessageCircle,
  MicVocal,
  Play,
  Plus,
  RefreshCw,
  UserRound
} from 'lucide-vue-next'
import SongListRow from '../components/SongListRow.vue'
import {
  getPodcastDetailData,
  getPodcastProgramsData,
  togglePodcastSubscribeData
} from '../services/netease'
import { usePlayerStore } from '../stores/player'
import '../styles/podcast.css'

const PROGRAM_LIMIT = 40

const route = useRoute()
const player = usePlayerStore()
const message = useMessage()
const podcast = ref(null)
const programs = ref([])
const total = ref(0)
const offset = ref(0)
const more = ref(false)
const loading = ref(false)
const programLoading = ref(false)
const subscribeLoading = ref(false)
const errorMessage = ref('')

const creatorInitial = computed(() => podcast.value?.creator?.slice(0, 1) || '播')
const rankedPrograms = computed(() =>
  programs.value.map((track, index) => ({
    ...track,
    rank: String(index + 1).padStart(2, '0')
  }))
)

onMounted(() => {
  loadDetail()
})

watch(
  () => route.params.id,
  () => {
    loadDetail()
  }
)

async function loadDetail() {
  const id = route.params.id

  if (!id) {
    return
  }

  loading.value = true
  errorMessage.value = ''
  podcast.value = null
  programs.value = []
  offset.value = 0

  try {
    const data = await getPodcastDetailData({ id, limit: PROGRAM_LIMIT, offset: 0 })
    podcast.value = data.podcast
    programs.value = data.programs
    total.value = data.total
    offset.value = data.programs.length
    more.value = data.more
  } catch (error) {
    console.warn('Failed to load podcast detail:', error)
    errorMessage.value = error?.message || '播客详情加载失败'
    message.error(errorMessage.value)
  } finally {
    loading.value = false
  }
}

function reload() {
  loadDetail()
}

async function loadMorePrograms() {
  const id = route.params.id

  if (!id || programLoading.value || (!more.value && programs.value.length)) {
    return
  }

  programLoading.value = true

  try {
    const data = await getPodcastProgramsData({
      id,
      limit: PROGRAM_LIMIT,
      offset: offset.value
    })
    programs.value = dedupeTracks([...programs.value, ...data.programs])
    total.value = data.total
    offset.value = programs.value.length
    more.value = data.more
  } catch (error) {
    console.warn('Failed to load podcast programs:', error)
    message.error(error?.message || '节目加载失败')
  } finally {
    programLoading.value = false
  }
}

async function playAll() {
  if (!rankedPrograms.value.length) {
    return
  }

  await playProgram(rankedPrograms.value[0])
}

async function playProgram(track) {
  player.setQueue(rankedPrograms.value)
  const played = await player.playTrack(track)

  if (!played) {
    message.error(player.state.error?.message || '当前节目暂无可播放链接')
  }
}

async function toggleSubscribe() {
  if (!podcast.value || subscribeLoading.value) {
    return
  }

  subscribeLoading.value = true
  const nextSubscribed = !podcast.value.subed

  try {
    await togglePodcastSubscribeData({
      id: podcast.value.id,
      subscribe: nextSubscribed
    })
    podcast.value = {
      ...podcast.value,
      subed: nextSubscribed
    }
    message.success(nextSubscribed ? '已订阅播客' : '已取消订阅')
  } catch (error) {
    console.warn('Failed to update podcast subscription:', error)
    message.error(error?.message || '订阅状态更新失败')
  } finally {
    subscribeLoading.value = false
  }
}

function dedupeTracks(items = []) {
  const seenIds = new Set()

  return items.filter((item) => {
    const id = String(item?.programId || item?.id || '')

    if (!id || seenIds.has(id)) {
      return false
    }

    seenIds.add(id)
    return true
  })
}
</script>
