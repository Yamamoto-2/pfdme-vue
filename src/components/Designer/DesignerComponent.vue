<script setup lang="ts">
/**
 * Two-Layer Designer:
 *  Bottom: Paper + Renderer (real pdfme plugin DOM rendering)
 *  Top:    KonvaOverlay (transparent interaction layer)
 */
import { ref, inject, watch, onMounted, computed } from 'vue';
import type { Template, Schema, SchemaForUI, Size } from '@pdfme/common';
import { cloneDeep as _rawCloneDeep, ZOOM, isBlankPdf, replacePlaceholders } from '@pdfme/common';
import { I18nKey, OptionsKey, PluginsRegistryKey } from '../../composables/injection-keys';
import {
  schemasList2template, uuid, template2SchemasList, getPagesScrollTopByIndex,
  changeSchemas as _changeSchemas, initShortCuts, destroyShortCuts,
  moveCommandToChangeSchemasArg, getUniqueSchemaName,
} from '../../helper';
import { useMaxZoom } from '../../composables/useMaxZoom';
import { useUIPreProcessor } from '../../composables/useUIPreProcessor';
import { RULER_HEIGHT, RIGHT_SIDEBAR_WIDTH, LEFT_SIDEBAR_WIDTH, PAGE_GAP } from '../../constants';
import Root from '../Root.vue';
import ErrorScreen from '../ErrorScreen.vue';
import CtlBar from '../CtlBar.vue';
import Paper from '../Paper.vue';
import Renderer from '../Renderer.vue';
import StaticSchema from '../StaticSchema.vue';
import LeftSidebar from './LeftSidebar.vue';
import RightSidebar from './RightSidebar/RightSidebar.vue';
import KonvaOverlay from './KonvaEditor/KonvaOverlay.vue';

const cloneDeep = <T>(o: T): T => { try { return _rawCloneDeep(o); } catch { return JSON.parse(JSON.stringify(o)); } };

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

// --- State ---
const past = ref<SchemaForUI[][]>([]);
const future = ref<SchemaForUI[][]>([]);
const hoveringSchemaId = ref<string | null>(null);
const activeSchemaIds = ref<string[]>([]);
const editingSchemaId = ref<string | null>(null);
const schemasList = ref<SchemaForUI[][]>([[]]);
const pageCursor = ref(0);
const zoomLevel = ref(options.zoomLevel ?? 1);
const sidebarOpen = ref(options.sidebarOpen ?? true);
const prevTemplate = ref<Template | null>(null);
const paperRefs = ref<HTMLDivElement[]>([]);

const canvasAreaWidth = computed(() =>
  props.size.width - LEFT_SIDEBAR_WIDTH - (sidebarOpen.value ? RIGHT_SIDEBAR_WIDTH : 0),
);

const { backgrounds, pageSizes, scale: scaleFn, error, refresh } = useUIPreProcessor({
  template: () => props.template,
  size: () => ({ width: canvasAreaWidth.value, height: props.size.height }),
  zoomLevel: () => zoomLevel.value,
  maxZoom: () => maxZoom,
});

const scale = computed(() => scaleFn());
const currentPageSize = computed(() => pageSizes.value[pageCursor.value] ?? { width: 210, height: 297 });
const currentSchemas = computed(() => schemasList.value[pageCursor.value] ?? []);

// Overlay dimensions (actual pixel size of the Konva canvas)
const overlayWidth = computed(() => currentPageSize.value.width * ZOOM * scale.value);
const overlayHeight = computed(() => currentPageSize.value.height * ZOOM * scale.value);

// Sidebar compatibility: fake HTMLElement[] with .id
const activeElements = computed(() =>
  activeSchemaIds.value.map(id => ({ id })) as unknown as HTMLElement[],
);

// --- Schema operations ---
const commitSchemas = (newSchemas: SchemaForUI[]) => {
  future.value = [];
  past.value.push(cloneDeep(schemasList.value[pageCursor.value]));
  const _sl = cloneDeep(schemasList.value);
  _sl[pageCursor.value] = newSchemas;
  schemasList.value = _sl;
  props.onChangeTemplate(schemasList2template(_sl, props.template.basePdf));
};

const removeSchemas = (ids: string[]) => {
  commitSchemas(schemasList.value[pageCursor.value].filter(s => !ids.includes(s.id)));
  activeSchemaIds.value = [];
};

const changeSchemas = (objs: { key: string; value: unknown; schemaId: string }[]) => {
  _changeSchemas({
    objs,
    schemas: schemasList.value[pageCursor.value],
    basePdf: props.template.basePdf,
    pluginsRegistry,
    pageSize: pageSizes.value[pageCursor.value],
    commitSchemas,
  });
};

// --- Keyboard shortcuts ---
let copiedSchemas: SchemaForUI[] | null = null;
const getActiveSchemas = () => schemasList.value[pageCursor.value].filter(s => activeSchemaIds.value.includes(s.id));

