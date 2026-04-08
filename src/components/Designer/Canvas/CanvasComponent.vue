<script setup lang="ts">
import { ref, inject, computed, onMounted, onBeforeUnmount, watch } from 'vue';
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
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('keyup', onKeyup);
});

watch(
  () => [props.pageCursor, props.schemasList],
  () => { moveableRef.value?.updateRect(); },
  { deep: true },
);

const onDrag = ({ target, top, left }: any) => {
  const { width: _width, height: _height } = target.style;
  const targetWidth = fmt(_width);
  const targetHeight = fmt(_height);
  const actualTop = top / ZOOM;
  const actualLeft = left / ZOOM;
  const { width: pageWidth, height: pageHeight } = props.pageSizes[props.pageCursor];
  let topPadding = 0, rightPadding = 0, bottomPadding = 0, leftPadding = 0;
  if (isBlankPdf(props.basePdf)) {
    const [t, r, b, l] = props.basePdf.padding;
    topPadding = t * ZOOM; rightPadding = r; bottomPadding = b; leftPadding = l * ZOOM;
  }
  if (actualTop + targetHeight > pageHeight - bottomPadding) {
    target.style.top = `${(pageHeight - targetHeight - bottomPadding) * ZOOM}px`;
  } else {
    target.style.top = `${top < topPadding ? topPadding : top}px`;
  }
  if (actualLeft + targetWidth > pageWidth - rightPadding) {
    target.style.left = `${(pageWidth - targetWidth - rightPadding) * ZOOM}px`;
  } else {
    target.style.left = `${left < leftPadding ? leftPadding : left}px`;
  }
};

const onDragEnd = ({ target }: { target: HTMLElement | SVGElement }) => {
  const { top, left } = (target as HTMLElement).style;
  props.changeSchemas([
    { key: 'position.y', value: fmt(top), schemaId: target.id },
    { key: 'position.x', value: fmt(left), schemaId: target.id },
  ]);
};

const onDragEnds = ({ targets }: { targets: (HTMLElement | SVGElement)[] }) => {
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
  const { transform } = (target as HTMLElement).style;
  const rotate = Number(transform.replace('rotate(', '').replace('deg)', ''));
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
  let topPadding = 0, rightPadding = 0, bottomPadding = 0, leftPadding = 0;
  if (isBlankPdf(props.basePdf)) {
    const [t, r, b, l] = props.basePdf.padding;
    topPadding = t * ZOOM; rightPadding = mm2px(r); bottomPadding = mm2px(b); leftPadding = l * ZOOM;
  }
  const pageWidth = mm2px(props.pageSizes[props.pageCursor].width);
  const pageHeight = mm2px(props.pageSizes[props.pageCursor].height);
  const obj: Record<string, string> = { width: `${width}px`, height: `${height}px` };
  const s = target.style;
  let newLeft = fmt4Num(s.left) + (fmt4Num(s.width) - width);
  let newTop = fmt4Num(s.top) + (fmt4Num(s.height) - height);
  if (newLeft < leftPadding) newLeft = leftPadding;
  if (newTop < topPadding) newTop = topPadding;
  if (newLeft + width > pageWidth - rightPadding) obj.width = `${pageWidth - rightPadding - newLeft}px`;
  if (newTop + height > pageHeight - bottomPadding) obj.height = `${pageHeight - bottomPadding - newTop}px`;
  const d = direction.toString();
  if (isTopLeftResize(d)) { obj.top = `${newTop}px`; obj.left = `${newLeft}px`; }
  else if (d === '1,-1') { obj.top = `${newTop}px`; }
  else if (d === '-1,1') { obj.left = `${newLeft}px`; }
  Object.assign(s, obj);
};

