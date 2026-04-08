<script setup lang="ts">
import { inject } from 'vue';
import { Button, Typography } from 'ant-design-vue';
import { GripVertical, CircleAlert, Lock } from 'lucide-vue-next';
import { I18nKey } from '../../../../composables/injection-keys';

const { Text } = Typography;

defineProps<{
  value: string;
  icon?: boolean;
  status?: 'is-warning' | 'is-danger';
  title?: string;
  required?: boolean;
  readOnly?: boolean;
  dragOverlay?: boolean;
  selected?: boolean;
  hovering?: boolean;
}>();

defineEmits<{
  (e: 'click'): void;
  (e: 'mouseenter'): void;
  (e: 'mouseleave'): void;
}>();

const i18n = inject(I18nKey, (key: string) => key);
</script>

<template>
  <li :style="{ marginTop: '10px', listStyle: 'none' }">
    <div
      :style="{
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        gap: '0.5rem',
        padding: '4px',
        borderRadius: '4px',
        background: selected ? 'var(--ant-color-primary, #38a0ff)' : 'transparent',
        border: `1px solid ${hovering ? 'var(--ant-color-primary, #38a0ff)' : 'transparent'}`,
        opacity: dragOverlay ? 0.8 : 1,
      }"
      @click="$emit('click')"
      @mouseenter="$emit('mouseenter')"
      @mouseleave="$emit('mouseleave')"
    >
      <Button
        :style="{
          display: 'flex',
          alignItems: 'center',
          background: 'none',
          boxShadow: 'none',
          border: 'none',
          paddingLeft: '0.25rem',
          cursor: 'grab',
        }"
      >
        <GripVertical :size="15" :style="{ cursor: 'grab' }" />
      </Button>
      <slot name="icon" />
      <Text
        :style="{
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          width: '100%',
          color: selected ? '#fff' : undefined,
        }"
        :title="title || ''"
      >
        <template v-if="status === undefined">{{ value }}</template>
        <span v-else :style="{ display: 'flex', alignItems: 'center' }">
          <CircleAlert :size="15" :style="{ marginRight: '0.25rem' }" />
          {{ status === 'is-warning' ? i18n('noKeyName') : value }}
          {{ status === 'is-danger' ? i18n('notUniq') : '' }}
        </span>
      </Text>
      <Lock v-if="readOnly" :size="15" :style="{ marginRight: '0.5rem' }" />
      <span v-if="required" :style="{ color: 'red', marginRight: '0.5rem' }">*</span>
    </div>
  </li>
</template>
