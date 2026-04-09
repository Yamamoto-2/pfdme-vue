<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import SelectoLib from 'selecto';
import { SELECTABLE_CLASSNAME } from '../../../constants';

const props = defineProps<{
  container: HTMLElement | null;
  continueSelect: boolean;
  onDragStart: (e: any) => void;
  onSelect: (e: any) => void;
}>();

let selecto: SelectoLib | null = null;

const createSelecto = async () => {
  if (selecto) {
    selecto.destroy();
    selecto = null;
  }
  if (!props.container) return;

  await nextTick();

  selecto = new SelectoLib({
    container: props.container,
    selectFromInside: false,
    selectByClick: true,
    preventDefault: true,
    hitRate: 0,
    selectableTargets: [`.${SELECTABLE_CLASSNAME}`],
    continueSelect: props.continueSelect,
    toggleContinueSelect: 'shift',
  });

  selecto.on('dragStart', (e: any) => props.onDragStart(e));
  selecto.on('select', (e: any) => props.onSelect(e));
};

onMounted(createSelecto);
watch(() => props.container, createSelecto);
watch(() => props.continueSelect, (val) => {
  if (selecto) selecto.continueSelect = val;
});

onBeforeUnmount(() => {
  selecto?.destroy();
  selecto = null;
});
</script>

<template><span style="display:none" /></template>
