<template>
  <a-select :value="modelValue" size="small" :style="{ width: '120px' }" @change="onChange">
    <a-select-option value="stable">正式版 (stable)</a-select-option>
    <a-select-option value="beta">测试版 (beta)</a-select-option>
  </a-select>
</template>

<script setup lang="ts">
import type { UpdateChannel } from '@/lib/update-types'

const props = defineProps<{ modelValue: UpdateChannel }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: UpdateChannel): void }>()

function onChange (v: UpdateChannel) {
  emit('update:modelValue', v)
}
</script>
