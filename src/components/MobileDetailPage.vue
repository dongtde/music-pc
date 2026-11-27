<template>
  <section
    class="mobile-detail-page app-shell--detail-page"
    :class="{
      'app-shell--playlist-detail': route.meta.coverDetail,
      'app-shell--cover-detail': coverThemeActive,
    }"
    :style="coverThemeStyle"
    :data-detail-path="route.path"
    :aria-label="route.meta.title || '详情'"
    tabindex="-1"
  >
    <RouteScope :route="route">
      <TopBar :playlist-header="playlistHeader" :back="back" />
      <div v-if="route.name !== 'search'" class="route-stage">
        <RouterView :route="route" v-slot="{ Component }">
          <component :is="Component" @playlist-header-change="updatePlaylistHeader" />
        </RouterView>
      </div>
    </RouteScope>
  </section>
</template>

<script setup>
import { onActivated, ref } from 'vue'
import RouteScope from './RouteScope.vue'
import TopBar from './TopBar.vue'
import { useDetailCoverTheme } from '../composables/useDetailCoverTheme'
import { getDetailCoverSource } from '../utils/detailCoverSource'

const props = defineProps({
  route: { type: Object, required: true },
  back: { type: Function, required: true }
})
const emit = defineEmits(['playlist-header-change'])
const playlistHeader = ref({ title: '', visible: false, collapsed: false })
const { coverThemeActive, coverThemeStyle } = useDetailCoverTheme(() =>
  getDetailCoverSource(props.route, playlistHeader.value)
)

onActivated(() => {
  if (playlistHeader.value.path === props.route.path) {
    emit('playlist-header-change', playlistHeader.value)
  }
})

function updatePlaylistHeader(header) {
  if (header.path !== props.route.path) return
  playlistHeader.value = header
  emit('playlist-header-change', header)
}
</script>
