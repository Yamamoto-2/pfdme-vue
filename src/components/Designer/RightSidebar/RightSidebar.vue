<script setup lang="ts">
import { computed, inject } from 'vue';
import type { SchemaForUI, Size, ChangeSchemas, BasePdf } from '@pdfme/common';
import { Button, Divider, Typography, Input, InputNumber, Switch, Select } from 'ant-design-vue';
import { ChevronRight, ChevronLeft } from 'lucide-vue-next';
import { I18nKey, PluginsRegistryKey } from '../../../composables/injection-keys';
import { RIGHT_SIDEBAR_WIDTH, DESIGNER_CLASSNAME } from '../../../constants';

const { Text } = Typography;

const props = defineProps<{
  height: number;
  hoveringSchemaId: string | null;
  onChangeHoveringSchemaId: (id: string | null) => void;
  size: Size;
  pageSize: Size;
  basePdf: BasePdf;
  activeElements: HTMLElement[];
  schemas: SchemaForUI[];
  schemasList: SchemaForUI[][];
  onSortEnd: (sortedSchemas: SchemaForUI[]) => void;
  onEdit: (id: string) => void;
  onEditEnd: () => void;
  changeSchemas: ChangeSchemas;
  deselectSchema: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}>();

const i18n = inject(I18nKey, (key: string) => key);
const pluginsRegistry = inject(PluginsRegistryKey)!;

const activeSchemas = computed(() => {
  const ids = props.activeElements.map((ae) => ae.id);
  return props.schemas.filter((s) => ids.includes(s.id));
});

const lastActiveSchema = computed(() =>
  activeSchemas.value.length > 0 ? activeSchemas.value[activeSchemas.value.length - 1] : null,
);

const typeOptions = computed(() =>
  pluginsRegistry.entries().map(([label]) => ({ label, value: label })),
);

const updateField = (key: string, value: unknown) => {
  if (!lastActiveSchema.value) return;
  props.changeSchemas([{ key, value, schemaId: lastActiveSchema.value.id }]);
};
</script>

