<script setup lang="ts">
import { ref, inject, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import type { SchemaForUI, Size, ChangeSchemas, BasePdf } from '@pdfme/common';
import { ZOOM, isBlankPdf, replacePlaceholders } from '@pdfme/common';
import { Button } from 'ant-design-vue';
import { X } from 'lucide-vue-next';
import { PluginsRegistryKey } from '../../../composables/injection-keys';
import { RULER_HEIGHT, RIGHT_SIDEBAR_WIDTH, DESIGNER_CLASSNAME } from '../../../constants';
import { round, flatten, uuid } from '../../../helper';
import Paper from '../../Paper.vue';
import Renderer from '../../Renderer.vue';
import SelectoWrapper from './SelectoWrapper.vue';
import MoveableWrapper from './MoveableWrapper.vue';
import Guides from './Guides.vue';
import Mask from './Mask.vue';
import Padding from './Padding.vue';
import StaticSchema from '../../StaticSchema.vue';

const mm2px = (mm: number) => mm * 3.7795275591;
const DELETE_BTN_ID = uuid();
const fmt4Num = (prop: string) => Number(prop.replace('px', ''));
const fmt = (prop: string) => round(fmt4Num(prop) / ZOOM, 2);
const isTopLeftResize = (d: string) => d === '-1,-1' || d === '-1,0' || d === '0,-1';
const normalizeRotate = (angle: number) => ((angle % 360) + 360) % 360;

const props = defineProps<{
  basePdf: BasePdf;
  height: number;
  hoveringSchemaId: string | null;
  onChangeHoveringSchemaId: (id: string | null) => void;
  pageCursor: number;
  schemasList: SchemaForUI[][];
  scale: number;
  backgrounds: string[];
  pageSizes: Size[];
  size: Size;
  activeElements: HTMLElement[];
  onEdit: (targets: HTMLElement[]) => void;
  changeSchemas: ChangeSchemas;
  removeSchemas: (ids: string[]) => void;
  paperRefs: HTMLDivElement[];
  sidebarOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'paperRef', index: number, el: HTMLDivElement): void;
}>();

const pluginsRegistry = inject(PluginsRegistryKey)!;
const canvasRef = ref<HTMLDivElement>();
const moveableRef = ref<InstanceType<typeof MoveableWrapper>>();

const isPressShiftKey = ref(false);
const editing = ref(false);
const isDragging = ref(false);

// --- Keyboard ---
const onKeydown = (e: KeyboardEvent) => {
  if (e.shiftKey) isPressShiftKey.value = true;
};
const onKeyup = (e: KeyboardEvent) => {
  if (e.key === 'Shift' || !e.shiftKey) isPressShiftKey.value = false;
  if (e.key === 'Escape' || e.key === 'Esc') editing.value = false;
};

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('keyup', onKeyup);

  // Native click-to-select: elementsFromPoint handles scaled containers correctly
  const canvas = canvasRef.value;
  if (canvas) {
    canvas.addEventListener('mousedown', (e: MouseEvent) => {
      // Let Moveable handle its own controls
      if ((e.target as HTMLElement).closest('[class*="moveable"]')) return;

      const els = document.elementsFromPoint(e.clientX, e.clientY);
      const sel = els.find(el => el.classList.contains('selectable')) as HTMLElement | undefined;

      if (sel?.id) {
        const alreadySelected = props.activeElements.some(ae => ae.id === sel.id);
        if (e.shiftKey) {
          // Shift: toggle
          if (alreadySelected) {
            props.onEdit(props.activeElements.filter(ae => ae.id !== sel.id));
          } else {
            props.onEdit([...props.activeElements, sel]);
          }
          editing.value = false;
        } else if (!alreadySelected) {
          props.onEdit([sel]);
          editing.value = false;
        }
        // Already selected + no shift: let Moveable handle drag
      } else if (props.activeElements.length > 0) {
        // Clicked empty area: deselect
        props.onEdit([]);
      }
    }, false);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('keyup', onKeyup);
});

