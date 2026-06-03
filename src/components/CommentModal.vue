<template>
  <n-modal
    v-model:show="modalVisible"
    preset="card"
    class="comment-modal"
    :bordered="false"
    :mask-closable="true"
    transform-origin="center"
  >
    <template #header>
      <div class="comment-modal__title">
        <div>
          <span>{{ title }}</span>
          <small v-if="subtitle">{{ subtitle }}</small>
        </div>
        <strong>{{ displayTotal }} 条</strong>
      </div>
    </template>

    <div class="comment-modal__scroll">
      <div v-if="loading && !comments.length" class="comment-modal__state">
        {{ loadingText }}
      </div>
      <div v-else-if="error" class="comment-modal__state comment-modal__state--error">
        {{ error }}
      </div>

      <template v-else>
        <section v-if="hotComments.length" class="comment-modal__block">
          <h3>{{ hotTitle }}</h3>
          <article
            v-for="comment in hotComments"
            :key="`hot-${comment.id}`"
            class="comment-modal-comment"
          >
            <span class="comment-modal-comment__avatar">
              <img
                v-if="comment.user.avatarUrl"
                :src="comment.user.avatarUrl"
                :alt="comment.user.name"
              />
              <template v-else>{{ getCommentAvatarText(comment) }}</template>
            </span>
            <div class="comment-modal-comment__body">
              <header>
                <strong>{{ comment.user.name }}</strong>
                <span>{{ comment.time }}</span>
              </header>
              <p>{{ comment.content }}</p>
              <footer>
                <ThumbsUp :size="14" />
                <span>{{ comment.likedCount }}</span>
              </footer>
            </div>
          </article>
        </section>

        <section class="comment-modal__block">
          <h3>{{ allTitle }}</h3>
          <article
            v-for="comment in comments"
            :key="comment.id"
            class="comment-modal-comment"
          >
            <span class="comment-modal-comment__avatar">
              <img
                v-if="comment.user.avatarUrl"
                :src="comment.user.avatarUrl"
                :alt="comment.user.name"
              />
              <template v-else>{{ getCommentAvatarText(comment) }}</template>
            </span>
            <div class="comment-modal-comment__body">
              <header>
                <strong>{{ comment.user.name }}</strong>
                <span>{{ comment.time }}</span>
              </header>
              <p>{{ comment.content }}</p>
              <footer>
                <ThumbsUp :size="14" />
                <span>{{ comment.likedCount }}</span>
              </footer>
            </div>
          </article>

          <div v-if="!comments.length" class="comment-modal__state">
            {{ emptyText }}
          </div>
          <button
            v-if="hasMore"
            class="comment-modal__more"
            type="button"
            :disabled="loading"
            @click="$emit('load-more')"
          >
            {{ loading ? moreLoadingText : moreText }}
          </button>
        </section>
      </template>
    </div>
  </n-modal>
</template>

<script setup>
import { computed } from 'vue'
import { ThumbsUp } from 'lucide-vue-next'
import '../styles/comment-modal.css'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '评论'
  },
  subtitle: {
    type: String,
    default: ''
  },
  total: {
    type: Number,
    default: 0
  },
  hotComments: {
    type: Array,
    default: () => []
  },
  comments: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: ''
  },
  hasMore: {
    type: Boolean,
    default: false
  },
  hotTitle: {
    type: String,
    default: '热门评论'
  },
  allTitle: {
    type: String,
    default: '全部评论'
  },
  emptyText: {
    type: String,
    default: '暂无评论'
  },
  loadingText: {
    type: String,
    default: '评论加载中...'
  },
  moreText: {
    type: String,
    default: '查看更多评论'
  },
  moreLoadingText: {
    type: String,
    default: '加载中...'
  }
})

const emit = defineEmits(['update:show', 'load-more'])

const modalVisible = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})
const displayTotal = computed(() => Number(props.total) || 0)

function getCommentAvatarText(comment) {
  return (comment.user?.name || '云').slice(0, 1)
}
</script>