<template>
  <!-- Toggle button -->
  <div
    :style="{
      position: 'absolute',
      right: sidebarOpen ? RIGHT_SIDEBAR_WIDTH + 'px' : '0px',
      top: '50%',
      transform: 'translateY(-50%)',
      zIndex: 2,
    }"
  >
    <Button
      size="small"
      :style="{ borderRadius: '4px 0 0 4px', height: '40px' }"
      @click="setSidebarOpen(!sidebarOpen)"
    >
      <ChevronLeft v-if="sidebarOpen" :size="14" />
      <ChevronRight v-else :size="14" />
    </Button>
  </div>

  <!-- Sidebar -->
  <div
    v-show="sidebarOpen"
    :class="DESIGNER_CLASSNAME + 'right-sidebar'"
    :style="{
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: 1,
      width: RIGHT_SIDEBAR_WIDTH + 'px',
      height: height + 'px',
      background: 'var(--ant-color-bg-layout, #f5f5f5)',
      borderLeft: '1px solid var(--ant-color-border, #d9d9d9)',
      overflow: 'auto',
      padding: '8px 16px',
    }"
  >
    <!-- ListView: Schema list when nothing selected -->
    <template v-if="!lastActiveSchema">
      <div :style="{ padding: '8px 0' }">
        <Text strong>{{ i18n('fieldsList') }}</Text>
      </div>
      <Divider :style="{ margin: '4px 0' }" />
      <div
        v-for="schema in schemas"
        :key="schema.id"
        :style="{
          padding: '6px 8px',
          cursor: 'pointer',
          borderRadius: '4px',
          background: hoveringSchemaId === schema.id ? 'var(--ant-color-primary-bg, #e6f4ff)' : 'transparent',
          marginBottom: '2px',
        }"
        @mouseenter="onChangeHoveringSchemaId(schema.id)"
        @mouseleave="onChangeHoveringSchemaId(null)"
        @click="onEdit(schema.id)"
      >
        <Text>{{ schema.name || i18n('noKeyName') }}</Text>
        <Text type="secondary" :style="{ marginLeft: '8px', fontSize: '11px' }">{{ schema.type }}</Text>
      </div>
      <div v-if="schemas.length === 0" :style="{ padding: '20px', textAlign: 'center', color: '#999' }">
        {{ i18n('fieldsList') }}
      </div>
    </template>

    <!-- DetailView: Schema properties when selected -->
    <template v-else>
      <div :style="{ padding: '8px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }">
        <Text strong>{{ i18n('editField') }}</Text>
        <Button size="small" @click="deselectSchema">{{ i18n('close') }}</Button>
      </div>
      <Divider :style="{ margin: '4px 0' }" />

      <!-- Name -->
      <div :style="{ marginBottom: '8px' }">
        <Text :style="{ fontSize: '12px' }">{{ i18n('fieldName') }}</Text>
        <Input
          size="small"
          :value="lastActiveSchema.name"
          @change="(e: any) => updateField('name', e.target.value)"
          :style="{ marginTop: '4px' }"
        />
      </div>

      <!-- Type -->
      <div :style="{ marginBottom: '8px' }">
        <Text :style="{ fontSize: '12px' }">{{ i18n('type') }}</Text>
        <Select
          size="small"
          :value="lastActiveSchema.type"
          :options="typeOptions"
          :style="{ width: '100%', marginTop: '4px' }"
          @change="(val: any) => updateField('type', val)"
        />
      </div>

      <!-- Position -->
      <div :style="{ display: 'flex', gap: '8px', marginBottom: '8px' }">
        <div :style="{ flex: 1 }">
          <Text :style="{ fontSize: '12px' }">X</Text>
          <InputNumber
            size="small"
            :value="lastActiveSchema.position.x"
            :min="0"
            :step="1"
            :style="{ width: '100%', marginTop: '4px' }"
            @change="(val: any) => updateField('position.x', val)"
          />
        </div>
        <div :style="{ flex: 1 }">
          <Text :style="{ fontSize: '12px' }">Y</Text>
          <InputNumber
            size="small"
            :value="lastActiveSchema.position.y"
            :min="0"
            :step="1"
            :style="{ width: '100%', marginTop: '4px' }"
            @change="(val: any) => updateField('position.y', val)"
          />
        </div>
      </div>

      <!-- Size -->
      <div :style="{ display: 'flex', gap: '8px', marginBottom: '8px' }">
        <div :style="{ flex: 1 }">
          <Text :style="{ fontSize: '12px' }">{{ i18n('width') }}</Text>
          <InputNumber
            size="small"
            :value="lastActiveSchema.width"
            :min="0"
            :step="1"
            :style="{ width: '100%', marginTop: '4px' }"
            @change="(val: any) => updateField('width', val)"
          />
        </div>
        <div :style="{ flex: 1 }">
          <Text :style="{ fontSize: '12px' }">{{ i18n('height') }}</Text>
          <InputNumber
            size="small"
            :value="lastActiveSchema.height"
            :min="0"
            :step="1"
            :style="{ width: '100%', marginTop: '4px' }"
            @change="(val: any) => updateField('height', val)"
          />
        </div>
      </div>

      <!-- Rotate & Opacity -->
      <div :style="{ display: 'flex', gap: '8px', marginBottom: '8px' }">
        <div :style="{ flex: 1 }">
          <Text :style="{ fontSize: '12px' }">{{ i18n('rotate') }}</Text>
          <InputNumber
            size="small"
            :value="lastActiveSchema.rotate ?? 0"
            :min="0"
            :max="360"
            :step="1"
            :style="{ width: '100%', marginTop: '4px' }"
            @change="(val: any) => updateField('rotate', val)"
          />
        </div>
        <div :style="{ flex: 1 }">
          <Text :style="{ fontSize: '12px' }">{{ i18n('opacity') }}</Text>
          <InputNumber
            size="small"
            :value="lastActiveSchema.opacity ?? 1"
            :min="0"
            :max="1"
            :step="0.1"
            :style="{ width: '100%', marginTop: '4px' }"
            @change="(val: any) => updateField('opacity', val)"
          />
        </div>
      </div>

      <!-- Required / Editable -->
      <div :style="{ display: 'flex', gap: '16px', marginBottom: '8px' }">
        <div :style="{ display: 'flex', alignItems: 'center', gap: '4px' }">
          <Text :style="{ fontSize: '12px' }">{{ i18n('required') }}</Text>
          <Switch
            size="small"
            :checked="lastActiveSchema.required ?? false"
            @change="(val: any) => updateField('required', val)"
          />
        </div>
        <div :style="{ display: 'flex', alignItems: 'center', gap: '4px' }">
          <Text :style="{ fontSize: '12px' }">{{ i18n('editable') }}</Text>
          <Switch
            size="small"
            :checked="!lastActiveSchema.readOnly"
            @change="(val: any) => updateField('readOnly', !val)"
          />
        </div>
      </div>

      <!-- Plugin-specific properties rendered via WidgetRenderer -->
      <Divider :style="{ margin: '8px 0' }" />
      <div ref="pluginPropsRef" />
    </template>
  </div>
</template>