// Update Moveable rect when schemas or page change
watch(
  () => [props.pageCursor, props.schemasList],
  () => { nextTick(() => moveableRef.value?.updateRect()); },
  { deep: true },
);
watch(
  () => props.activeElements,
  () => { nextTick(() => moveableRef.value?.updateRect()); },
);

// --- Moveable handlers ---
const onDrag = ({ target, top, left }: any) => {
  isDragging.value = true;
  const { width: _width, height: _height } = target.style;
  const targetWidth = fmt(_width);
  const targetHeight = fmt(_height);
  const actualTop = top / ZOOM;
  const actualLeft = left / ZOOM;
  const { width: pageWidth, height: pageHeight } = props.pageSizes[props.pageCursor];
  let topPad = 0, rightPad = 0, bottomPad = 0, leftPad = 0;
  if (isBlankPdf(props.basePdf)) {
    [topPad, rightPad, bottomPad, leftPad] = props.basePdf.padding;
    topPad *= ZOOM; leftPad *= ZOOM;
  }
  if (actualTop + targetHeight > pageHeight - bottomPad) {
    target.style.top = `${(pageHeight - targetHeight - bottomPad) * ZOOM}px`;
  } else {
    target.style.top = `${top < topPad ? topPad : top}px`;
  }
  if (actualLeft + targetWidth > pageWidth - rightPad) {
    target.style.left = `${(pageWidth - targetWidth - rightPad) * ZOOM}px`;
  } else {
    target.style.left = `${left < leftPad ? leftPad : left}px`;
  }
};

const onDragEnd = ({ target }: { target: HTMLElement | SVGElement }) => {
  isDragging.value = false;
  const { top, left } = (target as HTMLElement).style;
  props.changeSchemas([
    { key: 'position.y', value: fmt(top), schemaId: target.id },
    { key: 'position.x', value: fmt(left), schemaId: target.id },
  ]);
};

const onDragEnds = ({ targets }: { targets: (HTMLElement | SVGElement)[] }) => {
  isDragging.value = false;
  const arg = targets.map(({ style: { top, left }, id }) => [
    { key: 'position.y', value: fmt(top), schemaId: id },
    { key: 'position.x', value: fmt(left), schemaId: id },
  ]);
  props.changeSchemas(flatten(arg));
};

const onRotate = ({ target, rotate }: any) => {
  target.style.transform = `rotate(${rotate}deg)`;
};
const onRotateEnd = ({ target }: { target: HTMLElement | SVGElement }) => {
  const rotate = Number((target as HTMLElement).style.transform.replace('rotate(', '').replace('deg)', ''));
  props.changeSchemas([{ key: 'rotate', value: normalizeRotate(rotate), schemaId: target.id }]);
};
const onRotateEnds = ({ targets }: { targets: (HTMLElement | SVGElement)[] }) => {
  const arg = targets.map(({ style: { transform }, id }) => {
    const rotate = Number(transform.replace('rotate(', '').replace('deg)', ''));
    return [{ key: 'rotate', value: normalizeRotate(rotate), schemaId: id }];
  });
  props.changeSchemas(flatten(arg));
};

