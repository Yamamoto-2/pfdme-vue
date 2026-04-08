<script setup lang="ts">
import { inject } from 'vue';
import type { Size } from '@pdfme/common';
import { I18nKey } from '../composables/injection-keys';
import { BACKGROUND_COLOR } from '../constants';
import { Result } from 'ant-design-vue';

defineProps<{
  size: Size;
  error: Error;
}>();

const i18n = inject(I18nKey, (key: string) => key);
</script>

<template>
  <div
    :style="{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      background: BACKGROUND_COLOR,
      width: size.width + 'px',
      height: size.height + 'px',
    }"
  >
    <div :style="{ width: '300px', margin: '0 auto', background: 'var(--ant-color-bg-layout, #f5f5f5)' }">
      <Result :icon="null" title="ERROR" :sub-title="i18n('errorOccurred')">
        <template #extra>
          <span>{{ error.message }}</span>
        </template>
      </Result>
    </div>
  </div>
</template>
