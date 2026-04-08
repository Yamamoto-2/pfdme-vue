<script setup lang="ts">
import { ref, inject, watch, onMounted } from 'vue';
import type { Size } from '@pdfme/common';
import { FontKey } from '../composables/injection-keys';
import { BACKGROUND_COLOR, DESIGNER_CLASSNAME } from '../constants';
import Spinner from './Spinner.vue';

const props = defineProps<{
  size: Size;
  scale: number;
}>();

const rootRef = ref<HTMLDivElement>();
const font = inject(FontKey, {});

const loadFonts = () => {
  if (!document || !document.fonts) return;
  const fontFaces = Object.entries(font).map(
    ([key, { data }]) =>
      new FontFace(key, typeof data === 'string' ? `url(${data})` : (data as BufferSource), {
        display: 'swap',
      }),
  );
  const newFontFaces = fontFaces.filter((fontFace) => !document.fonts.has(fontFace));

  void Promise.allSettled(newFontFaces.map((f) => f.load())).then((loadedFontFaces) => {
    loadedFontFaces.forEach((loadedFontFace) => {
      if (loadedFontFace.status === 'fulfilled') {
        document.fonts.add(loadedFontFace.value);
      }
    });
  });
};

onMounted(loadFonts);
watch(() => font, loadFonts, { deep: true });

defineExpose({ rootRef });
</script>

<template>
  <div
    ref="rootRef"
    :class="DESIGNER_CLASSNAME + 'root'"
    :style="{
      position: 'relative',
      background: BACKGROUND_COLOR,
      width: props.size.width + 'px',
      height: props.size.height + 'px',
    }"
  >
    <div
      :class="DESIGNER_CLASSNAME + 'background'"
      :style="{
        margin: '0 auto',
        width: props.size.width + 'px',
        height: props.size.height + 'px',
      }"
    >
      <Spinner v-if="props.scale === 0" />
      <slot v-else />
    </div>
  </div>
</template>
