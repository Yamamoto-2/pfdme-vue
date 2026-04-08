<script setup lang="ts">
import { provide, computed } from 'vue';
import { ConfigProvider as ThemeConfigProvider } from 'ant-design-vue';
import { I18nKey, FontKey, PluginsRegistryKey, OptionsKey, CacheKey } from '../composables/injection-keys';
import { i18n, getDict } from '../i18n';
import { defaultTheme, type ThemeConfig } from '../theme';
import type { Dict, Font, Lang, UIOptions, PluginRegistry } from '@pdfme/common';

const props = defineProps<{
  lang: Lang;
  font: Font;
  plugins: PluginRegistry;
  options: UIOptions;
}>();

const isObject = (item: unknown): item is Record<string, unknown> =>
  Boolean(item) && typeof item === 'object' && !Array.isArray(item);

const deepMerge = <T extends Record<string, unknown>, U extends Record<string, unknown>>(
  target: T,
  source: U,
): T & U => {
  const output = { ...target } as T & U;

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      const sourceValue = source[key];
      if (isObject(sourceValue)) {
        if (!(key in target)) {
          Object.assign(output, { [key]: sourceValue });
        } else {
          const targetValue = target[key];
          if (isObject(targetValue)) {
            (output as Record<string, unknown>)[key] = deepMerge(targetValue, sourceValue);
          } else {
            Object.assign(output, { [key]: sourceValue });
          }
        }
      } else {
        Object.assign(output, { [key]: sourceValue });
      }
    });
  }
  return output;
};

const theme = computed<ThemeConfig>(() => {
  let t = defaultTheme;
  if (props.options.theme) {
    t = deepMerge(
      t as unknown as Record<string, unknown>,
      props.options.theme as unknown as Record<string, unknown>,
    ) as typeof t;
  }
  return t;
});

const dict = computed(() => {
  let d = getDict(props.lang);
  if (props.options.labels) {
    d = deepMerge(
      d as unknown as Record<string, unknown>,
      props.options.labels as unknown as Record<string, unknown>,
    ) as typeof d;
  }
  return d;
});

const i18nFn = computed(() => (key: keyof Dict) => i18n(key, dict.value));

const cache = new Map<string | number, unknown>();

provide(I18nKey, i18nFn.value);
provide(FontKey, props.font);
provide(PluginsRegistryKey, props.plugins);
provide(OptionsKey, props.options);
provide(CacheKey, cache);
</script>

<template>
  <ThemeConfigProvider :theme="theme">
    <slot />
  </ThemeConfigProvider>
</template>
