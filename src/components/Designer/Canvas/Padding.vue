<script setup lang="ts">
import type { BasePdf } from '@pdfme/common';
import { ZOOM, isBlankPdf } from '@pdfme/common';
import type { CSSProperties } from 'vue';

defineProps<{
  basePdf: BasePdf;
}>();

const getPaddingStyle = (i: number, p: number): CSSProperties => {
  const style: CSSProperties = {
    position: 'absolute',
    background: 'var(--ant-color-error, #ff4d4f)',
    opacity: 0.25,
    pointerEvents: 'none',
  };
  switch (i) {
    case 0:
      style.top = '0';
      style.height = `${p * ZOOM}px`;
      style.left = '0';
      style.right = '0';
      break;
    case 1:
      style.right = '0';
      style.width = `${p * ZOOM}px`;
      style.top = '0';
      style.bottom = '0';
      break;
    case 2:
      style.bottom = '0';
      style.height = `${p * ZOOM}px`;
      style.left = '0';
      style.right = '0';
      break;
    case 3:
      style.left = '0';
      style.width = `${p * ZOOM}px`;
      style.top = '0';
      style.bottom = '0';
      break;
  }
  return style;
};
</script>

<template>
  <template v-if="isBlankPdf(basePdf)">
    <div
      v-for="(p, i) in basePdf.padding"
      :key="i"
      :style="getPaddingStyle(i, p)"
    />
  </template>
</template>