const setupShortcuts = () => {
  destroyShortCuts();
  const timeTravel = (mode: 'undo' | 'redo') => {
    const isUndo = mode === 'undo';
    const stack = isUndo ? past : future;
    if (stack.value.length <= 0) return;
    (isUndo ? future : past).value.push(cloneDeep(schemasList.value[pageCursor.value]));
    const s = cloneDeep(schemasList.value);
    s[pageCursor.value] = stack.value.pop()!;
    schemasList.value = s;
    props.onChangeTemplate(schemasList2template(s, props.template.basePdf));
  };
  initShortCuts({
    move: (cmd, shift) => {
      const as = getActiveSchemas();
      if (!as.length) return;
      changeSchemas(moveCommandToChangeSchemasArg({ command: cmd, activeSchemas: as, pageSize: pageSizes.value[pageCursor.value], isShift: shift }));
    },
    copy: () => { const as = getActiveSchemas(); if (as.length) copiedSchemas = as; },
    paste: () => {
      if (!copiedSchemas?.length) return;
      const schema = schemasList.value[pageCursor.value];
      const stack: string[] = [];
      const pasted = copiedSchemas.map(cs => {
        const id = uuid();
        const name = getUniqueSchemaName({ copiedSchemaName: cs.name, schema, stackUniqueSchemaNames: stack });
        const ps = pageSizes.value[pageCursor.value];
        return Object.assign(cloneDeep(cs), { id, name, position: {
          x: Math.min(cs.position.x + 10, ps.width - cs.width),
          y: Math.min(cs.position.y + 10, ps.height - cs.height),
        }});
      });
      commitSchemas(schema.concat(pasted));
      activeSchemaIds.value = pasted.map(s => s.id);
      copiedSchemas = pasted;
    },
    redo: () => timeTravel('redo'),
    undo: () => timeTravel('undo'),
    save: () => props.onSaveTemplate(schemasList2template(schemasList.value, props.template.basePdf)),
    remove: () => removeSchemas(getActiveSchemas().map(s => s.id)),
    esc: () => { activeSchemaIds.value = []; },
    selectAll: () => { activeSchemaIds.value = schemasList.value[pageCursor.value].map(s => s.id); },
  });
};
watch([activeSchemaIds, pageCursor, schemasList, pageSizes], setupShortcuts, { deep: true });
onMounted(setupShortcuts);

// --- Template sync ---
const updateTemplate = async (t: Template) => {
  schemasList.value = await template2SchemasList(t);
  activeSchemaIds.value = [];
  pageCursor.value = 0;
};
watch(() => props.template, (t) => {
  if (prevTemplate.value !== t) { prevTemplate.value = t; void updateTemplate(t); }
}, { immediate: true });

// --- Add schema ---
const addSchema = (defaultSchema: Schema) => {
  const [pt, pr, pb, pl] = isBlankPdf(props.template.basePdf) ? props.template.basePdf.padding : [0, 0, 0, 0];
  const ps = pageSizes.value[pageCursor.value];
  let idx = schemasList.value.reduce((a, p) => a + p.length, 1);
  let name = i18n('field') + idx;
  while (schemasList.value.some(p => p.find(s => s.name === name))) { idx++; name = i18n('field') + idx; }
  const mid = (min: number, v: number, max: number) => Math.min(Math.max(min, v), max);
  const s = {
    id: uuid(), ...defaultSchema, name,
    position: { x: mid(pl, defaultSchema.position.x, ps.width - pr - defaultSchema.width), y: mid(pt, defaultSchema.position.y, ps.height - pb - defaultSchema.height) },
    required: defaultSchema.readOnly ? false : options.requiredByDefault || defaultSchema.required || false,
  } as SchemaForUI;
  commitSchemas(schemasList.value[pageCursor.value].concat(s));
  activeSchemaIds.value = [s.id];
};

// Page management
const addPage = () => { const sl = cloneDeep(schemasList.value); sl.splice(pageCursor.value + 1, 0, []); schemasList.value = sl; pageCursor.value++; props.onChangeTemplate(schemasList2template(sl, props.template.basePdf)); void refresh(schemasList2template(sl, props.template.basePdf)); };
const removePage = () => { if (pageCursor.value === 0 || !window.confirm(i18n('removePageConfirm'))) return; const sl = cloneDeep(schemasList.value); sl.splice(pageCursor.value, 1); schemasList.value = sl; pageCursor.value--; props.onChangeTemplate(schemasList2template(sl, props.template.basePdf)); void refresh(schemasList2template(sl, props.template.basePdf)); };

