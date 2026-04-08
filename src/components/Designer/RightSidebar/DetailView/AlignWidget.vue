<script setup lang="ts">
import { Space, Button, Form } from 'ant-design-vue';
import type { WidgetProps } from '../../../../widget-types';
import { DESIGNER_CLASSNAME } from '../../../../constants';
import {
  AlignStartVertical,
  AlignStartHorizontal,
  AlignCenterVertical,
  AlignCenterHorizontal,
  AlignEndVertical,
  AlignEndHorizontal,
  AlignVerticalSpaceAround,
  AlignHorizontalSpaceAround,
} from 'lucide-vue-next';
import { round } from '../../../../helper';

const props = defineProps<WidgetProps>();

const align = (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
  const ids = props.activeElements.map((ae) => ae.id);
  const ass = props.schemas.filter((s) => ids.includes(s.id));
  const isVertical = ['left', 'center', 'right'].includes(type);
  const tgtPos = isVertical ? 'x' : 'y';
  const tgtSize = isVertical ? 'width' : 'height';
  const isSingle = ass.length === 1;
  const root = props.pageSize ? (tgtSize === 'width' ? (props.pageSize as any).width : (props.pageSize as any).height) : 0;

  const min = isSingle ? 0 : Math.min(...ass.map((as) => tgtPos === 'x' ? as.position.x : as.position.y));
  const max = isSingle ? root : Math.max(...ass.map((as) => (tgtPos === 'x' ? as.position.x : as.position.y) + (as as any)[tgtSize]));

  let basePos = min;
  let adjust: (size: number) => number = () => 0;
  if (['center', 'middle'].includes(type)) { basePos = (min + max) / 2; adjust = (s) => s / 2; }
  else if (['right', 'bottom'].includes(type)) { basePos = max; adjust = (s) => s; }

  props.changeSchemas(ass.map((as) => ({
    key: `position.${tgtPos}`,
    value: round(basePos - adjust((as as any)[tgtSize]), 2),
    schemaId: as.id,
  })));
};

const distribute = (type: 'vertical' | 'horizontal') => {
  const ids = props.activeElements.map((ae) => ae.id);
  const ass = props.schemas.filter((s) => ids.includes(s.id));
  if (ass.length < 3) return;
  const isVertical = type === 'vertical';
  const tgtPos = isVertical ? 'y' : 'x';
  const tgtSize = isVertical ? 'height' : 'width';

  const min = Math.min(...ass.map((as) => tgtPos === 'x' ? as.position.x : as.position.y));
  const max = Math.max(...ass.map((as) => (tgtPos === 'x' ? as.position.x : as.position.y) + (as as any)[tgtSize]));
  const sum = ass.reduce((acc, cur) => acc + ((cur as any)[tgtSize] || 0), 0);
  const unit = (max - min - sum) / (ass.length - 1);

  let prev = 0;
  props.changeSchemas(ass.map((as, index) => {
    const prevSize = index === 0 ? 0 : (ass[index - 1] as any)[tgtSize] || 0;
    prev += index === 0 ? 0 : prevSize + unit;
    return { key: `position.${tgtPos}`, value: round(min + prev, 2), schemaId: as.id };
  }));
};
</script>

<template>
  <Form.Item :label="(schema as any)?.title">
    <Space.Compact>
      <Button :class="DESIGNER_CLASSNAME + 'align-left'" :style="{ padding: '7px' }" @click="align('left')">
        <AlignStartVertical :size="15" />
      </Button>
      <Button :class="DESIGNER_CLASSNAME + 'align-center'" :style="{ padding: '7px' }" @click="align('center')">
        <AlignCenterVertical :size="15" />
      </Button>
      <Button :class="DESIGNER_CLASSNAME + 'align-right'" :style="{ padding: '7px' }" @click="align('right')">
        <AlignEndVertical :size="15" />
      </Button>
      <Button :class="DESIGNER_CLASSNAME + 'align-top'" :style="{ padding: '7px' }" @click="align('top')">
        <AlignStartHorizontal :size="15" />
      </Button>
      <Button :class="DESIGNER_CLASSNAME + 'align-middle'" :style="{ padding: '7px' }" @click="align('middle')">
        <AlignCenterHorizontal :size="15" />
      </Button>
      <Button :class="DESIGNER_CLASSNAME + 'align-bottom'" :style="{ padding: '7px' }" @click="align('bottom')">
        <AlignEndHorizontal :size="15" />
      </Button>
      <Button :class="DESIGNER_CLASSNAME + 'align-vertical'" :style="{ padding: '7px' }" :disabled="activeElements.length < 3" @click="distribute('vertical')">
        <AlignVerticalSpaceAround :size="15" />
      </Button>
      <Button :class="DESIGNER_CLASSNAME + 'align-horizontal'" :style="{ padding: '7px' }" :disabled="activeElements.length < 3" @click="distribute('horizontal')">
        <AlignHorizontalSpaceAround :size="15" />
      </Button>
    </Space.Compact>
  </Form.Item>
</template>
