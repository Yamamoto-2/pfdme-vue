<script setup lang="ts">
import { ref, inject, watch, onBeforeUnmount, computed } from 'vue';
import type { Template, SchemaForUI, Size } from '@pdfme/common';
import { getDynamicTemplate, replacePlaceholders } from '@pdfme/common';
import { getDynamicHeightsForTable } from '@pdfme/schemas';
import UnitPager from './UnitPager.vue';
import Root from './Root.vue';
import StaticSchema from './StaticSchema.vue';
import ErrorScreen from './ErrorScreen.vue';
import CtlBar from './CtlBar.vue';
import Paper from './Paper.vue';
import Renderer from './Renderer.vue';
import { useUIPreProcessor } from '../composables/useUIPreProcessor';
import { useScrollPageCursor } from '../composables/useScrollPageCursor';
import { useMaxZoom } from '../composables/useMaxZoom';
import { FontKey, OptionsKey } from '../composables/injection-keys';
import { template2SchemasList, getPagesScrollTopByIndex } from '../helper';

const _cache = new Map<string | number, unknown>();

const props = defineProps<{
  template: Template;
  inputs: { [key: string]: string }[];
  size: Size;
  onChangeInput?: (args: { index: number; value: string; name: string }) => void;
  onPageChange?: (pageInfo: { currentPage: number; totalPages: number }) => void;
}>();

const font = inject(FontKey, {});
const options = inject(OptionsKey, {});
const maxZoom = useMaxZoom();

const containerRef = ref<HTMLDivElement | null>(null);
const paperRefs = ref<HTMLDivElement[]>([]);

const unitCursor = ref(0);
const pageCursor = ref(0);
const zoomLevel = ref(options.zoomLevel ?? 1);
const schemasList = ref<SchemaForUI[][]>([[]]);

const { backgrounds, pageSizes, scale: scaleFn, error, refresh } = useUIPreProcessor({
  template: () => props.template,
  size: () => props.size,
  zoomLevel: () => zoomLevel.value,
  maxZoom: () => maxZoom,
});

const scale = computed(() => scaleFn());
const isForm = computed(() => Boolean(props.onChangeInput));

const input = computed(() => props.inputs[unitCursor.value]);

let isMounted = true;
let initRequestId = 0;

onBeforeUnmount(() => {
  isMounted = false;
});

const init = (template: Template, inputOverride?: Record<string, string>) => {
  const requestId = ++initRequestId;
  const currentInput = inputOverride ?? input.value;
  const fontOptions = { font };
  const currentRefresh = refresh;
  getDynamicTemplate({
    template,
    input: currentInput,
    options: fontOptions,
    _cache,
    getDynamicHeights: (value, args) => {
      switch (args.schema.type) {
        case 'table':
          return getDynamicHeightsForTable(value, args);
        default:
          return Promise.resolve([args.schema.height]);
      }
    },
  })
    .then(async (dynamicTemplate) => {
      const sl = await template2SchemasList(dynamicTemplate);
      if (!isMounted || requestId !== initRequestId) return;
      schemasList.value = sl;
      await currentRefresh(dynamicTemplate);
    })
    .catch((err) => console.error(`[@pdfme-vue] `, err));
};

watch(
  () => options.zoomLevel,
  (newZoom) => {
    if (typeof newZoom === 'number') {
      zoomLevel.value = newZoom;
    }
  },
);

watch(
  [() => props.inputs, () => props.size, () => props.template, unitCursor],
  () => {
    if (unitCursor.value > props.inputs.length - 1) {
      unitCursor.value = props.inputs.length - 1;
      return;
    }
    init(props.template);
  },
  { immediate: true },
);

useScrollPageCursor({
  containerRef,
  pageSizes,
  scale: () => scale.value,
  pageCursor,
  onChangePageCursor: (p) => {
    pageCursor.value = p;
    if (props.onPageChange) {
      props.onPageChange({ currentPage: p, totalPages: schemasList.value.length });
    }
  },
});

