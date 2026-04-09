<script setup lang="ts">
import { ref, inject, watch, computed, onMounted } from 'vue';
import type { Dict, SchemaForUI, Size, ChangeSchemas, BasePdf } from '@pdfme/common';
import type { WidgetProps } from '../../../../widget-types';
import { isBlankPdf } from '@pdfme/common';
import { Form, Input, InputNumber, Select, Switch, Divider, Typography, Button, Row, Col } from 'ant-design-vue';
import { Menu } from 'lucide-vue-next';
import { I18nKey, PluginsRegistryKey, OptionsKey } from '../../../../composables/injection-keys';
import { debounce } from '../../../../helper';
import { DESIGNER_CLASSNAME } from '../../../../constants';
import { SIDEBAR_H_PADDING_PX, SIDEBAR_V_PADDING_PX, SIDEBAR_HEADER_HEIGHT } from '../layout';
import AlignWidget from './AlignWidget.vue';
import ButtonGroupWidget from './ButtonGroupWidget.vue';
import WidgetRenderer from './WidgetRenderer.vue';

const { Text } = Typography;

const props = defineProps<{
  size: Size;
  schemas: SchemaForUI[];
  schemasList: SchemaForUI[][];
  pageSize: Size;
  basePdf: BasePdf;
  changeSchemas: ChangeSchemas;
  activeElements: HTMLElement[];
  deselectSchema: () => void;
  activeSchema: SchemaForUI;
}>();

const i18n = inject(I18nKey, (key: string) => key);
const pluginsRegistry = inject(PluginsRegistryKey)!;
const options = inject(OptionsKey, {});

const typedI18n = (key: string): string => {
  return typeof i18n === 'function' ? i18n(key as keyof Dict) : key;
};

// Local form state that tracks the active schema
const formValues = ref<Record<string, unknown>>({});

// Handle field changes with debounced commit
const handleFieldChange = debounce(function (...args: unknown[]) {
  const key = args[0] as string;
  const value = args[1] as unknown;

  if (key === 'editable') {
    const readOnlyValue = !value;
    const changes = [{ key: 'readOnly', value: readOnlyValue, schemaId: props.activeSchema.id }];
    if (readOnlyValue) {
      changes.push({ key: 'required', value: false, schemaId: props.activeSchema.id });
    }
    props.changeSchemas(changes);
    return;
  }

  // For null values on rotate/opacity, convert to undefined
  let finalValue = value;
  if (finalValue === null && ['rotate', 'opacity'].includes(key)) {
    finalValue = undefined;
  }

  const currentValue = (props.activeSchema as Record<string, unknown>)[key];
  if (JSON.stringify(finalValue) !== JSON.stringify(currentValue)) {
    props.changeSchemas([{ key, value: finalValue, schemaId: props.activeSchema.id }]);
  }
}, 100);

const updateField = (key: string, value: unknown) => {
  // Update local form state
  if (key.includes('.')) {
    const parts = key.split('.');
    const obj = { ...(formValues.value[parts[0]] as Record<string, unknown> || {}) };
    obj[parts[1]] = value;
    formValues.value[parts[0]] = obj;
  } else {
    formValues.value[key] = value;
  }
  handleFieldChange(key, value);
};

// Plugin schema
const activePlugin = computed(() => pluginsRegistry.findByType(props.activeSchema.type));

const typeOptions = computed(() => {
  const opts: { label: string; value: string }[] = [];
  pluginsRegistry.entries().forEach(([label, plugin]) => {
    if (plugin.propPanel.defaultSchema?.type) {
      opts.push({ label, value: plugin.propPanel.defaultSchema.type });
    }
  });
  return opts;
});

const defaultSchema = computed<Record<string, unknown>>(() => {
  if (!activePlugin.value?.propPanel?.defaultSchema) return {};
  const result: Record<string, unknown> = {};
  for (const key in activePlugin.value.propPanel.defaultSchema) {
    if (Object.prototype.hasOwnProperty.call(activePlugin.value.propPanel.defaultSchema, key)) {
      result[key] = (activePlugin.value.propPanel.defaultSchema as Record<string, unknown>)[key];
    }
  }
  return result;
});

// Sync form values when active schema changes, merging plugin defaults
watch(
  [() => props.activeSchema, defaultSchema],
  ([schema, defaults]) => {
    const values: Record<string, unknown> = { ...defaults, ...schema };
    values.editable = !schema.readOnly;
    formValues.value = values;
  },
  { immediate: true, deep: true },
);

