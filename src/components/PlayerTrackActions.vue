<template>
  <div class="track-summary__actions">
    <button
      class="track-action-button"
      type="button"
      :class="{ active: liked }"
      :aria-label="liked ? '取消喜欢' : '喜欢'"
      @click="$emit('toggle-like')"
    >
      <Heart :size="25" :fill="liked ? 'currentColor' : 'none'" />
    </button>
    <button
      class="track-action-button track-action-button--comment"
      type="button"
      aria-label="评论"
      @click="$emit('open-comments')"
    >
      <MessageCircleMore :size="25" />
      <span v-if="commentTotal">
        {{ formatCommentBadge(commentTotal) }}
      </span>
    </button>
    <button class="track-action-button" type="button" aria-label="更多">
      <Ellipsis :size="25" />
    </button>
  </div>
</template>

<script setup>
import { Ellipsis, Heart, MessageCircleMore } from 'lucide-vue-next'

defineProps({
  liked: {
    type: Boolean,
    default: false
  },
  commentTotal: {
    type: Number,
    default: 0
  }
})

defineEmits(['toggle-like', 'open-comments'])

function formatCommentBadge(value = 0) {
  const count = Number(value) || 0

  if (count >= 100000) {
    return '10w+'
  }

  if (count >= 10000) {
    return '1w+'
  }

  if (count >= 1000) {
    return '999+'
  }

  return String(count)
}
</script>
