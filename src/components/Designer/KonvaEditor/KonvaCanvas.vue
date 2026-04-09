<script setup lang="ts">
/**
 * KonvaCanvas: Two-layer Designer canvas
 *
 * Layer 1 (Background): PDF preview image rendered from template
 *   - For BlankPdf: white rectangle with padding overlay
 *   - For real PDF: rendered image via pdf2img
 *   - Text content rendered as simple Konva.Text for preview
 *
 * Layer 2 (Editor): Konva stage for interaction
 *   - Selection rectangles (outlines around schema positions)
 *   - Drag/resize/rotate via Konva Transformer
 *   - No inline DOM editing — all editing via sidebar
 *   - Coordinates are in mm, converted to px for display
 */
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick, inject } from 'vue';
import Konva from 'konva';
import type { Template, SchemaForUI, Size, BasePdf, ChangeSchemas } from '@pdfme/common';
import { ZOOM, isBlankPdf } from '@pdfme/common';
import { I18nKey, PluginsRegistryKey, FontKey } from '../../../composables/injection-keys';
import { RULER_HEIGHT, PAGE_GAP } from '../../../constants';

const MM_TO_PX = ZOOM; // 3.7795275591

const props = defineProps<{
  template: Template;
  schemasList: SchemaForUI[][];
  pageSizes: Size[];
  backgrounds: string[]; // base64 data URLs for each page
  scale: number;
  pageCursor: number;
  activeSchemaIds: string[];
  hoveringSchemaId: string | null;
}>();

const emit = defineEmits<{
  (e: 'select', ids: string[]): void;
  (e: 'deselect'): void;
  (e: 'changeSchemas', changes: { key: string; value: unknown; schemaId: string }[]): void;
  (e: 'hoverSchema', id: string | null): void;
}>();

const containerRef = ref<HTMLDivElement>();
let stage: Konva.Stage | null = null;
let bgLayer: Konva.Layer | null = null;
let schemaLayer: Konva.Layer | null = null;
let transformer: Konva.Transformer | null = null;

const pageSize = computed(() => props.pageSizes[props.pageCursor] ?? { width: 210, height: 297 });
const stageWidth = computed(() => pageSize.value.width * MM_TO_PX * props.scale);
const stageHeight = computed(() => pageSize.value.height * MM_TO_PX * props.scale);
const schemas = computed(() => props.schemasList[props.pageCursor] ?? []);

// --- Initialize Konva ---
const initStage = () => {
  if (!containerRef.value) return;
  if (stage) stage.destroy();

  stage = new Konva.Stage({
    container: containerRef.value,
    width: stageWidth.value,
    height: stageHeight.value,
    scaleX: props.scale,
    scaleY: props.scale,
  });

  // Background layer: PDF image + padding
  bgLayer = new Konva.Layer({ listening: false });
  stage.add(bgLayer);

  // Schema layer: interactive rectangles
  schemaLayer = new Konva.Layer();
  stage.add(schemaLayer);

  // Transformer for selection
  transformer = new Konva.Transformer({
    rotateEnabled: true,
    rotationSnaps: [0, 90, 180, 270],
    borderStroke: '#38a0ff',
    anchorFill: '#38a0ff',
    anchorStroke: '#fff',
    anchorSize: 8,
    padding: 2,
  });
  schemaLayer.add(transformer);

  // Click on empty area = deselect
  stage.on('click tap', (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target === stage || e.target.getLayer() === bgLayer) {
      emit('deselect');
    }
  });

  renderAll();
};

// --- Render background ---
const renderBackground = () => {
  if (!bgLayer) return;
  bgLayer.destroyChildren();

  const pw = pageSize.value.width * MM_TO_PX;
  const ph = pageSize.value.height * MM_TO_PX;

  // White page background
  bgLayer.add(new Konva.Rect({
    x: 0, y: 0, width: pw, height: ph,
    fill: '#fff',
  }));

  // PDF background image
  const bgSrc = props.backgrounds[props.pageCursor];
  if (bgSrc) {
    const img = new Image();
    img.onload = (): void => {
      const bgImage = new Konva.Image({
        x: 0, y: 0, width: pw, height: ph, image: img,
      });
      bgLayer!.add(bgImage);
      bgImage.moveToBottom();
      // Re-add white rect below
      bgLayer!.draw();
    };
    img.src = bgSrc;
  }

  // Padding overlay (for blank PDFs)
  if (isBlankPdf(props.template.basePdf)) {
    const [pt, pr, pb, pl] = props.template.basePdf.padding;
    const paddingColor = 'rgba(255, 77, 79, 0.15)';
    // Top
    bgLayer.add(new Konva.Rect({ x: 0, y: 0, width: pw, height: pt * MM_TO_PX, fill: paddingColor }));
    // Bottom
    bgLayer.add(new Konva.Rect({ x: 0, y: (pageSize.value.height - pb) * MM_TO_PX, width: pw, height: pb * MM_TO_PX, fill: paddingColor }));
    // Left
    bgLayer.add(new Konva.Rect({ x: 0, y: 0, width: pl * MM_TO_PX, height: ph, fill: paddingColor }));
    // Right
    bgLayer.add(new Konva.Rect({ x: (pageSize.value.width - pr) * MM_TO_PX, y: 0, width: pr * MM_TO_PX, height: ph, fill: paddingColor }));
  }

  bgLayer.batchDraw();
};