const onResize = ({ target, width, height, direction }: any) => {
  if (!target) return;
  let topPad = 0, rightPad = 0, bottomPad = 0, leftPad = 0;
  if (isBlankPdf(props.basePdf)) {
    [topPad, rightPad, bottomPad, leftPad] = props.basePdf.padding;
    topPad *= ZOOM; rightPad = mm2px(rightPad); bottomPad = mm2px(bottomPad); leftPad *= ZOOM;
  }
  const pageWidth = mm2px(props.pageSizes[props.pageCursor].width);
  const pageHeight = mm2px(props.pageSizes[props.pageCursor].height);
  const obj: Record<string, string> = { width: `${width}px`, height: `${height}px` };
  const s = target.style;
  let newLeft = fmt4Num(s.left) + (fmt4Num(s.width) - width);
  let newTop = fmt4Num(s.top) + (fmt4Num(s.height) - height);
  if (newLeft < leftPad) newLeft = leftPad;
  if (newTop < topPad) newTop = topPad;
  if (newLeft + width > pageWidth - rightPad) obj.width = `${pageWidth - rightPad - newLeft}px`;
  if (newTop + height > pageHeight - bottomPad) obj.height = `${pageHeight - bottomPad - newTop}px`;
  const d = direction.toString();
  if (isTopLeftResize(d)) { obj.top = `${newTop}px`; obj.left = `${newLeft}px`; }
  else if (d === '1,-1') { obj.top = `${newTop}px`; }
  else if (d === '-1,1') { obj.left = `${newLeft}px`; }
  Object.assign(s, obj);
};
const onResizeEnd = ({ target }: { target: HTMLElement | SVGElement }) => {
  const { id, style } = target as HTMLElement;
  props.changeSchemas([
    { key: 'position.x', value: fmt(style.left), schemaId: id },
    { key: 'position.y', value: fmt(style.top), schemaId: id },
    { key: 'width', value: fmt(style.width), schemaId: id },
    { key: 'height', value: fmt(style.height), schemaId: id },
  ]);
};
const onResizeEnds = ({ targets }: { targets: (HTMLElement | SVGElement)[] }) => {
  const arg = targets.map(({ style: { width, height, top, left }, id }) => [
    { key: 'width', value: fmt(width), schemaId: id },
    { key: 'height', value: fmt(height), schemaId: id },
    { key: 'position.y', value: fmt(top), schemaId: id },
    { key: 'position.x', value: fmt(left), schemaId: id },
  ]);
  props.changeSchemas(flatten(arg));
};

// --- Computed ---
const rotatable = computed(() => {
  const selectedSchemas = (props.schemasList[props.pageCursor] || []).filter((s) =>
    props.activeElements.map((ae) => ae.id).includes(s.id),
  );
  const schemaTypes = [...new Set(selectedSchemas.map((s) => s.type))];
  const defaultSchemas: Record<string, unknown>[] = [];
  pluginsRegistry.entries().forEach(([, plugin]) => {
    if (plugin.propPanel.defaultSchema) defaultSchemas.push(plugin.propPanel.defaultSchema as Record<string, unknown>);
  });
  return schemaTypes.every((type) => {
    const ds = defaultSchemas.find((d) => d && 'type' in d && d.type === type);
    return ds && 'rotate' in ds;
  });
});

const showMoveable = computed(() => props.activeElements.length > 0 && !editing.value);
const showDeleteButton = computed(() => props.activeElements.length > 0 && !editing.value && !isDragging.value);

const getSchemaMode = (schema: SchemaForUI) =>
  editing.value && props.activeElements.some(ae => ae.id === schema.id) ? 'designer' as const : 'viewer' as const;

const getSchemaValue = (schema: SchemaForUI, index: number) => {
  const content = schema.content || '';
  if (getSchemaMode(schema) !== 'designer' && schema.readOnly) {
    return replacePlaceholders({
      content,
      variables: {
        ...props.schemasList.flat().reduce((acc, s) => { acc[s.name] = s.content || ''; return acc; }, {} as Record<string, string>),
        totalPages: props.schemasList.length,
        currentPage: index + 1,
      },
      schemas: props.schemasList,
    });
  }
  return content;
};

const getSchemaOutline = (schema: SchemaForUI) =>
  `1px ${props.hoveringSchemaId === schema.id ? 'solid' : 'dashed'} ${
    schema.readOnly && props.hoveringSchemaId !== schema.id ? 'transparent' : 'var(--ant-color-primary, #38a0ff)'
  }`;