const handleChangeInput = ({ name, value }: { name: string; value: string }) => {
  if (props.onChangeInput) {
    props.onChangeInput({ index: unitCursor.value, name, value });
  }
};

const handleOnChangeRenderer = (
  args: { key: string; value: unknown }[],
  schema: SchemaForUI,
) => {
  let isNeedInit = false;
  let newInputValue: string | undefined;

  args.forEach(({ key: _key, value }) => {
    if (_key === 'content') {
      const newValue = value as string;
      const oldValue = (input.value?.[schema.name] as string) || '';
      if (newValue === oldValue) return;
      handleChangeInput({ name: schema.name, value: newValue });
      if (schema.type === 'table') {
        isNeedInit = true;
        newInputValue = newValue;
      }
    } else {
      const targetSchema = schemasList.value[pageCursor.value].find(
        (s) => s.id === schema.id,
      ) as SchemaForUI;
      if (!targetSchema) return;
      // @ts-expect-error Dynamic property assignment
      targetSchema[_key] = value as string;
    }
  });
  if (isNeedInit && newInputValue !== undefined) {
    const updatedInput = { ...input.value, [schema.name]: newInputValue };
    init(props.template, updatedInput);
  }
  schemasList.value = [...schemasList.value];
};

const setPageCursor = (p: number) => {
  if (!containerRef.value) return;
  containerRef.value.scrollTop = getPagesScrollTopByIndex(pageSizes.value, p, scale.value);
  pageCursor.value = p;
  if (props.onPageChange) {
    props.onPageChange({ currentPage: p, totalPages: schemasList.value.length });
  }
};

const getSchemaValue = (schema: SchemaForUI, index: number) => {
  if (schema.readOnly) {
    return replacePlaceholders({
      content: schema.content || '',
      variables: {
        ...input.value,
        totalPages: schemasList.value.length,
        currentPage: index + 1,
      },
      schemas: schemasList.value,
    });
  }
  return String((input.value && input.value[schema.name]) || '');
};

const onPaperRef = (index: number, el: HTMLDivElement) => {
  paperRefs.value[index] = el;
};
</script>

<template>
  <ErrorScreen v-if="error" :size="size" :error="error" />
  <Root v-else :size="size" :scale="scale">
    <CtlBar
      :size="size"
      :pageCursor="pageCursor"
      :pageNum="schemasList.length"
      :setPageCursor="setPageCursor"
      :zoomLevel="zoomLevel"
      :setZoomLevel="(z: number) => { zoomLevel = z; }"
    />
    <UnitPager
      :size="size"
      :unitCursor="unitCursor"
      :unitNum="inputs.length"
      :setUnitCursor="(u: number) => { unitCursor = u; }"
    />
    <div ref="containerRef" :style="{ ...size, position: 'relative', overflow: 'auto' }">
      <Paper
        :scale="scale"
        :size="size"
        :schemasList="schemasList"
        :pageSizes="pageSizes"
        :backgrounds="backgrounds"
        @paperRef="onPaperRef"
      >
        <template #paper="{ index }">
          <StaticSchema
            :template="template"
            :scale="scale"
            :input="input"
            :totalPages="schemasList.length"
            :currentPage="index + 1"
          />
        </template>
        <template #schema="{ schema, index }">
          <Renderer
            :key="schema.id"
            :schema="schema"
            :basePdf="template.basePdf"
            :value="getSchemaValue(schema, index)"
            :mode="isForm ? 'form' : 'viewer'"
            :placeholder="schema.content"
            :tabIndex="index + 100"
            :onChange="(arg: any) => {
              const args = Array.isArray(arg) ? arg : [arg];
              handleOnChangeRenderer(args, schema);
            }"
            :outline="isForm && !schema.readOnly ? '1px dashed var(--ant-color-primary, #38a0ff)' : 'transparent'"
            :scale="scale"
          />
        </template>
      </Paper>
    </div>
  </Root>
</template>
