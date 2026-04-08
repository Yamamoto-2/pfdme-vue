<script setup lang="ts">
import { computed, inject } from 'vue';
import type { Plugin, Schema } from '@pdfme/common';
import DOMPurify from 'dompurify';
import { OptionsKey } from '../../composables/injection-keys';

const props = defineProps<{
  plugin: Plugin<Schema>;
  label: string;
  size?: number;
}>();

const options = inject(OptionsKey, {});

const schemaType = computed(() => props.plugin.propPanel.defaultSchema?.type ?? '');
const icon = computed(() => options.icons?.[schemaType.value] ?? props.plugin.icon);

const processedSVG = computed(() => {
  if (!icon.value) return null;
  const sanitizedSVG = DOMPurify.sanitize(icon.value, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ALLOWED_TAGS: ['svg', 'path', 'circle', 'rect', 'line', 'polygon', 'polyline', 'ellipse', 'g', 'defs', 'title', 'desc', 'metadata'],
    ALLOWED_ATTR: ['class', 'id', 'fill', 'stroke', 'stroke-width', 'viewBox', 'width', 'height', 'd', 'cx', 'cy', 'r', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'points', 'rx', 'ry', 'transform'],
    FORBID_TAGS: ['script', 'foreignObject', 'use', 'embed', 'iframe', 'object', 'link', 'style'],
    FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'href', 'xlink:href', 'src', 'action', 'formaction'],
    KEEP_CONTENT: false,
  });
  const parser = new DOMParser();
  const doc = parser.parseFromString(sanitizedSVG, 'image/svg+xml');
  const svgElement = doc.querySelector('svg');
  if (!svgElement) return null;
  if (props.size) {
    svgElement.setAttribute('width', props.size.toString());
    svgElement.setAttribute('height', props.size.toString());
  }
  return svgElement.outerHTML;
});
</script>

<template>
  <div
    v-if="processedSVG"
    :title="label"
    :style="{ display: 'flex', justifyContent: 'center' }"
    v-html="processedSVG"
  />
  <div v-else :style="{ overflow: 'hidden', fontSize: '10px' }" :title="label">
    {{ label }}
  </div>
</template>
