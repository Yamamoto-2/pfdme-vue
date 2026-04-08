<script setup lang="ts">
import { RULER_HEIGHT } from '../../../constants';

defineProps<{
  width: number;
  height: number;
}>();
</script>

<template>
  <div
    :style="{
      position: 'absolute',
      top: -RULER_HEIGHT + 'px',
      left: -RULER_HEIGHT + 'px',
      zIndex: 100,
      width: width + 'px',
      height: height + 'px',
      background: 'rgba(0, 0, 0, 0.45)',
    }"
  />
</template>
