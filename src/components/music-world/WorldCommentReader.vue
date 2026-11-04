<template>
  <div class="world-comment-backdrop" @pointerdown.self="$emit('close')">
    <section ref="dialog" class="world-comment-reader" role="dialog" aria-modal="true" aria-labelledby="echo-title" @keydown.stop="onKey">
      <header><div><span>LISTENER STORIES</span><h2 id="echo-title">歌曲评论</h2></div><button type="button" aria-label="关闭评论" @click="$emit('close')"><X :size="22" /></button></header>
      <div class="world-comment-song"><img v-if="track.coverUrl" :src="track.coverUrl" alt="" /><div><strong>{{ track.name || '等一首好音乐' }}</strong><span>{{ track.artist || '从发现屏选择歌曲' }}</span></div><small>{{ state.total }} 条评论</small></div>
      <div ref="body" class="world-comment-body" tabindex="0" aria-label="评论正文">
        <template v-if="item">
          <div class="world-comment-author"><img v-if="item.user?.avatarUrl" :src="item.user.avatarUrl" alt="" /><span v-else class="world-comment-avatar">♪</span><div><strong>{{ item.user?.name || '匿名听众' }}</strong><time>{{ item.time }}</time></div></div>
          <blockquote :key="item.id">{{ item.content }}</blockquote>
          <p class="world-comment-likes"><Heart :size="15" />{{ item.likedCount }} 人赞同这段回声</p>
        </template>
        <div v-else class="world-comment-empty" role="status"><AudioLines :size="38" /><p>{{ state.busy ? '正在收集听众的回声…' : state.error || state.empty }}</p><button v-if="state.error" type="button" @click="$emit('retry')">重新加载</button></div>
      </div>
      <footer><button type="button" :disabled="state.items.length<2" aria-label="上一条评论" @click="$emit('step',-1)"><ArrowLeft :size="18" /></button><span>{{ state.items.length ? state.index+1 : 0 }} <i>/</i> {{ state.items.length }}<small>← → 翻阅 · 关闭后继续看弹幕</small></span><button type="button" :disabled="state.items.length<2" aria-label="下一条评论" @click="$emit('step',1)"><ArrowRight :size="18" /></button></footer>
      <button v-if="state.items.length&&(state.more||state.error)" class="world-comment-more" type="button" :disabled="state.busy" @click="$emit(state.error?'retry':'more')">{{ state.busy?'加载中…':state.error?'加载失败，重试':'再听一些故事 ↓' }}</button>
    </section>
  </div>
</template>
<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, AudioLines, Heart, X } from 'lucide-vue-next'
const props = defineProps({ state: { type: Object, required: true }, track: { type: Object, default: () => ({}) } })
const emit = defineEmits(['close','step','more','retry'])
const item = computed(() => props.state.items[props.state.index]), dialog = ref(null), body = ref(null)
function onKey(event) {
  if (event.key === 'Escape') { event.preventDefault(); emit('close') }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); emit('step',event.key==='ArrowRight'?1:-1) }
  if (event.key === 'Tab') {
    const targets = [...dialog.value.querySelectorAll('button:not(:disabled),[tabindex="0"]')], first = targets[0], last = targets.at(-1)
    if (event.shiftKey && document.activeElement===first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement===last) { event.preventDefault(); first?.focus() }
  }
}
watch(() => props.state.index, async () => { await nextTick(); if (body.value) body.value.scrollTop=0 })
onMounted(() => dialog.value?.querySelector('button')?.focus({preventScroll:true}))
</script>
