<script setup lang="ts">
import { inject, computed } from 'vue';
import type { Size } from '@pdfme/common';
import { Plus, Minus, ChevronLeft, ChevronRight, Ellipsis } from 'lucide-vue-next';
import { Typography, Button, Dropdown } from 'ant-design-vue';
import { I18nKey } from '../composables/injection-keys';
import { useMaxZoom } from '../composables/useMaxZoom';
import { UI_CLASSNAME } from '../constants';

const { Text } = Typography;

const props = defineProps<{
  size: Size;
  pageCursor: number;
  pageNum: number;
  setPageCursor: (page: number) => void;
  zoomLevel: number;
  setZoomLevel: (zoom: number) => void;
  addPageAfter?: () => void;
  removePage?: () => void;
}>();

const i18n = inject(I18nKey, (key: string) => key);
const maxZoom = useMaxZoom();
const zoomStep = 0.25;
const minZoom = 0.25;

const textStyle = {
  color: '#fff',
  fontSize: '14px',
  margin: '4px',
};

const contextMenuItems = computed(() => {
  const items: { key: string; label: string; onClick: () => void }[] = [];
  if (props.addPageAfter) {
    items.push({ key: '1', label: i18n('addPageAfter'), onClick: props.addPageAfter });
  }
  if (props.removePage && props.pageNum > 1 && props.pageCursor !== 0) {
    items.push({ key: '2', label: i18n('removePage'), onClick: props.removePage });
  }
  return items;
});

const barWidth = computed(() => {
  const contextMenuWidth = contextMenuItems.value.length > 0 ? 50 : 0;
  return (props.pageNum > 1 ? 300 : 150) + contextMenuWidth;
});
</script>

<template>
  <div :style="{ position: 'absolute', top: 'auto', bottom: '6%', width: size.width + 'px' }">
    <div
      :class="UI_CLASSNAME + 'control-bar'"
      :style="{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-evenly',
        position: 'relative',
        zIndex: 1,
        left: `calc(50% - ${barWidth / 2}px)`,
        width: barWidth + 'px',
        height: '40px',
        boxSizing: 'border-box',
        padding: '8px',
        borderRadius: '4px',
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
      }"
    >
      <!-- Pager -->
      <div v-if="pageNum > 1" :class="UI_CLASSNAME + 'pager'" :style="{ display: 'flex', alignItems: 'center' }">
        <Button
          :class="UI_CLASSNAME + 'page-prev'"
          type="text"
          :disabled="pageCursor <= 0"
          @click="setPageCursor(pageCursor - 1)"
        >
          <ChevronLeft :size="16" :style="{ color: textStyle.color }" />
        </Button>
        <Text strong :style="textStyle">{{ pageCursor + 1 }}/{{ pageNum }}</Text>
        <Button
          :class="UI_CLASSNAME + 'page-next'"
          type="text"
          :disabled="pageCursor + 1 >= pageNum"
          @click="setPageCursor(pageCursor + 1)"
        >
          <ChevronRight :size="16" :style="{ color: textStyle.color }" />
        </Button>
      </div>

      <!-- Zoom -->
      <div :class="UI_CLASSNAME + 'zoom'" :style="{ display: 'flex', alignItems: 'center' }">
        <Button
          :class="UI_CLASSNAME + 'zoom-out'"
          type="text"
          :disabled="minZoom >= zoomLevel - zoomStep"
          @click="setZoomLevel(zoomLevel - zoomStep)"
        >
          <Minus :size="16" :style="{ color: textStyle.color }" />
        </Button>
        <Text strong :style="textStyle">{{ Math.round(zoomLevel * 100) }}%</Text>
        <Button
          :class="UI_CLASSNAME + 'zoom-in'"
          type="text"
          :disabled="maxZoom < zoomLevel + zoomStep"
          @click="setZoomLevel(zoomLevel + zoomStep)"
        >
          <Plus :size="16" :style="{ color: textStyle.color }" />
        </Button>
      </div>

      <!-- Context Menu -->
      <Dropdown
        v-if="contextMenuItems.length > 0"
        :trigger="['click']"
        placement="top"
      >
        <Button :class="UI_CLASSNAME + 'context-menu'" type="text">
          <Ellipsis :size="16" :style="{ color: textStyle.color }" />
        </Button>
        <template #overlay>
          <a-menu>
            <a-menu-item
              v-for="item in contextMenuItems"
              :key="item.key"
              @click="item.onClick"
            >
              {{ item.label }}
            </a-menu-item>
          </a-menu>
        </template>
      </Dropdown>
    </div>
  </div>
</template>
