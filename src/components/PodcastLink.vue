<template>
  <RouterLink
    :to="podcast?.to || (podcast?.id != null ? `/podcast/${podcast.id}` : '/podcast')"
    @mouseenter="prepareCover"
    @focus="prepareCover"
    @pointerdown.capture="prepareCover"
    @click.capture="prepareCover"
    @load.capture="prepareCover"
  >
    <slot />
  </RouterLink>
</template>

<script setup>
import { watch } from 'vue'
import { RouterLink } from 'vue-router'
import { preparePodcastCover, rememberPodcastPreview } from '../utils/podcastPreview'

const props = defineProps({
  podcast: { type: Object, default: null }
})

watch(
  () => [props.podcast?.id, props.podcast?.title, props.podcast?.coverUrl, props.podcast?.type],
  () => rememberPodcastPreview(props.podcast),
  { immediate: true }
)

function prepareCover() {
  void preparePodcastCover(props.podcast)
}
</script>
