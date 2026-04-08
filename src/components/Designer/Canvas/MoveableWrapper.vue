<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import MoveableLib from 'moveable';
import { uuid } from '../../../helper';

const props = defineProps<{
  target: HTMLElement[];
  bounds: { left: number; top: number; bottom: number; right: number };
  horizontalGuidelines: number[];
  verticalGuidelines: number[];
  keepRatio: boolean;
  rotatable: boolean;
  onDrag: (e: any) => void;
  onDragEnd: (e: { target: HTMLElement | SVGElement }) => void;
  onDragGroupEnd: (e: { targets: (HTMLElement | SVGElement)[] }) => void;
  onRotate: (e: any) => void;
  onRotateEnd: (e: any) => void;
  onRotateGroupEnd: (e: { targets: (HTMLElement | SVGElement)[] }) => void;
  onResize: (e: any) => void;
  onResizeEnd: (e: { target: HTMLElement | SVGElement }) => void;
  onResizeGroupEnd: (e: { targets: (HTMLElement | SVGElement)[] }) => void;
  onClick: (e: any) => void;
}>();

const containerRef = ref<HTMLDivElement>();
let moveable: MoveableLib | null = null;
const instanceId = uuid();
const uniqueClassName = `pdfme-moveable-${instanceId}`;

const createMoveable = () => {
  if (moveable) {
    moveable.destroy();
  }
  if (!containerRef.value) return;

  moveable = new MoveableLib(document.body, {
    className: uniqueClassName,
    target: props.target,
    draggable: true,
    resizable: true,
    rotatable: props.rotatable,
    snappable: true,
    bounds: props.bounds,
    horizontalGuidelines: props.horizontalGuidelines,
    verticalGuidelines: props.verticalGuidelines,
    keepRatio: props.keepRatio,
    throttleDrag: 1,
    throttleRotate: 1,
    throttleResize: 1,
  });

  moveable.on('drag', (e: any) => props.onDrag(e));
  moveable.on('dragEnd', (e: any) => props.onDragEnd(e));
  moveable.on('dragGroup', (e: any) => {
    e.events.forEach((ev: any) => props.onDrag(ev));
  });
  moveable.on('dragGroupEnd', (e: any) => props.onDragGroupEnd(e));
  moveable.on('rotate', (e: any) => props.onRotate(e));
  moveable.on('rotateEnd', (e: any) => props.onRotateEnd(e));
  moveable.on('rotateGroup', (e: any) => {
    e.events.forEach((ev: any) => props.onRotate(ev));
  });
  moveable.on('rotateGroupEnd', (e: any) => props.onRotateGroupEnd(e));
  moveable.on('resize', (e: any) => props.onResize(e));
  moveable.on('resizeEnd', (e: any) => props.onResizeEnd(e));
  moveable.on('resizeGroup', (e: any) => {
    e.events.forEach((ev: any) => props.onResize(ev));
  });
  moveable.on('resizeGroupEnd', (e: any) => props.onResizeGroupEnd(e));
  moveable.on('click', (e: any) => props.onClick(e));
};

onMounted(createMoveable);

watch(
  () => [props.target, props.bounds, props.keepRatio, props.rotatable],
  () => {
    if (moveable) {
      moveable.target = props.target;
      moveable.bounds = props.bounds;
      moveable.keepRatio = props.keepRatio;
      moveable.rotatable = props.rotatable;
      nextTick(() => moveable?.updateRect());
    }
  },
  { deep: true },
);

watch(
  () => [props.horizontalGuidelines, props.verticalGuidelines],
  () => {
    if (moveable) {
      moveable.horizontalGuidelines = props.horizontalGuidelines;
      moveable.verticalGuidelines = props.verticalGuidelines;
    }
  },
);

onBeforeUnmount(() => {
  moveable?.destroy();
  moveable = null;
});

defineExpose({
  updateRect: () => moveable?.updateRect(),
  isMoveableElement: (el: Element) => moveable?.isMoveableElement(el),
});
</script>

<template>
  <div ref="containerRef" />
</template>
