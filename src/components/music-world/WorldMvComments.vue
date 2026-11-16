<template>
  <div class="world-mv-comment-overlay" @pointerdown.stop @pointerup.stop @click.stop @wheel.stop @keydown.stop="onKeydown">
    <button class="world-mv-comment-backdrop" type="button" tabindex="-1" aria-label="收起歌曲评论" @click="$emit('close')" />
    <section ref="panel" class="world-mv-comment-sheet" role="dialog" aria-modal="true" aria-label="歌曲评论">
      <span class="world-mv-comment-handle" aria-hidden="true" />
      <header>
        <h2>歌曲评论 <span :title="state.loaded ? `${state.total} 条评论` : undefined">{{ state.loaded ? formatCompactCount(state.total) : '…' }}</span></h2>
        <button ref="closeButton" type="button" class="world-mv-comment-close" aria-label="关闭歌曲评论" @click="$emit('close')"><X :size="20" /></button>
      </header>
      <div class="world-mv-comment-list" tabindex="0" aria-label="歌曲评论列表" :aria-busy="state.loading" @scroll="onScroll">
        <template v-for="group in groups" :key="group.title">
          <h3 v-if="group.items.length">{{ group.title }}</h3>
          <article v-for="comment in group.items" :key="comment.id" class="world-mv-comment">
            <img v-if="comment.user?.avatarUrl" :src="comment.user.avatarUrl" alt="" loading="lazy" />
            <span v-else class="world-mv-comment-avatar" aria-hidden="true">{{ (comment.user?.name || '匿').slice(0, 1) }}</span>
            <div class="world-mv-comment-body">
              <p class="world-mv-comment-author">{{ comment.user?.name || '匿名用户' }}</p>
              <p class="world-mv-comment-content">{{ comment.content }}</p>
              <time>{{ comment.time }}</time>
            </div>
            <span class="world-mv-comment-likes" :aria-label="`${comment.likedCount || 0} 人赞过`"><Heart :size="15" /><span>{{ formatActionCount(comment.likedCount) || '0' }}</span></span>
          </article>
        </template>
        <div class="world-mv-comment-status" role="status">
          <template v-if="state.loading"><Loader2 class="soda-spin" :size="18" /><span>正在加载评论</span></template>
          <template v-else-if="state.error"><span>{{ state.error }}</span><button type="button" @click="$emit('retry')">重新加载</button></template>
          <template v-else-if="!state.hotComments.length && !state.comments.length">暂无评论</template>
          <button v-else-if="state.more" type="button" @click="$emit('load-more')">加载更多评论</button>
          <span v-else>已显示全部评论</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Heart, Loader2, X } from 'lucide-vue-next'
import { formatActionCount } from '../../views/home/homeUtils'
import { formatCompactCount } from '../../utils/number'

const props = defineProps({ state: { type: Object, required: true } })
const emit = defineEmits(['close', 'load-more', 'retry'])
const panel = ref(null), closeButton = ref(null)
const previousFocus = document.activeElement
const groups = computed(() => [
  { title: '热门评论', items: props.state.hotComments },
  { title: '全部评论', items: props.state.comments }
])

function onScroll(event) {
  const list = event.currentTarget
  if (props.state.more && !props.state.loading && !props.state.error && list.scrollHeight - list.scrollTop - list.clientHeight < 96) emit('load-more')
}
function onKeydown(event) {
  if (event.key === 'Escape') { event.preventDefault(); emit('close'); return }
  if (event.key !== 'Tab') return
  const items = [...panel.value.querySelectorAll('button:not(:disabled), [tabindex="0"]')]
  const first = items[0], last = items[items.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
onMounted(() => closeButton.value?.focus({ preventScroll: true }))
onBeforeUnmount(() => {
  nextTick(() => {
    if (previousFocus?.isConnected && !previousFocus.closest('[inert]')) previousFocus.focus({ preventScroll: true })
  })
})
</script>

<style scoped>
.world-mv-comment-overlay { position: absolute; inset: 0; z-index: 30; color: #f5f5f6; text-shadow: none; }
.world-mv-comment-backdrop { position: absolute; inset: 0; width: 100%; height: 100%; padding: 0; border: 0; background: #0005; cursor: pointer; }
.world-mv-comment-sheet { position: absolute; inset: 22% 0 0; display: flex; flex-direction: column; border-radius: 18px 18px 0 0; background: #1a1b20; box-shadow: 0 -8px 32px #0003; overflow: hidden; animation: mv-comment-enter 180ms ease-out; }
.world-mv-comment-handle { flex: none; align-self: center; width: 30px; height: 3px; margin: 9px 0 0; border-radius: 3px; background: #ffffff38; }
header { flex: none; display: flex; align-items: center; justify-content: space-between; padding: 5px 12px 8px 18px; border-bottom: 1px solid #ffffff0c; }
h2 { margin: 0; font-size: 14px; line-height: 1.5; font-weight: 600; }
h2 span { margin-left: 6px; color: #b5b5bf; font-size: 12px; font-variant-numeric: tabular-nums; font-weight: 400; }
.world-mv-comment-close { display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--world-control-accent); cursor: pointer; }
.world-mv-comment-close:hover { background: #ffffff0c; }
.world-mv-comment-list { flex: 1; min-height: 0; padding: 4px 18px 12px; overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; scrollbar-width: thin; scrollbar-color: #ffffff25 transparent; }
h3 { margin: 12px 0 14px; color: #b5b5bf; font-size: 12px; font-weight: 500; }
.world-mv-comment { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 20px; }
.world-mv-comment > img, .world-mv-comment-avatar { flex: none; width: 30px; height: 30px; border-radius: 50%; object-fit: cover; }
.world-mv-comment-avatar { display: grid; place-items: center; background: #ffffff12; color: #b5b5bf; font-size: 12px; }
.world-mv-comment-body { flex: 1; min-width: 0; }
.world-mv-comment-author { margin: 0 0 4px; color: #a7a8b2; font-size: 12px; overflow-wrap: anywhere; }
.world-mv-comment-content { margin: 0 0 5px; color: #f5f5f6; font-size: 13px; line-height: 1.65; white-space: pre-wrap; overflow-wrap: anywhere; user-select: text; }
time { color: #83858f; font-size: 11px; }
.world-mv-comment-likes { flex: none; display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 28px; padding-top: 4px; color: #93959e; font-size: 10px; }
.world-mv-comment-status { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 56px; color: #a7a8b2; font-size: 12px; }
.world-mv-comment-status button { padding: 6px 10px; border: 0; border-radius: 12px; background: #ffffff09; color: var(--world-control-accent); font: inherit; cursor: pointer; }
@keyframes mv-comment-enter { from { transform: translateY(100%); } to { transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .world-mv-comment-sheet { animation: none; } }
</style>
