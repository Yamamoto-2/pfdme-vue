<script setup lang="ts">
import type { Template } from '@pdfme/common';
import { isBlankPdf, replacePlaceholders } from '@pdfme/common';
import Renderer from './Renderer.vue';
import { uuid } from '../helper';

const props = defineProps<{
  template: Template;
  input: Record<string, string>;
  scale: number;
  totalPages: number;
  currentPage: number;
}>();

const getStaticSchemas = () => {
  const { basePdf } = props.template;
  if (!isBlankPdf(basePdf) || !basePdf.staticSchema) return [];
  return basePdf.staticSchema;
};

const getValue = (schema: { name: string; readOnly?: boolean; content?: string }) => {
  if (schema.readOnly) {
    return replacePlaceholders({
      content: schema.content || '',
      variables: {
        ...props.input,
        totalPages: props.totalPages,
        currentPage: props.currentPage,
      },
      schemas: props.template.schemas,
    });
  }
  return schema.content || '';
};
</script>

<template>
  <Renderer
    v-for="schema in getStaticSchemas()"
    :key="schema.name"
    :schema="{ ...schema, id: uuid() }"
    :basePdf="template.basePdf"
    :value="getValue(schema)"
    mode="viewer"
    outline="none"
    :scale="scale"
    :noSelect="true"
    :onChangeHoveringSchemaId="() => {}"
  />
</template>
