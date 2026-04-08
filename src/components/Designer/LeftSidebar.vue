<script setup lang="ts">
import { inject, ref, onMounted, onBeforeUnmount } from 'vue';
import type { Schema, BasePdf } from '@pdfme/common';
import { getFallbackFontName } from '@pdfme/common';
import { Button } from 'ant-design-vue';
import { LEFT_SIDEBAR_WIDTH, DESIGNER_CLASSNAME } from '../../constants';
import { setFontNameRecursively } from '../../helper';
import { OptionsKey, PluginsRegistryKey } from '../../composables/injection-keys';
import PluginIcon from './PluginIcon.vue';

const props = defineProps<{
  height: number;
  scale: number;
  basePdf: BasePdf;
  onAddSchema: (defaultSchema: Schema) => void;
}>();

const options = inject(OptionsKey, {});
const pluginsRegistry = inject(PluginsRegistryKey)!;
const isDragging = ref(false);

// Use HTML5 DnD instead of @dnd-kit
const onDragStart = (e: DragEvent, defaultSchema: Schema) => {
  isDragging.value = true;
  if (options.font) {
    const fontName = getFallbackFontName(options.font);
    setFontNameRecursively(defaultSchema as Record<string, unknown>, fontName);
  }
  e.dataTransfer?.setData('application/json', JSON.stringify(defaultSchema));
};

const onDragEnd = () => {
  isDragging.value = false;
};

const handleMouseUp = () => {
  if (isDragging.value) isDragging.value = false;
};

onMounted(() => document.addEventListener('mouseup', handleMouseUp));
onBeforeUnmount(() => document.removeEventListener('mouseup', handleMouseUp));
</script>

<template>
  <div
    :class="DESIGNER_CLASSNAME + 'left-sidebar'"
    :style="{
      left: 0,
      right: 0,
      position: 'absolute',
      zIndex: 1,
      height: height + 'px',
      width: LEFT_SIDEBAR_WIDTH + 'px',
      background: 'var(--ant-color-bg-layout, #f5f5f5)',
      textAlign: 'center',
      overflow: isDragging ? 'visible' : 'auto',
    }"
  >
    <template
      v-for="[label, plugin] in pluginsRegistry.entries()"
      :key="label"
    >
      <div
        v-if="plugin?.propPanel.defaultSchema"
        draggable="true"
        @dragstart="(e: DragEvent) => onDragStart(e, plugin.propPanel.defaultSchema as Schema)"
        @dragend="onDragEnd"
      >
        <Button
          :class="DESIGNER_CLASSNAME + 'plugin-' + plugin.propPanel.defaultSchema.type"
          :style="{ width: '35px', height: '35px', marginTop: '0.25rem', padding: '0.25rem' }"
          @mousedown="isDragging = true"
        >
          <PluginIcon :plugin="plugin" :label="label" />
        </Button>
      </div>
    </template>
  </div>
</template>
