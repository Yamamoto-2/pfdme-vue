<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import GuidesLib from '@scena/guides';
import type { Size } from '@pdfme/common';
import { ZOOM } from '@pdfme/common';
import { RULER_HEIGHT } from '../../../constants';

defineProps<{
  paperSize: Size;
}>();

const horizontalRef = ref<HTMLDivElement>();
const verticalRef = ref<HTMLDivElement>();
let hGuides: GuidesLib | null = null;
let vGuides: GuidesLib | null = null;

onMounted(() => {
  if (horizontalRef.value) {
    hGuides = new GuidesLib(horizontalRef.value, {
      zoom: ZOOM,
      type: 'horizontal',
    });
  }
  if (verticalRef.value) {
    vGuides = new GuidesLib(verticalRef.value, {
      zoom: ZOOM,
      type: 'vertical',
    });
  }
});

onBeforeUnmount(() => {
  hGuides?.destroy();
  vGuides?.destroy();
});

defineExpose({
  getHorizontalGuides: () => hGuides?.getGuides() ?? [],
  getVerticalGuides: () => vGuides?.getGuides() ?? [],
});
</script>

<template>
  <div
    class="ruler-container"
    :style="{
      position: 'absolute',
      top: -RULER_HEIGHT + 'px',
      left: -RULER_HEIGHT + 'px',
      height: RULER_HEIGHT + 'px',
      width: RULER_HEIGHT + 'px',
      background: '#333333',
    }"
  />
  <div
    ref="horizontalRef"
    :style="{
      position: 'absolute',
      top: -RULER_HEIGHT + 'px',
      left: '0px',
      height: RULER_HEIGHT + 'px',
      width: paperSize.width + 'px',
      background: '#333333',
    }"
  />
  <div
    ref="verticalRef"
    :style="{
      position: 'absolute',
      top: '0px',
      left: -RULER_HEIGHT + 'px',
      height: paperSize.height + 'px',
      width: RULER_HEIGHT + 'px',
      background: '#333333',
    }"
  />
</template>
