<template><span hidden aria-hidden="true" /></template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, watchEffect } from 'vue'
import { loadWorldMvs } from './worldMvFeed.js'
import { useHomeMvEngagement } from '../../views/home/useHomeMvEngagement.js'
import { contentRequest } from './contentRequest.js'

const props = defineProps({ open: Boolean })
const emit = defineEmits(['activate', 'state'])
const queue = shallowRef([]), index = ref(0), loading = ref(false), error = ref('')
const activeMv = computed(() => queue.value[index.value]), activeMvId = computed(() => String(activeMv.value?.id || ''))
const engagement = useHomeMvEngagement({ activeMv, activeMvId })
let page = 0, more = true, disposed = false, revision = 0, pendingStep = 0, emptyPages = 0

watchEffect(() => emit('state', {
  mv: activeMv.value, next: queue.value[index.value + 1], index: index.value, count: queue.value.length,
  loading: loading.value && !queue.value.length, error: error.value,
  liked: engagement.isHomeMvLiked(activeMv.value), likeLabel: engagement.getHomeMvLikeLabel(activeMv.value),
  commentLabel: engagement.getHomeMvCommentLabel(activeMv.value), commentsOpen: engagement.homeMvCommentsModalVisible.value,
  comments: { ...engagement.homeMvCommentState, hotComments: [...engagement.homeMvCommentState.hotComments], comments: [...engagement.homeMvCommentState.comments] },
}), { flush: 'sync' })

async function load(append = false) {
  if (loading.value || disposed || append && !more) return
  const token = ++revision
  loading.value = true; error.value = ''
  try {
    const data = await contentRequest(loadWorldMvs({ page: append ? page : 0 }), 40000)
    if (disposed || token !== revision) return
    const combined = [...(append ? queue.value : []), ...(data.items || [])]
    const seen = new Set()
    const next = combined.filter(mv => { if (seen.has(mv.id)) return false; seen.add(mv.id); return true })
    emptyPages = append && next.length === queue.value.length ? emptyPages + 1 : 0
    more = Boolean(data.more) && emptyPages < 3; page = data.nextPage
    queue.value = next
    if (!next.length) error.value = '暂时没有可播放的 MV，点击重试'
    if (pendingStep && next.length) { index.value = Math.min(next.length - 1, Math.max(0, index.value + pendingStep)); pendingStep = 0 }
  } catch { if (!disposed && token === revision) error.value = 'MV 加载失败，点击重试' }
  finally {
    if (!disposed && token === revision) {
      loading.value = false
      if (more && !error.value && index.value >= queue.value.length - 2) void load(true)
    }
  }
}
watch([activeMvId, () => queue.value.length], () => {
  const mv = activeMv.value
  if (!mv) return
  engagement.restoreHomeMvComments(mv.id)
  void engagement.prefetchHomeMvComments(mv)
  queue.value.slice(index.value + 1, index.value + 3).forEach(next => void engagement.prefetchHomeMvComments(next))
  if (more && !loading.value && !error.value && index.value >= queue.value.length - 2) void load(true)
})
watch(activeMvId, () => { engagement.homeMvCommentsModalVisible.value = false })
watch(() => props.open, open => { if (!open) engagement.homeMvCommentsModalVisible.value = false })
function select({ command, payload }) {
  if (!props.open) emit('activate')
  if (command === 'step') {
    if (engagement.homeMvCommentsModalVisible.value) return
    const step = Math.sign(payload)
    if (!queue.value.length || step > 0 && index.value >= queue.value.length - 1 && more) { pendingStep = step; void load(Boolean(queue.value.length)); return }
    index.value = Math.min(queue.value.length - 1, Math.max(0, index.value + step))
  } else if (command === 'retry') { index.value = 0; queue.value = []; more = true; emptyPages = 0; void load() }
  else if (command === 'like') engagement.toggleHomeMvLike(activeMv.value)
  else if (command === 'comments') void engagement.openHomeMvComments()
  else if (command === 'comments-close') engagement.homeMvCommentsModalVisible.value = false
  else if (command === 'comments-more' && !engagement.homeMvCommentState.loading) void engagement.loadMoreHomeMvComments()
  else if (command === 'comments-retry') void engagement.retryHomeMvComments()
}
onMounted(() => load())
onBeforeUnmount(() => { disposed = true; revision++ })
defineExpose({ select })
</script>