// Calculate padding
const padding = computed(() => isBlankPdf(props.basePdf) ? props.basePdf.padding : [0, 0, 0, 0]);
const [pt, pr, pb, pl] = [
  computed(() => padding.value[0]),
  computed(() => padding.value[1]),
  computed(() => padding.value[2]),
  computed(() => padding.value[3]),
];

// Plugin-specific schema properties
const pluginSchemaProps = computed<Record<string, any>>(() => {
  if (!activePlugin.value) return {};
  const activePropPanelSchema = activePlugin.value.propPanel.schema;
  if (typeof activePropPanelSchema === 'function') {
    return activePropPanelSchema({
      ...props,
      options,
      theme: {},
      i18n: typedI18n,
    }) || {};
  }
  return activePropPanelSchema && typeof activePropPanelSchema === 'object' ? activePropPanelSchema : {};
});

// Plugin widgets
const pluginWidgets = computed<Record<string, (props: WidgetProps) => void>>(() => {
  const widgets: Record<string, (props: WidgetProps) => void> = {};
  for (const plugin of pluginsRegistry.values()) {
    const pw = (plugin.propPanel.widgets ?? {}) as Record<string, (props: WidgetProps) => void>;
    Object.assign(widgets, pw);
  }
  return widgets;
});

// Build widget props for custom renderers
const widgetProps = computed<WidgetProps>(() => ({
  ...props,
  options,
  theme: {} as any,
  i18n: typedI18n,
  schema: props.activeSchema,
  rootElement: document.createElement('div'),
}));

// Render a single schema field based on its definition
const getFieldWidget = (key: string, fieldDef: any) => {
  if (!fieldDef) return null;
  return { key, ...fieldDef };
};

// Color field pairing helpers: put consecutive color fields on the same row
const isPrevFieldColor = (currentKey: string | number) => {
  const keys = Object.keys(pluginSchemaProps.value);
  const idx = keys.indexOf(String(currentKey));
  if (idx <= 0) return false;
  const prevDef = pluginSchemaProps.value[keys[idx - 1]];
  return prevDef?.type === 'string' && prevDef?.widget === 'color';
};

const getNextFieldColor = (currentKey: string | number): { key: string; def: any } | null => {
  const keys = Object.keys(pluginSchemaProps.value);
  const idx = keys.indexOf(String(currentKey));
  if (idx < 0 || idx >= keys.length - 1) return null;
  const nextKey = keys[idx + 1];
  const nextDef = pluginSchemaProps.value[nextKey];
  if (nextDef?.type === 'string' && nextDef?.widget === 'color') {
    return { key: nextKey, def: nextDef };
  }
  return null;
};

const isHidden = (fieldDef: any) => {
  if (typeof fieldDef.hidden === 'boolean') return fieldDef.hidden;
  if (typeof fieldDef.hidden === 'string') {
    // Evaluate template expression like '{{!formData.editable}}'
    const expr = fieldDef.hidden.replace(/\{\{(.+?)\}\}/g, '$1');
    try {
      const formData = formValues.value;
      return new Function('formData', `return ${expr}`)(formData);
    } catch { return false; }
  }
  return false;
};
</script>

