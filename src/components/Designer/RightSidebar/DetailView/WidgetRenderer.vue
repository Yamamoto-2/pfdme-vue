<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import type { WidgetProps } from '../../../../widget-types';

const props = defineProps<WidgetProps & {
  widget: (props: WidgetProps) => void;
}>();

const containerRef = ref<HTMLDivElement>();

const render = () => {
  const element = containerRef.value;
  if (!element) return;
  const { widget, ...otherProps } = props;
  element.innerHTML = '';
  widget({ ...otherProps, rootElement: element });
};

watch(() => [props.schema, props.activeSchema, props.activeElements], render, { deep: true });
watch(containerRef, (el) => { if (el) render(); });

onBeforeUnmount(() => {
  if (containerRef.value) containerRef.value.innerHTML = '';
});
</script>

<template>
  <div ref="containerRef" />
</template>
