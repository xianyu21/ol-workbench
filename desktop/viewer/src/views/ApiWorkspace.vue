<template>
  <!-- API 视图：接口模块树 + 接口详情 -->
  <ApiSidebar />
  <section class="content">
    <ApiDocPane />
  </section>
</template>

<script setup lang="ts">
import ApiSidebar from '@/components/api/ApiSidebar.vue'
import ApiDocPane from '@/components/api/ApiDocPane.vue'
</script>

<style scoped>
.content{flex:1 1 auto;display:flex;flex-direction:column;min-width:0;min-height:0;background:var(--bg)}
</style>