<template>
  <div :class="DESIGNER_CLASSNAME + 'detail-view'" :style="{ height: '100%', display: 'flex', flex: 1, flexDirection: 'column' }">
    <!-- Header -->
    <div
      :style="{
        position: 'relative',
        minHeight: SIDEBAR_HEADER_HEIGHT + 'px',
        display: 'flex',
        flexShrink: 0,
        flexDirection: 'column',
        justifyContent: 'center',
        padding: `${SIDEBAR_V_PADDING_PX}px ${SIDEBAR_H_PADDING_PX}px 0`,
      }"
    >
      <Button
        :class="DESIGNER_CLASSNAME + 'back-button'"
        :style="{
          position: 'absolute',
          left: SIDEBAR_H_PADDING_PX + 'px',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: 'translateY(-50%)',
          top: '50%',
          paddingTop: '3px',
        }"
        @click="deselectSchema"
      >
        <Menu :stroke-width="1.5" :size="20" />
      </Button>
      <div :style="{ minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }">
        <Text strong :style="{ textAlign: 'center', width: '100%' }">
          {{ typedI18n('editField') }}
        </Text>
      </div>
      <Divider :style="{ marginTop: SIDEBAR_V_PADDING_PX + 'px', marginBottom: 0 }" />
    </div>

    <!-- Body -->
    <div
      :style="{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: `${SIDEBAR_V_PADDING_PX}px ${SIDEBAR_H_PADDING_PX}px`,
      }"
    >
      <Form layout="vertical" size="small">
        <!-- Type & Name -->
        <Row :gutter="8">
          <Col :span="12">
            <Form.Item :label="typedI18n('type')">
              <Select
                :value="formValues.type as string"
                :options="typeOptions"
                :style="{ width: '100%' }"
                @change="(val: any) => updateField('type', val)"
              />
            </Form.Item>
          </Col>
          <Col :span="12">
            <Form.Item :label="typedI18n('fieldName')">
              <Input
                :value="formValues.name as string"
                autoComplete="off"
                @change="(e: any) => updateField('name', e.target.value)"
              />
            </Form.Item>
          </Col>
        </Row>

        <!-- Content -->
        <Row v-if="!activeSchema.readOnly" :gutter="8">
          <Col :span="24">
            <Form.Item label="Content">
              <Input.TextArea
                :value="formValues.content as string"
                :rows="3"
                :style="{ fontFamily: 'monospace', fontSize: '12px' }"
                @change="(e: any) => updateField('content', e.target.value)"
              />
            </Form.Item>
          </Col>
        </Row>

        <!-- Editable & Required -->
        <Row :gutter="8">
          <Col v-if="typeof defaultSchema.readOnly === 'undefined'" :span="8">
            <Form.Item :label="typedI18n('editable')">
              <Switch
                :checked="formValues.editable as boolean"
                @change="(val: any) => updateField('editable', val)"
              />
            </Form.Item>
          </Col>
          <Col v-if="formValues.editable" :span="16">
            <Form.Item :label="typedI18n('required')">
              <Switch
                :checked="formValues.required as boolean"
                @change="(val: any) => updateField('required', val)"
              />
            </Form.Item>
          </Col>
        </Row>

        <Divider :style="{ margin: '4px 0' }" />

        <!-- Align Widget -->
        <AlignWidget v-bind="widgetProps" />

        <!-- Position -->
        <Row :gutter="8">
          <Col :span="12">
            <Form.Item label="X">
              <InputNumber
                :value="(formValues.position as any)?.x"
                :min="pl"
                :max="pageSize.width - pr"
                :style="{ width: '100%' }"
                @change="(val: any) => updateField('position.x', val)"
              />
            </Form.Item>
          </Col>
          <Col :span="12">
            <Form.Item label="Y">
              <InputNumber
                :value="(formValues.position as any)?.y"
                :min="pt"
                :max="pageSize.height - pb"
                :style="{ width: '100%' }"
                @change="(val: any) => updateField('position.y', val)"
              />
            </Form.Item>
          </Col>
        </Row>

        <!-- Width / Height / Rotate / Opacity -->
        <Row :gutter="8">
          <Col :span="6">
            <Form.Item :label="typedI18n('width')">
              <InputNumber
                :value="formValues.width as number"
                :min="0"
                :max="pageSize.width - pl - pr"
                :style="{ width: '100%' }"
                @change="(val: any) => updateField('width', val)"
              />
            </Form.Item>
          </Col>
          <Col :span="6">
            <Form.Item :label="typedI18n('height')">
              <InputNumber
                :value="formValues.height as number"
                :min="0"
                :max="pageSize.height - pt - pb"
                :style="{ width: '100%' }"
                @change="(val: any) => updateField('height', val)"
              />
            </Form.Item>
          </Col>
          <Col :span="6">
            <Form.Item :label="typedI18n('rotate')">
              <InputNumber
                :value="(formValues.rotate as number) ?? 0"
                :min="0"
                :max="360"
                :disabled="typeof defaultSchema.rotate === 'undefined'"
                :style="{ width: '100%' }"
                @change="(val: any) => updateField('rotate', val)"
              />
            </Form.Item>
          </Col>
          <Col :span="6">
            <Form.Item :label="typedI18n('opacity')">
              <InputNumber
                :value="(formValues.opacity as number) ?? 1"
                :min="0"
                :max="1"
                :step="0.1"
                :disabled="typeof defaultSchema.opacity === 'undefined'"
                :style="{ width: '100%' }"
                @change="(val: any) => updateField('opacity', val)"
              />
            </Form.Item>
          </Col>
        </Row>

        <!-- Plugin-specific properties -->
        <template v-if="Object.keys(pluginSchemaProps).length > 0">
          <Divider :style="{ margin: '4px 0' }" />

          <template v-for="(fieldDef, fieldKey) in pluginSchemaProps" :key="fieldKey">
            <template v-if="!isHidden(fieldDef)">

              <!-- Custom plugin widget (e.g. UseDynamicFontSize) -->
              <template v-if="fieldDef.widget && typeof fieldDef.widget === 'string' && !['select','inputNumber','color','card','input','Divider','ButtonGroup'].includes(fieldDef.widget) && pluginWidgets[fieldDef.widget]">
                <Form.Item :label="fieldDef.title || undefined">
                  <WidgetRenderer
                    v-bind="{ ...widgetProps, schema: fieldDef }"
                    :widget="pluginWidgets[fieldDef.widget]"
                  />
                </Form.Item>
              </template>

              <!-- Void type: built-in widgets -->
              <template v-else-if="fieldDef.type === 'void'">
                <template v-if="fieldDef.widget === 'Divider'">
                  <Divider :style="{ margin: '4px 0' }" />
                </template>
                <template v-else-if="fieldDef.widget === 'ButtonGroup'">
                  <ButtonGroupWidget v-bind="{ ...widgetProps, schema: fieldDef }" />
                </template>
              </template>

              <!-- Color fields: group consecutive colors into one row -->
              <template v-else-if="fieldDef.type === 'string' && fieldDef.widget === 'color'">
                <!-- Skip if previous sibling was also color (already rendered as pair) -->
                <template v-if="!isPrevFieldColor(fieldKey)">
                  <Row :gutter="8">
                    <Col :span="getNextFieldColor(fieldKey) ? 12 : 24">
                      <Form.Item :label="fieldDef.title || String(fieldKey)">
                        <div :style="{ display: 'flex', alignItems: 'center', gap: '4px' }">
                          <div :style="{
                            position: 'relative', width: '28px', height: '24px', flexShrink: 0,
                            border: '1px solid #d9d9d9', borderRadius: '2px', overflow: 'hidden',
                            background: (formValues as any)[fieldKey] || '#fff',
                          }">
                            <input type="color"
                              :value="(formValues as any)[fieldKey] || '#ffffff'"
                              @input="(e: any) => updateField(String(fieldKey), e.target.value)"
                              :style="{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer', border: 'none' }"
                            />
                          </div>
                          <Input
                            :value="(formValues as any)[fieldKey] || ''"
                            placeholder=""
                            :style="{ flex: 1 }"
                            @change="(e: any) => updateField(String(fieldKey), e.target.value || '')"
                          />
                        </div>
                      </Form.Item>
                    </Col>
                    <!-- Pair: next color field on same row -->
                    <Col v-if="getNextFieldColor(fieldKey)" :span="12">
                      <Form.Item :label="getNextFieldColor(fieldKey)!.def.title || getNextFieldColor(fieldKey)!.key">
                        <div :style="{ display: 'flex', alignItems: 'center', gap: '4px' }">
                          <div :style="{
                            position: 'relative', width: '28px', height: '24px', flexShrink: 0,
                            border: '1px solid #d9d9d9', borderRadius: '2px', overflow: 'hidden',
                            background: (formValues as any)[getNextFieldColor(fieldKey)!.key] || '#fff',
                          }">
                            <input type="color"
                              :value="(formValues as any)[getNextFieldColor(fieldKey)!.key] || '#ffffff'"
                              @input="(e: any) => updateField(getNextFieldColor(fieldKey)!.key, e.target.value)"
                              :style="{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer', border: 'none' }"
                            />
                          </div>
                          <Input
                            :value="(formValues as any)[getNextFieldColor(fieldKey)!.key] || ''"
                            placeholder=""
                            :style="{ flex: 1 }"
                            @change="(e: any) => updateField(getNextFieldColor(fieldKey)!.key, e.target.value || '')"
                          />
                        </div>
                      </Form.Item>
                    </Col>
                  </Row>
                </template>
              </template>

              <!-- String field (non-color) -->
              <template v-else-if="fieldDef.type === 'string'">
                <Row :gutter="8">
                  <Col :span="fieldDef.span || 24">
                    <Form.Item :label="fieldDef.title || String(fieldKey)">
                      <Select
                        v-if="fieldDef.widget === 'select'"
                        :value="(formValues as any)[fieldKey]"
                        :options="(fieldDef.props?.options || []).map((o: any) => typeof o === 'string' ? { label: o, value: o } : { ...o, label: o.label || o.value })"
                        :style="{ width: '100%' }"
                        @change="(val: any) => updateField(String(fieldKey), val)"
                      />
                      <Input
                        v-else
                        :value="(formValues as any)[fieldKey]"
                        @change="(e: any) => updateField(String(fieldKey), e.target.value)"
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </template>

              <!-- Number field -->
              <template v-else-if="fieldDef.type === 'number'">
                <Row :gutter="8">
                  <Col :span="fieldDef.span || 24">
                    <Form.Item :label="fieldDef.title || String(fieldKey)">
                      <InputNumber
                        :value="(formValues as any)[fieldKey]"
                        :min="fieldDef.min ?? fieldDef.props?.min"
                        :max="fieldDef.max ?? fieldDef.props?.max"
                        :step="fieldDef.props?.step ?? 1"
                        :disabled="fieldDef.disabled"
                        :style="{ width: '100%' }"
                        @change="(val: any) => updateField(String(fieldKey), val)"
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </template>

              <!-- Boolean field (plain, no custom widget) -->
              <template v-else-if="fieldDef.type === 'boolean'">
                <Row :gutter="8">
                  <Col :span="fieldDef.span || 24">
                    <Form.Item :label="fieldDef.title || String(fieldKey)">
                      <Switch
                        :checked="(formValues as any)[fieldKey]"
                        @change="(val: any) => updateField(String(fieldKey), val)"
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </template>

              <!-- Object field (nested) -->
              <template v-else-if="fieldDef.type === 'object' && fieldDef.properties">
                <div :style="{ marginBottom: '8px' }">
                  <Text v-if="fieldDef.title" :style="{ fontSize: '12px', fontWeight: 600 }">{{ fieldDef.title }}</Text>
                  <Row :gutter="8">
                    <template v-for="(subDef, subKey) in fieldDef.properties" :key="subKey">
                      <Col v-if="!isHidden(subDef)" :span="subDef.span || 12">
                        <Form.Item :label="subDef.title || String(subKey)">
                          <InputNumber
                            v-if="subDef.type === 'number'"
                            :value="((formValues as any)[fieldKey] as any)?.[subKey]"
                            :min="subDef.min ?? subDef.props?.min"
                            :max="subDef.max ?? subDef.props?.max"
                            :step="subDef.props?.step ?? 1"
                            :style="{ width: '100%' }"
                            @change="(val: any) => updateField(`${String(fieldKey)}.${String(subKey)}`, val)"
                          />
                          <Select
                            v-else-if="subDef.widget === 'select'"
                            :value="((formValues as any)[fieldKey] as any)?.[subKey]"
                            :options="(subDef.props?.options || []).map((o: any) => typeof o === 'string' ? { label: o, value: o } : { ...o, label: o.label || o.value })"
                            :style="{ width: '100%' }"
                            @change="(val: any) => updateField(`${String(fieldKey)}.${String(subKey)}`, val)"
                          />
                          <div v-else-if="subDef.widget === 'color'" :style="{ display: 'flex', alignItems: 'center', gap: '4px' }">
                            <div :style="{
                              position: 'relative', width: '32px', height: '24px', flexShrink: 0,
                              border: '1px solid #d9d9d9', borderRadius: '4px', overflow: 'hidden',
                              background: ((formValues as any)[fieldKey] as any)?.[subKey] || '#fff',
                            }">
                              <input type="color"
                                :value="((formValues as any)[fieldKey] as any)?.[subKey] || '#ffffff'"
                                @input="(e: any) => updateField(`${String(fieldKey)}.${String(subKey)}`, e.target.value)"
                                :style="{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer', border: 'none' }"
                              />
                            </div>
                            <Input
                              :value="((formValues as any)[fieldKey] as any)?.[subKey] || ''"
                              placeholder=""
                              :style="{ flex: 1 }"
                              @change="(e: any) => updateField(`${String(fieldKey)}.${String(subKey)}`, e.target.value || '')"
                            />
                          </div>
                          <Input
                            v-else
                            :value="((formValues as any)[fieldKey] as any)?.[subKey]"
                            @change="(e: any) => updateField(`${String(fieldKey)}.${String(subKey)}`, e.target.value)"
                          />
                        </Form.Item>
                      </Col>
                    </template>
                  </Row>
                </div>
              </template>
            </template>
          </template>
        </template>
      </Form>
    </div>
  </div>
</template>
