<script setup lang="ts">
import { ref, inject } from 'vue';
import type { SchemaForUI, ChangeSchemas } from '@pdfme/common';
import { Input, Typography, Button, Divider } from 'ant-design-vue';
import { I18nKey, PluginsRegistryKey } from '../../../../composables/injection-keys';
import { DESIGNER_CLASSNAME } from '../../../../constants';
import ListItem from './ListItem.vue';
import PluginIcon from '../../PluginIcon.vue';
import { SIDEBAR_H_PADDING_PX, SIDEBAR_V_PADDING_PX, SIDEBAR_HEADER_HEIGHT } from '../layout';

const { Text } = Typography;
const { TextArea } = Input;

const props = defineProps<{
  schemas: SchemaForUI[];
  onSortEnd: (sortedSchemas: SchemaForUI[]) => void;
  onEdit: (id: string) => void;
  hoveringSchemaId: string | null;
  onChangeHoveringSchemaId: (id: string | null) => void;
  changeSchemas: ChangeSchemas;
}>();

const i18n = inject(I18nKey, (key: string) => key);
const pluginsRegistry = inject(PluginsRegistryKey)!;

const isBulkMode = ref(false);
const fieldNamesValue = ref('');

const startBulk = () => {
  fieldNamesValue.value = props.schemas.map((s) => s.name).join('\n');
  isBulkMode.value = true;
};

const commitBulk = () => {
  const names = fieldNamesValue.value.split('\n');
  if (names.length !== props.schemas.length) {
    alert(i18n('errorBulkUpdateFieldName'));
  } else {
    props.changeSchemas(
      names.map((value, index) => ({
        key: 'name',
        value,
        schemaId: props.schemas[index].id,
      })),
    );
    isBulkMode.value = false;
  }
};

const getPlugin = (schema: SchemaForUI) => {
  const [label, plugin] = pluginsRegistry.findWithLabelByType(schema.type);
  return { label, plugin };
};

const getStatus = (schema: SchemaForUI): undefined | 'is-warning' | 'is-danger' => {
  if (!schema.name) return 'is-warning';
  if (props.schemas.find((s) => schema.name && s.name === schema.name && s.id !== schema.id)) return 'is-danger';
  return undefined;
};

const getTitle = (schema: SchemaForUI) => {
  const status = getStatus(schema);
  if (status === 'is-warning') return i18n('plsInputName');
  if (status === 'is-danger') return i18n('fieldMustUniq');
  return i18n('edit');
};

// Drag reorder with native HTML5 DnD
let dragIndex = -1;

const onDragStart = (index: number) => {
  dragIndex = index;
};

const onDragOver = (e: DragEvent) => {
  e.preventDefault();
};

const onDrop = (targetIndex: number) => {
  if (dragIndex < 0 || dragIndex === targetIndex) return;
  const newSchemas = [...props.schemas];
  const [moved] = newSchemas.splice(dragIndex, 1);
  newSchemas.splice(targetIndex, 0, moved);
  props.onSortEnd(newSchemas);
  dragIndex = -1;
};
</script>

<template>
  <div :class="DESIGNER_CLASSNAME + 'list-view'" :style="{ height: '100%', display: 'flex', flex: 1, flexDirection: 'column' }">
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
      <div :style="{ minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }">
        <Text strong :style="{ textAlign: 'center', width: '100%' }">
          {{ i18n('fieldsList') }}
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
      <TextArea
        v-if="isBulkMode"
        wrap="off"
        :value="fieldNamesValue"
        @change="(e: any) => fieldNamesValue = e.target.value"
        :style="{ height: '100%', width: '100%', resize: 'none', lineHeight: '2.75rem' }"
      />
      <ul v-else :style="{ margin: 0, padding: 0, listStyle: 'none', borderRadius: '5px' }">
        <div
          v-for="(schema, index) in schemas"
          :key="schema.id"
          draggable="true"
          @dragstart="onDragStart(index)"
          @dragover="onDragOver"
          @drop="onDrop(index)"
        >
          <ListItem
            :value="schema.name"
            :status="getStatus(schema)"
            :title="getTitle(schema)"
            :required="schema.required"
            :readOnly="schema.readOnly"
            :hovering="schema.id === hoveringSchemaId"
            @click="onEdit(schema.id)"
            @mouseenter="onChangeHoveringSchemaId(schema.id)"
            @mouseleave="onChangeHoveringSchemaId(null)"
          >
            <template #icon>
              <PluginIcon
                v-if="getPlugin(schema).plugin"
                :plugin="getPlugin(schema).plugin!"
                :label="getPlugin(schema).label"
                :size="20"
              />
            </template>
          </ListItem>
        </div>
      </ul>
    </div>

    <!-- Footer -->
    <div
      :style="{
        display: 'flex',
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: SIDEBAR_V_PADDING_PX + 'px',
        padding: SIDEBAR_H_PADDING_PX + 'px',
      }"
    >
      <template v-if="isBulkMode">
        <Button :class="DESIGNER_CLASSNAME + 'bulk-commit'" size="small" type="text" @click="commitBulk">
          <u>{{ i18n('commitBulkUpdateFieldName') }}</u>
        </Button>
        <span>/</span>
        <Button :class="DESIGNER_CLASSNAME + 'bulk-cancel'" size="small" type="text" @click="isBulkMode = false">
          <u>{{ i18n('cancel') }}</u>
        </Button>
      </template>
      <Button v-else :class="DESIGNER_CLASSNAME + 'bulk-update'" size="small" type="text" @click="startBulk">
        <u>{{ i18n('bulkUpdateFieldName') }}</u>
      </Button>
    </div>
  </div>
</template>
