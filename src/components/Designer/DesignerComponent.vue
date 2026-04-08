<script setup lang="ts">
import { ref, inject, watch, onMounted, computed } from 'vue';
import type { Template, Schema, SchemaForUI, ChangeSchemas, Size } from '@pdfme/common';
import { cloneDeep, ZOOM, isBlankPdf, px2mm } from '@pdfme/common';
import { I18nKey, OptionsKey, PluginsRegistryKey } from '../../composables/injection-keys';
import {
  schemasList2template,
  uuid,
  round,
  template2SchemasList,
  getPagesScrollTopByIndex,
  changeSchemas as _changeSchemas,
} from '../../helper';
import { useMaxZoom } from '../../composables/useMaxZoom';
import { useUIPreProcessor } from '../../composables/useUIPreProcessor';
import { useScrollPageCursor } from '../../composables/useScrollPageCursor';
import { RULER_HEIGHT, RIGHT_SIDEBAR_WIDTH, LEFT_SIDEBAR_WIDTH } from '../../constants';
import Root from '../Root.vue';
import ErrorScreen from '../ErrorScreen.vue';
import CtlBar from '../CtlBar.vue';
import LeftSidebar from './LeftSidebar.vue';
import RightSidebar from './RightSidebar/RightSidebar.vue';
import CanvasComponent from './Canvas/CanvasComponent.vue';
import { initShortCuts, destroyShortCuts, moveCommandToChangeSchemasArg, getUniqueSchemaName } from '../../helper';

const props = defineProps<{
  template: Template;
  size: Size;
  onSaveTemplate: (t: Template) => void;
  onChangeTemplate: (t: Template) => void;
  onPageCursorChange: (newPageCursor: number, totalPages: number) => void;
}>();

const i18n = inject(I18nKey, (key: string) => key);
const pluginsRegistry = inject(PluginsRegistryKey)!;
const options = inject(OptionsKey, {});
const maxZoom = useMaxZoom();

const past = ref<SchemaForUI[][]>([]);
const future = ref<SchemaForUI[][]>([]);
const canvasComponentRef = ref<InstanceType<typeof CanvasComponent>>();
const paperRefs = ref<HTMLDivElement[]>([]);

const hoveringSchemaId = ref<string | null>(null);
const activeElements = ref<HTMLElement[]>([]);
const schemasList = ref<SchemaForUI[][]>([[]]);
const pageCursor = ref(0);
const zoomLevel = ref(options.zoomLevel ?? 1);
const sidebarOpen = ref(options.sidebarOpen ?? true);
const canvasHeight = ref(0);
const prevTemplate = ref<Template | null>(null);

const { backgrounds, pageSizes, scale: scaleFn, error, refresh } = useUIPreProcessor({
  template: () => props.template,
  size: () => props.size,
  zoomLevel: () => zoomLevel.value,
  maxZoom: () => maxZoom,
});

const scale = computed(() => scaleFn());

const onEdit = (targets: Array<HTMLElement | null | undefined>) => {
  activeElements.value = targets.filter((t): t is HTMLElement => t instanceof HTMLElement);
  hoveringSchemaId.value = null;
};

const onEditEnd = () => {
  activeElements.value = [];
  hoveringSchemaId.value = null;
};

const canvasRef = computed(() => canvasComponentRef.value?.canvasRef ?? null);

useScrollPageCursor({
  containerRef: canvasRef as any,
  pageSizes,
  scale: () => scale.value,
  pageCursor,
  onChangePageCursor: (p) => {
    pageCursor.value = p;
    props.onPageCursorChange(p, schemasList.value.length);
    onEditEnd();
  },
});

const commitSchemas = (newSchemas: SchemaForUI[]) => {
  future.value = [];
  past.value.push(cloneDeep(schemasList.value[pageCursor.value]));
  const _schemasList = cloneDeep(schemasList.value);
  _schemasList[pageCursor.value] = newSchemas;
  schemasList.value = _schemasList;
  props.onChangeTemplate(schemasList2template(_schemasList, props.template.basePdf));
};

const removeSchemas = (ids: string[]) => {
  commitSchemas(schemasList.value[pageCursor.value].filter((schema) => !ids.includes(schema.id)));
  onEditEnd();
};

const changeSchemas: ChangeSchemas = (objs) => {
  _changeSchemas({
    objs,
    schemas: schemasList.value[pageCursor.value],
    basePdf: props.template.basePdf,
    pluginsRegistry,
    pageSize: pageSizes.value[pageCursor.value],
    commitSchemas,
  });
};

// Keyboard shortcuts
let copiedSchemas: SchemaForUI[] | null = null;

