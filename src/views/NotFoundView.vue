<template>
  <div class="view simple-view">
    <div class="empty-panel">
      <CircleOff :size="44" />
      <h1>页面不存在</h1>
      <p>这个地址没有对应的页面，可以回到首页继续播放和浏览。</p>
      <n-button type="primary" round @click="$router.push('/home')">回到首页</n-button>
    </div>
  </div>
</template>

<script setup>
import { CircleOff } from 'lucide-vue-next'
import '../styles/simple.css'
</script>
