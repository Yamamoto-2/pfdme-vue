<script setup lang="ts">
import { ref, inject, watch, onBeforeUnmount, computed } from 'vue';
import type { Mode, SchemaForUI, BasePdf, Schema, Plugin, UIOptions } from '@pdfme/common';
import { ZOOM, cloneDeep } from '@pdfme/common';
import { SELECTABLE_CLASSNAME } from '../constants';
import { PluginsRegistryKey, OptionsKey, I18nKey, CacheKey } from '../composables/injection-keys';

const props = defineProps<{
  basePdf: BasePdf;
  schema: SchemaForUI;
  value: string;
  outline: string;
  onChangeHoveringSchemaId?: (id: string | null) => void;
  scale: number;
  mode: Mode;
  onChange?: (arg: { key: string; value: unknown } | { key: string; value: unknown }[]) => void;
  stopEditing?: () => void;
  tabIndex?: number;
  placeholder?: string;
  selectable?: boolean;
}>();

const pluginsRegistry = inject(PluginsRegistryKey)!;
const options = inject(OptionsKey, {});
const i18n = inject(I18nKey, (key: string) => key);
const _cache = inject(CacheKey, new Map());

const renderRef = ref<HTMLDivElement>();
const plugin = computed(() => pluginsRegistry.findByType(props.schema.type));

// Compute a render key for controlling re-renders (matching original logic)
const renderKey = computed(() => {
  const _options = cloneDeep(options) as UIOptions;
  if (_options.font) {
    Object.values(_options.font).forEach((fontObj) => {
      (fontObj as { data: string }).data = '...';
    });
  }
  const optionStr = JSON.stringify(_options);

  if (plugin.value?.uninterruptedEditMode && props.mode === 'designer') {
    return props.mode;
  } else {
    return JSON.stringify([props.value, props.mode, props.scale, props.schema, optionStr]);
  }
});

let cancelled = false;

const doRender = () => {
  const element = renderRef.value;
  const currentPlugin = plugin.value;
  if (!currentPlugin?.ui || !element || !props.schema.type) return;

  cancelled = false;
  element.innerHTML = '';
  element.dataset.pdfmeRenderReady = 'false';

  void Promise.resolve(
    currentPlugin.ui({
      value: props.value,
      schema: props.schema,
      basePdf: props.basePdf,
      rootElement: element,
      mode: props.mode,
      onChange: props.onChange as ((arg: { key: string; value: unknown } | { key: string; value: unknown }[]) => void) | undefined,
      stopEditing: props.stopEditing,
      tabIndex: props.tabIndex,
      placeholder: props.placeholder,
      options,
      theme: {} as Record<string, unknown>,
      i18n: i18n as (key: string) => string,
      scale: props.scale,
      _cache,
    }),
  ).finally(() => {
    if (!cancelled && element) {
      element.dataset.pdfmeRenderReady = 'true';
    }
  });
};

watch(renderKey, () => {
  const element = renderRef.value;
  if (element) {
    cancelled = true;
    element.dispatchEvent(new Event('beforeRemove'));
    element.innerHTML = '';
    delete element.dataset.pdfmeRenderReady;
  }
  doRender();
}, { flush: 'post' });

// Initial render after mount
watch(renderRef, (el) => {
  if (el) doRender();
});

onBeforeUnmount(() => {
  cancelled = true;
  const element = renderRef.value;
  if (element) {
    element.dispatchEvent(new Event('beforeRemove'));
    element.innerHTML = '';
    delete element.dataset.pdfmeRenderReady;
  }
});
</script>

<template>
  <div
    v-if="plugin"
    :title="schema.name"
    :class="(selectable !== false) ? SELECTABLE_CLASSNAME : ''"
    :id="schema.id"
    :style="{
      position: 'absolute',
      cursor: schema.readOnly ? 'initial' : 'pointer',
      height: schema.height * ZOOM + 'px',
      width: schema.width * ZOOM + 'px',
      top: schema.position.y * ZOOM + 'px',
      left: schema.position.x * ZOOM + 'px',
      transform: `rotate(${schema.rotate ?? 0}deg)`,
      opacity: schema.opacity ?? 1,
      outline,
    }"
    @mouseenter="onChangeHoveringSchemaId?.(schema.id)"
    @mouseleave="onChangeHoveringSchemaId?.(null)"
  >
    <span
      v-if="schema.required"
      :style="{
        color: 'red',
        position: 'absolute',
        top: '-12px',
        left: '-12px',
        fontSize: '18px',
        fontWeight: 700,
      }"
    >*</span>
    <div ref="renderRef" :style="{ height: '100%', width: '100%' }" />
  </div>
</template>