// --- Render schema nodes ---
const renderSchemas = (forceRebuild = false) => {
  if (!schemaLayer || !transformer) return;

  const currentSchemas = schemas.value;
  const existingIds = new Set<string>();

  // Check if we can do incremental update
  if (!forceRebuild) {
    const existingNodes = schemaLayer.children?.filter(
      (c: Konva.Node) => c !== transformer && c.name() === 'schema-node'
    ) ?? [];
    const existingNodeIds = new Set(existingNodes.map((n: Konva.Node) => n.id()));
    const schemaIds = new Set(currentSchemas.map(s => s.id));

    // If same set of IDs, just update positions/properties
    if (existingNodeIds.size === schemaIds.size && [...schemaIds].every(id => existingNodeIds.has(id))) {
      currentSchemas.forEach(schema => {
        const node = schemaLayer!.findOne('#' + schema.id) as Konva.Group | undefined;
        if (node) {
          node.position({ x: schema.position.x * MM_TO_PX, y: schema.position.y * MM_TO_PX });
          node.size({ width: schema.width * MM_TO_PX, height: schema.height * MM_TO_PX });
          node.rotation(schema.rotate ?? 0);
          // Update outline style
          const rect = node.findOne('Rect') as Konva.Rect | undefined;
          if (rect) {
            const isActive = props.activeSchemaIds.includes(schema.id);
            const isHovering = props.hoveringSchemaId === schema.id;
            const outlineColor = schema.readOnly && !isHovering ? 'transparent' : '#38a0ff';
            rect.stroke(outlineColor);
            rect.strokeWidth(isHovering || isActive ? 2 : 1);
            rect.dash(isHovering || isActive ? [] : [4, 4]);
            rect.size({ width: schema.width * MM_TO_PX, height: schema.height * MM_TO_PX });
          }
          // Update text
          const text = node.findOne('Text') as Konva.Text | undefined;
          if (text && schema.type === 'text') {
            text.text(schema.content || '');
            const w = schema.width * MM_TO_PX;
            text.width(w - 4);
          }
        }
      });
      updateTransformer();
      schemaLayer!.batchDraw();
      return;
    }
  }

  // Full rebuild: remove old schema nodes (keep transformer)
  const oldNodes = schemaLayer.children?.filter((c: Konva.Node) => c !== transformer) ?? [];
  oldNodes.forEach((n: Konva.Node) => n.destroy());

  const currentSchemasForBuild = currentSchemas;

  currentSchemasForBuild.forEach((schema) => {
    const x = schema.position.x * MM_TO_PX;
    const y = schema.position.y * MM_TO_PX;
    const w = schema.width * MM_TO_PX;
    const h = schema.height * MM_TO_PX;
    const rotation = schema.rotate ?? 0;

    const group = new Konva.Group({
      id: schema.id,
      x, y, width: w, height: h,
      rotation,
      draggable: true,
      name: 'schema-node',
    });

    // Background rect (for hit detection and outline)
    const isActive = props.activeSchemaIds.includes(schema.id);
    const isHovering = props.hoveringSchemaId === schema.id;
    const outlineColor = schema.readOnly && !isHovering ? 'transparent' : '#38a0ff';
    const outlineStyle = isHovering ? 2 : 1;

    group.add(new Konva.Rect({
      x: 0, y: 0, width: w, height: h,
      fill: 'transparent',
      stroke: outlineColor,
      strokeWidth: outlineStyle,
      dash: isHovering ? undefined : [4, 4],
    }));

    // Text preview
    const content = schema.content || '';
    if (schema.type === 'text' && content) {
      // pdfme fontSize is in pt. Canvas coords are mm*ZOOM. 1pt = 0.3528mm
      const rawFontSize = (schema as any).fontSize ?? 13;
      const fontSize = rawFontSize * 0.3528 * MM_TO_PX;
      group.add(new Konva.Text({
        x: 2, y: 1,
        width: w - 4,
        height: h - 2,
        text: content,
        fontSize: fontSize,
        fontFamily: (schema as any).fontName || 'Roboto, sans-serif',
        fill: (schema as any).fontColor || '#000',
        align: (schema as any).alignment || 'left',
        verticalAlign: (schema as any).verticalAlignment || 'top',
        listening: false,
      }));
    } else if (content) {
      // Non-text schemas: show type label
      group.add(new Konva.Text({
        x: 4, y: 2,
        width: w - 8,
        text: `[${schema.type}] ${schema.name}`,
        fontSize: 10,
        fill: '#999',
        listening: false,
      }));
    }

    // Required indicator
    if (schema.required) {
      group.add(new Konva.Text({
        x: -10, y: -14,
        text: '*',
        fontSize: 16,
        fill: 'red',
        fontStyle: 'bold',
        listening: false,
      }));
    }

    // Events
    group.on('mouseenter', () => {
      emit('hoverSchema', schema.id);
      if (containerRef.value) containerRef.value.style.cursor = 'pointer';
    });
    group.on('mouseleave', () => {
      emit('hoverSchema', null);
      if (containerRef.value) containerRef.value.style.cursor = 'default';
    });

    group.on('click tap', (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      const shiftKey = (e.evt as MouseEvent).shiftKey;
      if (shiftKey) {
        const current = [...props.activeSchemaIds];
        const idx = current.indexOf(schema.id);
        if (idx >= 0) {
          current.splice(idx, 1);
        } else {
          current.push(schema.id);
        }
        emit('select', current);
      } else {
        emit('select', [schema.id]);
      }
    });

    // Drag constraints – use getClientRect to handle rotated elements correctly
    group.on('dragmove', () => {
      const pos = group.position();
      const pw = pageSize.value.width * MM_TO_PX;
      const ph = pageSize.value.height * MM_TO_PX;
      let [pt, pr, pb, pl] = [0, 0, 0, 0];
      if (isBlankPdf(props.template.basePdf)) {
        [pt, pr, pb, pl] = props.template.basePdf.padding.map(p => p * MM_TO_PX);
      }
      // getClientRect gives the axis-aligned bounding box after rotation
      const rect = group.getClientRect({ relativeTo: group.getParent() ?? undefined });
      const maxX = pos.x + (pw - pr - (rect.x + rect.width));
      const maxY = pos.y + (ph - pb - (rect.y + rect.height));
      const minX = pos.x + (pl - rect.x);
      const minY = pos.y + (pt - rect.y);
      group.position({
        x: Math.max(minX, Math.min(pos.x, maxX)),
        y: Math.max(minY, Math.min(pos.y, maxY)),
      });
    });

    group.on('dragend', () => {
      const pos = group.position();
      emit('changeSchemas', [
        { key: 'position.x', value: Math.round((pos.x / MM_TO_PX) * 100) / 100, schemaId: schema.id },
        { key: 'position.y', value: Math.round((pos.y / MM_TO_PX) * 100) / 100, schemaId: schema.id },
      ]);
    });

    // Resize via transformer
    group.on('transformend', () => {
      const node = group;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      // Reset scale and apply to width/height
      node.scaleX(1);
      node.scaleY(1);
      const newW = Math.max(5, w * scaleX);
      const newH = Math.max(5, h * scaleY);
      const pos = node.position();
      const rot = node.rotation();

      emit('changeSchemas', [
        { key: 'position.x', value: Math.round((pos.x / MM_TO_PX) * 100) / 100, schemaId: schema.id },
        { key: 'position.y', value: Math.round((pos.y / MM_TO_PX) * 100) / 100, schemaId: schema.id },
        { key: 'width', value: Math.round((newW / MM_TO_PX) * 100) / 100, schemaId: schema.id },
        { key: 'height', value: Math.round((newH / MM_TO_PX) * 100) / 100, schemaId: schema.id },
        { key: 'rotate', value: Math.round(((rot % 360) + 360) % 360), schemaId: schema.id },
      ]);
    });

    schemaLayer!.add(group);
  });

  // Update transformer targets
  updateTransformer();
  schemaLayer.batchDraw();
};

