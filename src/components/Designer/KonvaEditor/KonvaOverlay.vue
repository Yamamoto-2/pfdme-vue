<script setup lang="ts">
/**
 * KonvaOverlay: Transparent interaction layer on top of pdfme DOM rendering.
 *
 * - Draws transparent rectangles at each schema position (outlines only)
 * - Konva Transformer for drag/resize/rotate
 * - Text editing: when double-clicking a text schema, shows editable Konva.Text
 *   and emits 'hideSchema' so the pdfme layer hides that field
 * - All coordinates in canvas units (mm * ZOOM)
 */
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import Konva from 'konva';
import type { SchemaForUI, Size } from '@pdfme/common';
import { ZOOM, isBlankPdf } from '@pdfme/common';
import type { BasePdf } from '@pdfme/common';

const MM_TO_PX = ZOOM;

const props = defineProps<{
  schemas: SchemaForUI[];
  pageSize: Size;
  basePdf: BasePdf;
  scale: number;
  activeSchemaIds: string[];
  hoveringSchemaId: string | null;
  editingSchemaId: string | null;
  width: number;
  height: number;
}>();

const emit = defineEmits<{
  (e: 'select', ids: string[]): void;
  (e: 'deselect'): void;
  (e: 'changeSchemas', changes: { key: string; value: unknown; schemaId: string }[]): void;
  (e: 'hoverSchema', id: string | null): void;
  (e: 'editingSchema', id: string | null): void;  // tells parent to hide this schema in pdfme layer
}>();

const containerRef = ref<HTMLDivElement>();
let stage: Konva.Stage | null = null;
let layer: Konva.Layer | null = null;
let transformer: Konva.Transformer | null = null;
// editingSchemaId is managed by parent via prop

const pw = computed(() => props.pageSize.width * MM_TO_PX);
const ph = computed(() => props.pageSize.height * MM_TO_PX);

const initStage = () => {
  if (!containerRef.value) return;
  if (stage) stage.destroy();

  stage = new Konva.Stage({
    container: containerRef.value,
    width: props.width,
    height: props.height,
    scaleX: props.scale,
    scaleY: props.scale,
  });

  layer = new Konva.Layer();
  stage.add(layer);

  transformer = new Konva.Transformer({
    rotateEnabled: true,
    rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
    borderStroke: '#38a0ff',
    borderStrokeWidth: 1.5,
    anchorFill: '#38a0ff',
    anchorStroke: '#fff',
    anchorSize: 8,
    padding: 1,
    ignoreStroke: true,
  });
  layer.add(transformer);

  // Click on empty = deselect
  stage.on('click tap', (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target === stage) {
      finishEditing();
      emit('deselect');
    }
  });

  buildNodes();
};

