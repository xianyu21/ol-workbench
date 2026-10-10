<template>
  <!-- 原型视图：内容树 + 标签条 + 预览区。
       这里是多根节点（fragment），由父级 .main 的 flex 直接排布。 -->
  <Sidebar />
  <section class="content">
    <TabBar />
    <ViewerPane />
  </section>
</template>

<script setup lang="ts">
import Sidebar from '@/components/proto/Sidebar.vue'
import TabBar from '@/components/proto/TabBar.vue'
import ViewerPane from '@/components/proto/ViewerPane.vue'
</script>

<style scoped>
.content{flex:1 1 auto;display:flex;flex-direction:column;min-width:0;min-height:0;background:var(--bg)}
</style>