const updateTransformer = () => {
  if (!transformer || !schemaLayer) return;
  const selectedNodes = props.activeSchemaIds
    .map(id => schemaLayer!.findOne('#' + id))
    .filter(Boolean) as Konva.Node[];
  transformer.nodes(selectedNodes);
  schemaLayer.batchDraw();
};

const renderAll = () => {
  renderBackground();
  renderSchemas(true); // force full rebuild on init/scale change
};

// --- Watchers ---
watch([() => props.schemasList, () => props.pageCursor], () => {
  nextTick(() => renderSchemas()); // incremental update
}, { deep: true });

watch(() => props.backgrounds, () => {
  nextTick(() => renderBackground());
}, { deep: true });

watch(() => props.activeSchemaIds, () => {
  nextTick(() => renderSchemas()); // incremental: just update outlines
}, { deep: true });

watch(() => props.hoveringSchemaId, () => {
  nextTick(() => renderSchemas()); // incremental: just update outlines
});

watch([() => props.scale, stageWidth, stageHeight], () => {
  if (stage) {
    stage.width(stageWidth.value);
    stage.height(stageHeight.value);
    stage.scaleX(props.scale);
    stage.scaleY(props.scale);
    renderAll();
  }
});

onMounted(() => {
  nextTick(initStage);
});

onBeforeUnmount(() => {
  stage?.destroy();
  stage = null;
});

defineExpose({
  getStage: () => stage,
});
</script>

<template>
  <div
    ref="containerRef"
    :style="{
      position: 'relative',
      background: '#4a4a4a',
      overflow: 'auto',
    }"
  />
</template>