const setupShortcuts = () => {
  destroyShortCuts();
  const getElementsByIds = (ids: string[]) =>
    ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el instanceof HTMLElement);

  const getActiveSchemas = () => {
    const ids = activeElements.value.map((ae) => ae.id);
    return schemasList.value[pageCursor.value].filter((s) => ids.includes(s.id));
  };

  const timeTravel = (mode: 'undo' | 'redo') => {
    const isUndo = mode === 'undo';
    const stack = isUndo ? past : future;
    if (stack.value.length <= 0) return;
    (isUndo ? future : past).value.push(cloneDeep(schemasList.value[pageCursor.value]));
    const s = cloneDeep(schemasList.value);
    s[pageCursor.value] = stack.value.pop()!;
    schemasList.value = s;
  };

  initShortCuts({
    move: (command, isShift) => {
      const pageSize = pageSizes.value[pageCursor.value];
      const activeSchemas = getActiveSchemas();
      const arg = moveCommandToChangeSchemasArg({ command, activeSchemas, pageSize, isShift });
      changeSchemas(arg);
    },
    copy: () => {
      const as = getActiveSchemas();
      if (as.length === 0) return;
      copiedSchemas = as;
    },
    paste: () => {
      if (!copiedSchemas || copiedSchemas.length === 0) return;
      const schema = schemasList.value[pageCursor.value];
      const stackUniqueSchemaNames: string[] = [];
      const pasteSchemas = copiedSchemas.map((cs) => {
        const id = uuid();
        const name = getUniqueSchemaName({ copiedSchemaName: cs.name, schema, stackUniqueSchemaNames });
        const ps = pageSizes.value[pageCursor.value];
        const position = {
          x: cs.position.x + 10 > ps.width - cs.width ? ps.width - cs.width : cs.position.x + 10,
          y: cs.position.y + 10 > ps.height - cs.height ? ps.height - cs.height : cs.position.y + 10,
        };
        return Object.assign(cloneDeep(cs), { id, name, position });
      });
      commitSchemas(schema.concat(pasteSchemas));
      setTimeout(() => onEdit(getElementsByIds(pasteSchemas.map((s) => s.id))));
      copiedSchemas = pasteSchemas;
    },
    redo: () => timeTravel('redo'),
    undo: () => timeTravel('undo'),
    save: () => props.onSaveTemplate(schemasList2template(schemasList.value, props.template.basePdf)),
    remove: () => removeSchemas(getActiveSchemas().map((s) => s.id)),
    esc: onEditEnd,
    selectAll: () => onEdit(getElementsByIds(schemasList.value[pageCursor.value].map((s) => s.id))),
  });
};

watch(
  [activeElements, pageCursor, schemasList, pageSizes],
  setupShortcuts,
  { deep: true },
);

onMounted(setupShortcuts);

const updateTemplate = async (newTemplate: Template) => {
  const sl = await template2SchemasList(newTemplate);
  schemasList.value = sl;
  onEditEnd();
  pageCursor.value = 0;
};

const addSchema = (defaultSchema: Schema) => {
  const [paddingTop, paddingRight, paddingBottom, paddingLeft] = isBlankPdf(props.template.basePdf)
    ? props.template.basePdf.padding
    : [0, 0, 0, 0];
  const pageSize = pageSizes.value[pageCursor.value];

  let index = schemasList.value.reduce((acc, page) => acc + page.length, 1);
  let newName = i18n('field') + index;
  while (schemasList.value.some((page) => page.find((s) => s.name === newName))) {
    index++;
    newName = i18n('field') + index;
  }

  const ensureMiddle = (min: number, value: number, max: number) => Math.min(Math.max(min, value), max);

  const s = {
    id: uuid(),
    ...defaultSchema,
    name: newName,
    position: {
      x: ensureMiddle(paddingLeft, defaultSchema.position.x, pageSize.width - paddingRight - defaultSchema.width),
      y: ensureMiddle(paddingTop, defaultSchema.position.y, pageSize.height - paddingBottom - defaultSchema.height),
    },
    required: defaultSchema.readOnly ? false : options.requiredByDefault || defaultSchema.required || false,
  } as SchemaForUI;

  if (defaultSchema.position.y === 0) {
    const paper = paperRefs.value[pageCursor.value];
    const rectTop = paper ? paper.getBoundingClientRect().top : 0;
    s.position.y = rectTop > 0 ? paddingTop : pageSizes.value[pageCursor.value].height / 2;
  }

  commitSchemas(schemasList.value[pageCursor.value].concat(s));
  setTimeout(() => onEdit([document.getElementById(s.id)]));
};

// Handle drop from left sidebar (HTML5 DnD)
const onCanvasDrop = (e: DragEvent) => {
  e.preventDefault();
  const data = e.dataTransfer?.getData('application/json');
  if (!data) return;
  try {
    const defaultSchema = JSON.parse(data) as Schema;
    const paper = paperRefs.value[pageCursor.value];
    if (!paper) return;
    const pageRect = paper.getBoundingClientRect();
    const x = round(px2mm(Math.max(0, (e.clientX - pageRect.left) / scale.value)), 2);
    const y = round(px2mm(Math.max(0, (e.clientY - pageRect.top) / scale.value)), 2);
    addSchema({ ...defaultSchema, position: { x, y } });
  } catch { /* ignore */ }
};

const onCanvasDragOver = (e: DragEvent) => {
  e.preventDefault();
};