// --- Build schema overlay nodes ---
const buildNodes = () => {
  if (!layer || !transformer) return;

  // Remove old nodes (keep transformer)
  layer.children?.filter((c: Konva.Node) => c !== transformer).forEach((n: Konva.Node) => n.destroy());

  props.schemas.forEach((schema) => {
    const x = schema.position.x * MM_TO_PX;
    const y = schema.position.y * MM_TO_PX;
    const w = schema.width * MM_TO_PX;
    const h = schema.height * MM_TO_PX;
    const rotation = schema.rotate ?? 0;

    // CSS transform: rotate() uses center as origin. Match that in Konva with offset.
    // With offset set to center, the group's x/y must point to the center, not top-left.
    const group = new Konva.Group({
      id: schema.id,
      x: x + w / 2,
      y: y + h / 2,
      width: w, height: h,
      offsetX: w / 2,
      offsetY: h / 2,
      rotation,
      draggable: true,
      name: 'schema-node',
    });

    // Transparent hit area + outline
    const isActive = props.activeSchemaIds.includes(schema.id);
    const isHovering = props.hoveringSchemaId === schema.id;
    const isEditing = props.editingSchemaId === schema.id;
    const outlineColor = schema.readOnly && !isHovering && !isActive ? 'transparent' : '#38a0ff';

    group.add(new Konva.Rect({
      x: 0, y: 0, width: w, height: h,
      fill: isEditing ? '#fff' : 'transparent',  // white bg only when editing text
      stroke: outlineColor,
      strokeWidth: isActive || isHovering ? 2 : 1,
      dash: isActive || isHovering ? [] : [4, 4],
      name: 'outline',
    }));

    // Editable text (only shown during text editing)
    if (isEditing && schema.type === 'text') {
      const rawFontSize = (schema as any).fontSize ?? 13;
      const fontSize = rawFontSize * 0.3528 * MM_TO_PX;
      group.add(new Konva.Text({
        x: 2, y: 1,
        width: w - 4, height: h - 2,
        text: schema.content || '',
        fontSize,
        fontFamily: (schema as any).fontName || 'sans-serif',
        fill: (schema as any).fontColor || '#000',
        align: (schema as any).alignment || 'left',
        name: 'edit-text',
        listening: false,
      }));
    }

    // Required indicator
    if (schema.required) {
      group.add(new Konva.Text({
        x: -8, y: -12, text: '*', fontSize: 14, fill: 'red', fontStyle: 'bold', listening: false,
      }));
    }

    // --- Events ---
    group.on('mouseenter', () => {
      emit('hoverSchema', schema.id);
      if (containerRef.value) containerRef.value.style.cursor = schema.readOnly ? 'default' : 'move';
    });
    group.on('mouseleave', () => {
      emit('hoverSchema', null);
      if (containerRef.value) containerRef.value.style.cursor = 'default';
    });

    group.on('click tap', (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      if (props.editingSchemaId && props.editingSchemaId !== schema.id) {
        finishEditing();
      }
      const shiftKey = e.evt?.shiftKey;
      if (shiftKey) {
        const current = [...props.activeSchemaIds];
        const idx = current.indexOf(schema.id);
        idx >= 0 ? current.splice(idx, 1) : current.push(schema.id);
        emit('select', current);
      } else {
        emit('select', [schema.id]);
      }
    });

    // Double-click to edit text
    group.on('dblclick dbltap', (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      if (schema.type === 'text' && !schema.readOnly) {
        startEditing(schema);
      }
    });

    // Drag constraints
    group.on('dragmove', () => {
      const pos = group.position();
      const rect = group.getClientRect({ relativeTo: group.getParent() ?? undefined });
      let [pt, pr, pb, pl] = [0, 0, 0, 0];
      if (isBlankPdf(props.basePdf)) {
        [pt, pr, pb, pl] = props.basePdf.padding.map((p: number) => p * MM_TO_PX);
      }
      const maxX = pos.x + (pw.value - pr - (rect.x + rect.width));
      const maxY = pos.y + (ph.value - pb - (rect.y + rect.height));
      const minX = pos.x + (pl - rect.x);
      const minY = pos.y + (pt - rect.y);
      group.position({
        x: Math.max(minX, Math.min(pos.x, maxX)),
        y: Math.max(minY, Math.min(pos.y, maxY)),
      });
    });

    group.on('dragend', () => {
      const pos = group.position();
      // Convert center position back to top-left for pdfme
      const topLeftX = pos.x - group.offsetX();
      const topLeftY = pos.y - group.offsetY();
      emit('changeSchemas', [
        { key: 'position.x', value: Math.round((topLeftX / MM_TO_PX) * 100) / 100, schemaId: schema.id },
        { key: 'position.y', value: Math.round((topLeftY / MM_TO_PX) * 100) / 100, schemaId: schema.id },
      ]);
    });

    // During transform: absorb scale into width/height so position stays stable
    group.on('transform', () => {
      const sx = group.scaleX();
      const sy = group.scaleY();
      if (sx === 1 && sy === 1) return;
      const newW = Math.max(5, group.width() * sx);
      const newH = Math.max(5, group.height() * sy);
      group.scaleX(1);
      group.scaleY(1);
      group.width(newW);
      group.height(newH);
      group.offsetX(newW / 2);
      group.offsetY(newH / 2);
      // Update the outline rect inside the group
      const rect = group.findOne('.outline') as Konva.Rect | undefined;
      if (rect) rect.size({ width: newW, height: newH });
    });

    group.on('transformend', () => {
      const pos = group.position();
      const rot = group.rotation();
      const curW = group.width();
      const curH = group.height();
      // Convert center to top-left for pdfme
      const topLeftX = pos.x - group.offsetX();
      const topLeftY = pos.y - group.offsetY();
      emit('changeSchemas', [
        { key: 'position.x', value: Math.round((topLeftX / MM_TO_PX) * 100) / 100, schemaId: schema.id },
        { key: 'position.y', value: Math.round((topLeftY / MM_TO_PX) * 100) / 100, schemaId: schema.id },
        { key: 'width', value: Math.round((curW / MM_TO_PX) * 100) / 100, schemaId: schema.id },
        { key: 'height', value: Math.round((curH / MM_TO_PX) * 100) / 100, schemaId: schema.id },
        { key: 'rotate', value: Math.round(((rot % 360) + 360) % 360), schemaId: schema.id },
      ]);
    });

    layer!.add(group);
  });

  updateTransformer();
  layer.batchDraw();
};

