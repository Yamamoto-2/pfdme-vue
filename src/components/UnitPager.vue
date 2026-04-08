<script setup lang="ts">
import type { Size } from '@pdfme/common';
import { Button, Typography } from 'ant-design-vue';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-vue-next';

const { Text } = Typography;

const props = defineProps<{
  size: Size;
  unitCursor: number;
  unitNum: number;
  setUnitCursor: (page: number) => void;
}>();

const textStyle = {
  color: '#fff',
  fontSize: '14px',
  margin: '4px',
};

const buttonWrapStyle = {
  pointerEvents: 'initial' as const,
  position: 'sticky' as const,
  zIndex: 1,
  display: 'flex',
  alignItems: 'center',
  boxSizing: 'border-box' as const,
  height: '40px',
  padding: '8px',
  borderRadius: '4px',
  backgroundColor: 'rgba(0, 0, 0, 0.45)',
};
</script>

<template>
  <div v-if="unitNum > 1" :style="{ position: 'absolute', width: size.width + 'px', height: size.height + 'px' }">
    <div
      :style="{
        position: 'sticky',
        width: '100%',
        zIndex: 1,
        top: 'calc(50% - 20px)',
        display: 'flex',
        alignItems: 'center',
      }"
    >
      <div v-if="unitCursor > 0" :style="{ left: '1rem', marginLeft: '1rem', ...buttonWrapStyle }">
        <Button type="text" :disabled="unitCursor <= 0" @click="setUnitCursor(0)">
          <ChevronsLeft :style="{ color: textStyle.color }" />
        </Button>
        <Button type="text" :disabled="unitCursor <= 0" @click="setUnitCursor(unitCursor - 1)">
          <ChevronLeft :style="{ color: textStyle.color }" />
        </Button>
        <Text strong :style="textStyle">{{ unitCursor + 1 }}/{{ unitNum }}</Text>
      </div>
      <div
        v-if="unitCursor + 1 < unitNum"
        :style="{ right: '1rem', marginLeft: 'auto', marginRight: '1rem', ...buttonWrapStyle }"
      >
        <Text strong :style="textStyle">{{ unitCursor + 1 }}/{{ unitNum }}</Text>
        <Button type="text" :disabled="unitCursor + 1 >= unitNum" @click="setUnitCursor(unitCursor + 1)">
          <ChevronRight :style="{ color: textStyle.color }" />
        </Button>
        <Button type="text" :disabled="unitCursor + 1 >= unitNum" @click="setUnitCursor(unitNum - 1)">
          <ChevronsRight :style="{ color: textStyle.color }" />
        </Button>
      </div>
    </div>
  </div>
</template>
