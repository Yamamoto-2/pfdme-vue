<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch } from 'vue';
import SelectoLib from 'selecto';
import { SELECTABLE_CLASSNAME } from '../../../constants';

const props = defineProps<{
  container: HTMLElement | null;
  continueSelect: boolean;
  onDragStart: (e: any) => void;
  onSelect: (e: any) => void;
}>();

const className = 'pdfme-selecto';
let selecto: SelectoLib | null = null;

const createSelecto = () => {
  if (selecto) {
    selecto.destroy();
  }
  if (!props.container) return;

  selecto = new SelectoLib({
    className,
    container: props.container,
    selectFromInside: false,
    selectByClick: true,
    preventDefault: true,
    hitRate: 0,
    selectableTargets: [`.${SELECTABLE_CLASSNAME}`],
    continueSelect: props.continueSelect,
  });

  selecto.on('dragStart', (e: any) => props.onDragStart(e));
  selecto.on('select', (e: any) => props.onSelect(e));

  // Style the selecto element
  const containerElement = document.querySelector('.' + className);
  if (containerElement instanceof HTMLElement) {
    containerElement.style.backgroundColor = 'var(--ant-color-primary, #38a0ff)';
    containerElement.style.opacity = '0.75';
    containerElement.style.borderColor = 'var(--ant-color-primary-border, #38a0ff)';
  }
};

onMounted(createSelecto);

watch(() => props.container, createSelecto);

watch(() => props.continueSelect, (val) => {
  if (selecto) {
    selecto.continueSelect = val;
  }
});

onBeforeUnmount(() => {
  selecto?.destroy();
  selecto = null;
});
</script>

<template>
  <div />
</template>
