<script setup lang="ts">
import { Space, Button, Form } from 'ant-design-vue';
import type { SchemaForUI } from '@pdfme/common';
import type { WidgetProps } from '../../../../widget-types';

interface ButtonConfig {
  key: string;
  icon: string;
  type: 'boolean' | 'select';
  value?: string;
}

const props = defineProps<WidgetProps>();

const buttons = Array.isArray((props.schema as any)?.buttons) ? (props.schema as any).buttons as ButtonConfig[] : [];

const apply = (btn: ButtonConfig) => {
  const ids = props.activeElements.map((ae) => ae.id);
  const ass = props.schemas.filter((s) => ids.includes(s.id));
  props.changeSchemas(
    ass.map((s: SchemaForUI) => {
      const oldValue = Boolean((s as Record<string, unknown>)[btn.key] ?? false);
      const newValue = btn.type === 'boolean' ? !oldValue : btn.value;
      return { key: btn.key, value: newValue, schemaId: s.id };
    }),
  );
};

const isActive = (btn: ButtonConfig) => {
  const ids = props.activeElements.map((ae) => ae.id);
  const ass = props.schemas.filter((s) => ids.includes(s.id));
  let active = false;
  ass.forEach((s: SchemaForUI) => {
    const rec = s as Record<string, unknown>;
    active = btn.type === 'boolean' ? Boolean(rec[btn.key] ?? false) : rec[btn.key] === btn.value;
  });
  return active;
};

const svgIcon = (svgString: string) => {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
};
</script>

<template>
  <Form.Item>
    <Space.Compact>
      <Button
        v-for="(btn, index) in buttons"
        :key="index"
        :type="isActive(btn) ? 'primary' : undefined"
        :ghost="isActive(btn)"
        :style="{ padding: '7px', zIndex: isActive(btn) ? 2 : 0 }"
        @click="apply(btn)"
      >
        <img :width="17" :height="17" :src="svgIcon(btn.icon)" alt="" />
      </Button>
    </Space.Compact>
  </Form.Item>
</template>