// DnD from sidebar
const onDrop = (e: DragEvent) => {
  e.preventDefault();
  const data = e.dataTransfer?.getData('application/json');
  if (!data) return;
  try {
    const ds = JSON.parse(data) as Schema;
    const rect = containerRef.value?.querySelector('canvas')?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.round(((e.clientX - rect.left) / scale.value / ZOOM) * 100) / 100);
    const y = Math.max(0, Math.round(((e.clientY - rect.top) / scale.value / ZOOM) * 100) / 100);
    addSchema({ ...ds, position: { x, y } });
  } catch { /* ignore */ }
};

// Renderer value
const getSchemaValue = (schema: SchemaForUI, index: number) => {
  if (schema.readOnly) {
    return replacePlaceholders({
      content: schema.content || '',
      variables: { ...schemasList.value.flat().reduce((a, s) => { a[s.name] = s.content || ''; return a; }, {} as Record<string, string>), totalPages: schemasList.value.length, currentPage: index + 1 },
      schemas: schemasList.value,
    });
  }
  return schema.content || '';
};

const containerRef = ref<HTMLDivElement>();
const onPaperRef = (_i: number, el: HTMLDivElement) => { paperRefs.value[_i] = el; };
const pageManip = computed(() => isBlankPdf(props.template.basePdf) ? { addPageAfter: addPage, removePage } : {});

// --- Content edit modal ---
const contentEditText = ref('');
const showContentModal = ref(false);
const contentEditSchemaId = ref<string | null>(null);

const openContentEditor = (schemaId: string) => {
  const schema = currentSchemas.value.find(s => s.id === schemaId);
  if (!schema || schema.readOnly) return;
  contentEditSchemaId.value = schemaId;
  contentEditText.value = schema.content || '';
  showContentModal.value = true;
};

const saveContent = () => {
  if (contentEditSchemaId.value) {
    changeSchemas([{ key: 'content', value: contentEditText.value, schemaId: contentEditSchemaId.value }]);
  }
  showContentModal.value = false;
  editingSchemaId.value = null;
  contentEditSchemaId.value = null;
};

const cancelContent = () => {
  showContentModal.value = false;
  editingSchemaId.value = null;
  contentEditSchemaId.value = null;
};

const onKonvaEditSchema = (id: string | null) => {
  editingSchemaId.value = id;
  if (id) openContentEditor(id);
};
</script>