const deleteButtonTop = computed(() =>
  props.activeElements.length ? Math.min(...props.activeElements.map(({ style }) => fmt4Num(style.top))) : 0,
);
const deleteButtonLeft = computed(() =>
  props.activeElements.length ? Math.max(...props.activeElements.map(({ style }) => fmt4Num(style.left) + fmt4Num(style.width))) + 10 : 0,
);

const onPaperRef = (index: number, el: HTMLDivElement) => emit('paperRef', index, el);

defineExpose({ canvasRef });
</script>

<template>
  <div
    ref="canvasRef"
    :class="DESIGNER_CLASSNAME + 'canvas'"
    :style="{
      position: 'relative',
      overflow: 'auto',
      marginRight: sidebarOpen ? RIGHT_SIDEBAR_WIDTH + 'px' : '0px',
      width: size.width + 'px',
      height: size.height + 'px',
    }"
  >
    <Paper
      :scale="scale"
      :size="size"
      :schemasList="schemasList"
      :pageSizes="pageSizes"
      :backgrounds="backgrounds"
      :hasRulers="true"
      @paperRef="onPaperRef"
    >
      <template #paper="{ index, paperSize }">
        <Button
          v-if="showDeleteButton && pageCursor === index"
          :id="DELETE_BTN_ID"
          :class="DESIGNER_CLASSNAME + 'delete-button'"
          :style="{
            position: 'absolute', zIndex: 1,
            top: deleteButtonTop + 'px', left: deleteButtonLeft + 'px',
            width: '26px', height: '26px', padding: '2px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '4px', color: '#fff',
            background: 'var(--ant-color-primary, #38a0ff)',
          }"
          @click="removeSchemas(activeElements.map(ae => ae.id))"
        >
          <X :style="{ pointerEvents: 'none' }" />
        </Button>

        <Padding :basePdf="basePdf" />
        <StaticSchema
          :template="{ schemas: schemasList, basePdf }"
          :input="Object.fromEntries(schemasList.flat().map(({ name, content = '' }) => [name, content]))"
          :scale="scale" :totalPages="schemasList.length" :currentPage="index + 1"
        />
        <Guides :paperSize="paperSize" />

        <Mask v-if="pageCursor !== index" :width="paperSize.width + RULER_HEIGHT" :height="paperSize.height + RULER_HEIGHT" />

        <MoveableWrapper
          v-if="pageCursor === index && showMoveable"
          ref="moveableRef"
          :target="activeElements"
          :bounds="{ left: 0, top: 0, bottom: paperSize.height, right: paperSize.width }"
          :horizontalGuidelines="[]" :verticalGuidelines="[]"
          :keepRatio="isPressShiftKey" :rotatable="rotatable"
          :onDrag="onDrag" :onDragEnd="onDragEnd" :onDragGroupEnd="onDragEnds"
          :onRotate="onRotate" :onRotateEnd="onRotateEnd" :onRotateGroupEnd="onRotateEnds"
          :onResize="onResize" :onResizeEnd="onResizeEnd" :onResizeGroupEnd="onResizeEnds"
          :onClick="() => { editing = true; }"
        />
      </template>

      <template #schema="{ schema, index }">
        <Renderer
          :key="schema.id" :schema="schema" :basePdf="basePdf"
          :value="getSchemaValue(schema, index)"
          :onChangeHoveringSchemaId="onChangeHoveringSchemaId"
          :mode="getSchemaMode(schema)"
          :onChange="(schemasList[pageCursor] || []).some((s: SchemaForUI) => s.id === schema.id)
            ? (arg: any) => {
                const args = Array.isArray(arg) ? arg : [arg];
                changeSchemas(args.map(({ key, value }: any) => ({ key, value, schemaId: schema.id })));
              }
            : undefined"
          :stopEditing="() => { editing = false; }"
          :outline="getSchemaOutline(schema)" :scale="scale"
        />
      </template>
    </Paper>
  </div>
</template>
