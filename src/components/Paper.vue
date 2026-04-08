<script setup lang="ts">
import { inject } from 'vue';
import type { SchemaForUI, Size } from '@pdfme/common';
import { ZOOM, getFallbackFontName } from '@pdfme/common';
import { FontKey } from '../composables/injection-keys';
import { RULER_HEIGHT, PAGE_GAP } from '../constants';

const props = defineProps<{
  scale: number;
  size: Size;
  schemasList: SchemaForUI[][];
  pageSizes: Size[];
  backgrounds: string[];
  hasRulers?: boolean;
}>();

const emit = defineEmits<{
  (e: 'paperRef', index: number, el: HTMLDivElement): void;
}>();

const font = inject(FontKey, {});

const getRulerHeight = () => props.hasRulers ? RULER_HEIGHT : 0;

const getPaperSize = (index: number) => {
  const pageSize = props.pageSizes[index];
  return { width: pageSize.width * ZOOM, height: pageSize.height * ZOOM };
};

const getLeftIndent = (index: number) => {
  const paperSize = getPaperSize(index);
  const rulerHeight = getRulerHeight();
  return paperSize.width * props.scale + rulerHeight < props.size.width
    ? `${(props.size.width / props.scale - paperSize.width) / 2}px`
    : `${rulerHeight}px`;
};

const getPageTop = (index: number) => {
  const rulerHeight = getRulerHeight();
  let pageTop = index > 0 ? (rulerHeight + PAGE_GAP) * (index + 1) : rulerHeight;
  if (!props.hasRulers) {
    pageTop += PAGE_GAP * 2;
  }
  return pageTop;
};

const getSchemaIndex = (paperIndex: number, schemaIndex: number) => {
  return paperIndex === 0
    ? schemaIndex
    : schemaIndex + props.schemasList[paperIndex - 1].length;
};

const onPaperRef = (el: Element | ComponentPublicInstance | null, index: number) => {
  if (el instanceof HTMLDivElement) {
    emit('paperRef', index, el);
  }
};

const onPaperMouseDown = (e: MouseEvent) => {
  if (
    e.currentTarget === e.target &&
    document &&
    document.hasFocus() &&
    document.activeElement instanceof HTMLElement
  ) {
    document.activeElement.blur();
  }
};
</script>

<script lang="ts">
import type { ComponentPublicInstance } from 'vue';
</script>

<template>
  <div
    v-if="pageSizes.length === backgrounds.length && pageSizes.length === schemasList.length"
    :style="{
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
      height: scale + 'px',
      width: scale + 'px',
    }"
  >
    <div
      v-for="(background, paperIndex) in backgrounds"
      :key="String(paperIndex) + JSON.stringify(getPaperSize(paperIndex))"
      :ref="(el) => onPaperRef(el, paperIndex)"
      :style="{
        fontFamily: `'${getFallbackFontName(font)}'`,
        top: getPageTop(paperIndex) + 'px',
        left: getLeftIndent(paperIndex),
        position: 'relative',
        backgroundImage: `url(${background})`,
        backgroundSize: `${getPaperSize(paperIndex).width}px ${getPaperSize(paperIndex).height}px`,
        width: getPaperSize(paperIndex).width + 'px',
        height: getPaperSize(paperIndex).height + 'px',
      }"
      @mousedown="onPaperMouseDown"
    >
      <slot name="paper" :index="paperIndex" :paperSize="getPaperSize(paperIndex)" />
      <div
        v-for="(schema, schemaIndex) in schemasList[paperIndex]"
        :key="schema.id"
      >
        <slot
          name="schema"
          :schema="schema"
          :index="getSchemaIndex(paperIndex, schemaIndex)"
        />
      </div>
    </div>
  </div>
</template>
