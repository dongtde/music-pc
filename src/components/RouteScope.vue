<template>
  <slot />
</template>

<script setup>
import { provide, shallowReactive } from 'vue'
import { routeLocationKey } from 'vue-router'

const props = defineProps({ route: { type: Object, required: true } })
const scopedRoute = {}

// RouterView's route prop selects a view, but useRoute() needs the same scope.
// Freeze covered and cached pages on their own route, including its parameters.
for (const key of ['path', 'name', 'params', 'query', 'hash', 'fullPath', 'matched', 'meta', 'redirectedFrom']) {
  Object.defineProperty(scopedRoute, key, {
    enumerable: true,
    get: () => props.route[key]
  })
}
provide(routeLocationKey, shallowReactive(scopedRoute))
</script>