const onResizeEnd = ({ target }: { target: HTMLElement | SVGElement }) => {
  const { id, style } = target as HTMLElement;
  const { width, height, top, left } = style;
  props.changeSchemas([
    { key: 'position.x', value: fmt(left), schemaId: id },
    { key: 'position.y', value: fmt(top), schemaId: id },
    { key: 'width', value: fmt(width), schemaId: id },
    { key: 'height', value: fmt(height), schemaId: id },
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

const getSchemaMode = (schema: SchemaForUI) => {
  return editing.value && props.activeElements.map((ae) => ae.id).includes(schema.id)
    ? 'designer' as const
    : 'viewer' as const;
};

const getSchemaValue = (schema: SchemaForUI, index: number) => {
  const content = schema.content || '';
  const mode = getSchemaMode(schema);
  if (mode !== 'designer' && schema.readOnly) {
    const variables = {
      ...props.schemasList.flat().reduce((acc, s) => { acc[s.name] = s.content || ''; return acc; }, {} as Record<string, string>),
      totalPages: props.schemasList.length,
      currentPage: index + 1,
    };
    return replacePlaceholders({ content, variables, schemas: props.schemasList });
  }
  return content;
};

const getSchemaOutline = (schema: SchemaForUI) => {
  return `1px ${props.hoveringSchemaId === schema.id ? 'solid' : 'dashed'} ${
    schema.readOnly && props.hoveringSchemaId !== schema.id
      ? 'transparent'
      : 'var(--ant-color-primary, #38a0ff)'
  }`;
};

const deleteButtonTop = computed(() => {
  return Math.min(...props.activeElements.map(({ style }) => fmt4Num(style.top)));
});

const deleteButtonLeft = computed(() => {
  return Math.max(...props.activeElements.map(({ style }) => fmt4Num(style.left) + fmt4Num(style.width))) + 10;
});

const onPaperRef = (index: number, el: HTMLDivElement) => {
  emit('paperRef', index, el);
};

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
    <SelectoWrapper
      :container="paperRefs[pageCursor] || null"
      :continueSelect="isPressShiftKey"
      :onDragStart="(e: any) => {
        const inputEvent = e.inputEvent as MouseEvent | TouchEvent;
        const target = inputEvent.target as Element | null;
        const isMoveableElement = moveableRef?.isMoveableElement(target as Element);
        if ((inputEvent.type === 'touchstart' && e.isTrusted) || isMoveableElement) e.stop();
        if (paperRefs[pageCursor] === target) onEdit([]);
        const targetEl = target as HTMLElement | null;
        if (targetEl && targetEl.id === DELETE_BTN_ID) removeSchemas(activeElements.map((ae) => ae.id));
      }"
      :onSelect="(e: any) => {
        const inputEvent = e.inputEvent as MouseEvent | TouchEvent;
        const isClick = inputEvent.type === 'mousedown';
        let newActiveElements: HTMLElement[] = isClick ? e.selected : [];
        if (!isClick && e.added.length > 0) newActiveElements = activeElements.concat(e.added);
        if (!isClick && e.removed.length > 0) newActiveElements = activeElements.filter((ae: HTMLElement) => !e.removed.includes(ae));
        onEdit(newActiveElements);
        if (newActiveElements !== activeElements) editing = false;
        const mouseEvent = inputEvent as MouseEvent;
        if (mouseEvent && typeof mouseEvent.shiftKey === 'boolean' && !mouseEvent.shiftKey) isPressShiftKey = false;
      }"
    />
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
        <!-- Delete Button -->
        <Button
          v-if="!editing && activeElements.length > 0 && pageCursor === index"
          :id="DELETE_BTN_ID"
          :class="DESIGNER_CLASSNAME + 'delete-button'"
          :style="{
            position: 'absolute',
            zIndex: 1,
            top: deleteButtonTop + 'px',
            left: deleteButtonLeft + 'px',
            width: '26px',
            height: '26px',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
            color: '#fff',
            background: 'var(--ant-color-primary, #38a0ff)',
          }"
        >
          <X :style="{ pointerEvents: 'none' }" />
        </Button>

        <Padding :basePdf="basePdf" />

        <StaticSchema
          :template="{ schemas: schemasList, basePdf }"
          :input="Object.fromEntries(schemasList.flat().map(({ name, content = '' }) => [name, content]))"
          :scale="scale"
          :totalPages="schemasList.length"
          :currentPage="index + 1"
        />

        <Guides :paperSize="paperSize" />

        <Mask
          v-if="pageCursor !== index"
          :width="paperSize.width + RULER_HEIGHT"
          :height="paperSize.height + RULER_HEIGHT"
        />

        <MoveableWrapper
          v-else-if="!editing"
          ref="moveableRef"
          :target="activeElements"
          :bounds="{ left: 0, top: 0, bottom: paperSize.height, right: paperSize.width }"
          :horizontalGuidelines="[]"
          :verticalGuidelines="[]"
          :keepRatio="isPressShiftKey"
          :rotatable="rotatable"
          :onDrag="onDrag"
          :onDragEnd="onDragEnd"
          :onDragGroupEnd="onDragEnds"
          :onRotate="onRotate"
          :onRotateEnd="onRotateEnd"
          :onRotateGroupEnd="onRotateEnds"
          :onResize="onResize"
          :onResizeEnd="onResizeEnd"
          :onResizeGroupEnd="onResizeEnds"
          :onClick="() => { editing = true; }"
        />
      </template>

      <template #schema="{ schema, index }">
        <Renderer
          :key="schema.id"
          :schema="schema"
          :basePdf="basePdf"
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
          :outline="getSchemaOutline(schema)"
          :scale="scale"
        />
      </template>
    </Paper>
  </div>
</template>