// Page management
const handleAddPageAfter = () => {
  const _schemasList = cloneDeep(schemasList.value);
  _schemasList.splice(pageCursor.value + 1, 0, []);
  schemasList.value = _schemasList;
  pageCursor.value = pageCursor.value + 1;
  const newTemplate = schemasList2template(_schemasList, props.template.basePdf);
  props.onChangeTemplate(newTemplate);
  void refresh(newTemplate);
};

const handleRemovePage = () => {
  if (pageCursor.value === 0) return;
  if (!window.confirm(i18n('removePageConfirm'))) return;
  const _schemasList = cloneDeep(schemasList.value);
  _schemasList.splice(pageCursor.value, 1);
  schemasList.value = _schemasList;
  pageCursor.value = pageCursor.value - 1;
  const newTemplate = schemasList2template(_schemasList, props.template.basePdf);
  props.onChangeTemplate(newTemplate);
  void refresh(newTemplate);
};

// Watch template changes
watch(
  () => props.template,
  (newTemplate) => {
    if (prevTemplate.value !== newTemplate) {
      prevTemplate.value = newTemplate;
      void updateTemplate(newTemplate);
    }
  },
  { immediate: true },
);

// Canvas height tracking
onMounted(() => {
  const updateHeight = () => {
    const el = canvasComponentRef.value?.canvasRef;
    canvasHeight.value = el ? el.clientHeight : 0;
  };
  updateHeight();
  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(updateHeight);
    watch(() => canvasComponentRef.value?.canvasRef, (el) => {
      if (el) observer.observe(el);
    }, { immediate: true });
  }
});

const canvasWidth = computed(() => props.size.width - LEFT_SIDEBAR_WIDTH);
const sizeExcSidebars = computed(() => ({
  width: sidebarOpen.value ? canvasWidth.value - RIGHT_SIDEBAR_WIDTH : canvasWidth.value,
  height: props.size.height,
}));

const pageManipulation = computed(() =>
  isBlankPdf(props.template.basePdf)
    ? { addPageAfter: handleAddPageAfter, removePage: handleRemovePage }
    : {},
);

const onEditById = (id: string) => {
  const el = document.getElementById(id);
  if (el) onEdit([el]);
};

const onPaperRef = (index: number, el: HTMLDivElement) => {
  paperRefs.value[index] = el;
};
</script>

<template>
  <ErrorScreen v-if="error" :size="size" :error="error" />
  <Root v-else :size="size" :scale="scale">
    <LeftSidebar
      :height="canvasHeight"
      :scale="scale"
      :basePdf="template.basePdf"
      :onAddSchema="addSchema"
    />

    <div
      :style="{ position: 'absolute', width: canvasWidth + 'px', marginLeft: LEFT_SIDEBAR_WIDTH + 'px' }"
      @drop="onCanvasDrop"
      @dragover="onCanvasDragOver"
    >
      <CtlBar
        :size="sizeExcSidebars"
        :pageCursor="pageCursor"
        :pageNum="schemasList.length"
        :setPageCursor="(p: number) => {
          const el = canvasComponentRef?.canvasRef;
          if (el) el.scrollTop = getPagesScrollTopByIndex(pageSizes, p, scale);
          pageCursor = p;
          onPageCursorChange(p, schemasList.length);
          onEditEnd();
        }"
        :zoomLevel="zoomLevel"
        :setZoomLevel="(z: number) => { zoomLevel = z; }"
        v-bind="pageManipulation"
      />

      <RightSidebar
        :hoveringSchemaId="hoveringSchemaId"
        :onChangeHoveringSchemaId="(id: string | null) => { hoveringSchemaId = id; }"
        :height="canvasHeight"
        :size="size"
        :pageSize="pageSizes[pageCursor] ?? { width: 0, height: 0 }"
        :basePdf="template.basePdf"
        :activeElements="activeElements"
        :schemasList="schemasList"
        :schemas="schemasList[pageCursor] ?? []"
        :changeSchemas="changeSchemas"
        :onSortEnd="(sorted: SchemaForUI[]) => commitSchemas(sorted)"
        :onEdit="onEditById"
        :onEditEnd="onEditEnd"
        :deselectSchema="onEditEnd"
        :sidebarOpen="sidebarOpen"
        :setSidebarOpen="(open: boolean) => { sidebarOpen = open; }"
      />

      <CanvasComponent
        ref="canvasComponentRef"
        :basePdf="template.basePdf"
        :hoveringSchemaId="hoveringSchemaId"
        :onChangeHoveringSchemaId="(id: string | null) => { hoveringSchemaId = id; }"
        :height="size.height - RULER_HEIGHT * ZOOM"
        :pageCursor="pageCursor"
        :scale="scale"
        :size="sizeExcSidebars"
        :pageSizes="pageSizes"
        :backgrounds="backgrounds"
        :activeElements="activeElements"
        :schemasList="schemasList"
        :changeSchemas="changeSchemas"
        :removeSchemas="removeSchemas"
        :paperRefs="paperRefs"
        :sidebarOpen="sidebarOpen"
        :onEdit="onEdit"
        @paperRef="onPaperRef"
      />
    </div>
  </Root>
</template>