// --- Incremental update (positions/outlines only) ---
const updateNodes = () => {
  if (!layer || !transformer) return;

  const existingNodes = layer.children?.filter(
    (c: Konva.Node) => c !== transformer && c.name() === 'schema-node'
  ) ?? [];
  const existingIds = new Set(existingNodes.map((n: Konva.Node) => n.id()));
  const schemaIds = new Set(props.schemas.map(s => s.id));

  // If IDs changed, full rebuild
  if (existingIds.size !== schemaIds.size || ![...schemaIds].every(id => existingIds.has(id))) {
    buildNodes();
    return;
  }

  // Same IDs: update in-place
  props.schemas.forEach(schema => {
    const node = layer!.findOne('#' + schema.id) as Konva.Group | undefined;
    if (!node) return;
    const w = schema.width * MM_TO_PX;
    const h = schema.height * MM_TO_PX;
    // Center-offset positioning to match CSS transform-origin: center
    node.position({ x: schema.position.x * MM_TO_PX + w / 2, y: schema.position.y * MM_TO_PX + h / 2 });
    node.offsetX(w / 2);
    node.offsetY(h / 2);
    node.size({ width: w, height: h });
    node.rotation(schema.rotate ?? 0);

    const rect = node.findOne('.outline') as Konva.Rect | undefined;
    if (rect) {
      const isActive = props.activeSchemaIds.includes(schema.id);
      const isHovering = props.hoveringSchemaId === schema.id;
      const isEditing = props.editingSchemaId === schema.id;
      const outlineColor = schema.readOnly && !isHovering && !isActive ? 'transparent' : '#38a0ff';
      rect.stroke(outlineColor);
      rect.strokeWidth(isActive || isHovering ? 2 : 1);
      rect.dash(isActive || isHovering ? [] : [4, 4]);
      rect.fill(isEditing ? '#fff' : 'transparent');
      rect.size({ width: schema.width * MM_TO_PX, height: schema.height * MM_TO_PX });
    }
  });

  updateTransformer();
  layer.batchDraw();
};

const updateTransformer = () => {
  if (!transformer || !layer) return;
  const selectedNodes = props.activeSchemaIds
    .map(id => layer!.findOne('#' + id))
    .filter(Boolean) as Konva.Node[];
  transformer.nodes(selectedNodes);
  layer.batchDraw();
};

// --- Text editing: emit to parent for modal ---
const startEditing = (schema: SchemaForUI) => {
  emit('editingSchema', schema.id);
};

const finishEditing = () => {
  if (props.editingSchemaId) emit('editingSchema', null);
};

// --- Watchers ---
watch([() => props.schemas, () => props.activeSchemaIds, () => props.hoveringSchemaId], () => {
  nextTick(updateNodes);
}, { deep: true });

watch([() => props.scale, () => props.width, () => props.height], () => {
  if (stage) {
    stage.width(props.width);
    stage.height(props.height);
    stage.scaleX(props.scale);
    stage.scaleY(props.scale);
    buildNodes();
  }
});

onMounted(() => nextTick(initStage));
onBeforeUnmount(() => { stage?.destroy(); stage = null; });
</script>

<template>
  <div
    ref="containerRef"
    :style="{
      position: 'absolute',
      top: 0,
      left: 0,
      width: width + 'px',
      height: height + 'px',
      pointerEvents: 'auto',
    }"
  />
</template>