<template>
  <ErrorScreen v-if="error" :size="size" :error="error" />
  <Root v-else :size="size" :scale="scale">
    <LeftSidebar :height="size.height" :scale="scale" :basePdf="template.basePdf" :onAddSchema="addSchema" />

    <div
      ref="containerRef"
      :style="{ position: 'absolute', width: (size.width - LEFT_SIDEBAR_WIDTH) + 'px', marginLeft: LEFT_SIDEBAR_WIDTH + 'px', height: size.height + 'px' }"
      @drop="onDrop" @dragover.prevent
    >
      <CtlBar
        :size="{ width: canvasAreaWidth, height: size.height }"
        :pageCursor="pageCursor" :pageNum="schemasList.length"
        :setPageCursor="(p: number) => { pageCursor = p; onPageCursorChange(p, schemasList.length); activeSchemaIds = []; }"
        :zoomLevel="zoomLevel" :setZoomLevel="(z: number) => { zoomLevel = z; }"
        v-bind="pageManip"
      />

      <RightSidebar
        :hoveringSchemaId="hoveringSchemaId"
        :onChangeHoveringSchemaId="(id: string | null) => { hoveringSchemaId = id; }"
        :height="size.height" :size="size"
        :pageSize="currentPageSize" :basePdf="template.basePdf"
        :activeElements="activeElements"
        :schemasList="schemasList" :schemas="currentSchemas"
        :changeSchemas="changeSchemas"
        :onSortEnd="(sorted: SchemaForUI[]) => commitSchemas(sorted)"
        :onEdit="(id: string) => { activeSchemaIds = [id]; }"
        :onEditEnd="() => { activeSchemaIds = []; }"
        :deselectSchema="() => { activeSchemaIds = []; }"
        :sidebarOpen="sidebarOpen"
        :setSidebarOpen="(o: boolean) => { sidebarOpen = o; }"
      />

      <!-- Canvas area: pdfme rendering + Konva overlay stacked -->
      <div :style="{
        marginRight: sidebarOpen ? RIGHT_SIDEBAR_WIDTH + 'px' : 0,
        height: size.height + 'px',
        overflow: 'auto',
        background: '#4a4a4a',
      }">
        <!-- Wrapper to center and position both layers -->
        <div :style="{
          position: 'relative',
          display: 'inline-block',
          margin: (RULER_HEIGHT + PAGE_GAP) + 'px auto',
          marginLeft: Math.max(RULER_HEIGHT, (canvasAreaWidth - overlayWidth) / 2) + 'px',
        }">
          <!-- Layer 1: pdfme DOM rendering (bottom) -->
          <div :style="{ transform: `scale(${scale})`, transformOrigin: 'top left', width: (currentPageSize.width * ZOOM) + 'px', height: (currentPageSize.height * ZOOM) + 'px' }">
            <div :style="{
              width: (currentPageSize.width * ZOOM) + 'px',
              height: (currentPageSize.height * ZOOM) + 'px',
              background: '#fff',
              position: 'relative',
              backgroundImage: backgrounds[pageCursor] ? `url(${backgrounds[pageCursor]})` : 'none',
              backgroundSize: `${currentPageSize.width * ZOOM}px ${currentPageSize.height * ZOOM}px`,
              fontFamily: 'Roboto, sans-serif',
            }">
              <StaticSchema
                :template="{ schemas: schemasList, basePdf: template.basePdf }"
                :input="Object.fromEntries(schemasList.flat().map(({ name, content = '' }) => [name, content]))"
                :scale="scale" :totalPages="schemasList.length" :currentPage="pageCursor + 1"
              />
              <!-- Padding overlay -->
              <template v-if="isBlankPdf(template.basePdf)">
                <div v-for="(p, i) in template.basePdf.padding" :key="i" :style="{
                  position: 'absolute', background: 'rgba(255, 77, 79, 0.15)', pointerEvents: 'none',
                  ...(i === 0 ? { top: 0, left: 0, right: 0, height: p * ZOOM + 'px' } :
                      i === 1 ? { top: 0, right: 0, bottom: 0, width: p * ZOOM + 'px' } :
                      i === 2 ? { bottom: 0, left: 0, right: 0, height: p * ZOOM + 'px' } :
                               { top: 0, left: 0, bottom: 0, width: p * ZOOM + 'px' }),
                }" />
              </template>
              <!-- Schema renderers (hidden when being edited in Konva) -->
              <Renderer
                v-for="(schema, idx) in currentSchemas"
                :key="schema.id"
                :schema="schema" :basePdf="template.basePdf"
                :value="getSchemaValue(schema, idx)"
                mode="viewer" :scale="scale"
                :outline="editingSchemaId === schema.id ? 'none' : `1px dashed ${hoveringSchemaId === schema.id ? '#38a0ff' : (schema.readOnly ? 'transparent' : 'rgba(56,160,255,0.4)')}`"
                :style="{ visibility: editingSchemaId === schema.id ? 'hidden' : 'visible' }"
                :noSelect="true"
              />
            </div>
          </div>

          <!-- Layer 2: Konva overlay (top) -->
          <KonvaOverlay
            :schemas="currentSchemas"
            :pageSize="currentPageSize"
            :basePdf="template.basePdf"
            :scale="scale"
            :activeSchemaIds="activeSchemaIds"
            :hoveringSchemaId="hoveringSchemaId"
            :editingSchemaId="editingSchemaId"
            :width="overlayWidth"
            :height="overlayHeight"
            @select="(ids: string[]) => { activeSchemaIds = ids; }"
            @deselect="activeSchemaIds = []"
            @changeSchemas="changeSchemas"
            @hoverSchema="(id: string | null) => { hoveringSchemaId = id; }"
            @editingSchema="onKonvaEditSchema"
          />
        </div>
      </div>
    </div>

    <!-- Content Edit Modal -->
    <div
      v-if="showContentModal"
      :style="{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
      }"
      @click.self="cancelContent"
    >
      <div :style="{
        background: '#fff', borderRadius: '8px', padding: '20px',
        width: '500px', maxHeight: '60vh', display: 'flex', flexDirection: 'column', gap: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }">
        <div :style="{ fontWeight: 700, fontSize: '16px' }">Edit Content</div>
        <textarea
          v-model="contentEditText"
          :style="{
            width: '100%', minHeight: '200px', padding: '10px',
            border: '1px solid #d9d9d9', borderRadius: '4px',
            fontSize: '14px', fontFamily: 'monospace', resize: 'vertical',
            outline: 'none',
          }"
          @focus="($event.target as HTMLTextAreaElement).style.borderColor = '#38a0ff'"
          @blur="($event.target as HTMLTextAreaElement).style.borderColor = '#d9d9d9'"
          @keydown.ctrl.enter="saveContent"
          @keydown.meta.enter="saveContent"
        />
        <div :style="{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }">
          <span :style="{ fontSize: '12px', color: '#999' }">Ctrl+Enter to save</span>
          <div :style="{ display: 'flex', gap: '8px' }">
            <button
              :style="{ padding: '6px 16px', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: 'pointer', background: '#fff' }"
              @click="cancelContent"
            >Cancel</button>
            <button
              :style="{ padding: '6px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: '#38a0ff', color: '#fff', fontWeight: 600 }"
              @click="saveContent"
            >Save</button>
          </div>
        </div>
      </div>
    </div>
  </Root>
</template>
