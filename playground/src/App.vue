<script setup lang="ts">
import { ref, toRaw, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import type { Template } from '@pdfme/common';
import { text, image, barcodes, line, rectangle, ellipse } from '@pdfme/schemas';
import { generate } from '@pdfme/generator';
import { Designer, Form, Viewer } from 'pdfme-vue';
import { blankTemplate, invoiceTemplate, certificateTemplate } from './templates';

const mode = ref<'designer' | 'form' | 'viewer'>('designer');
const currentTemplateName = ref('blank');
const currentTemplate = ref<Template>(blankTemplate);
const importExportJson = ref('');
const showJsonModal = ref(false);
const isImport = ref(false);

const getRawTemplate = () => JSON.parse(JSON.stringify(toRaw(currentTemplate.value))) as Template;

let designerInstance: Designer | null = null;
let formInstance: Form | null = null;
let viewerInstance: Viewer | null = null;

const containerRef = ref<HTMLDivElement>();

const plugins = {
  Text: text,
  Image: image,
  ...barcodes,
  Line: line,
  Rectangle: rectangle,
  Ellipse: ellipse,
};

const destroyAll = () => {
  try { designerInstance?.destroy(); } catch {}
  try { formInstance?.destroy(); } catch {}
  try { viewerInstance?.destroy(); } catch {}
  designerInstance = null;
  formInstance = null;
  viewerInstance = null;
  if (containerRef.value) containerRef.value.innerHTML = '';
};

const mountComponent = async () => {
  destroyAll();
  await nextTick();
  const container = containerRef.value;
  if (!container) return;

  try {
  if (mode.value === 'designer') {
    designerInstance = new Designer({
      domContainer: container,
      template: getRawTemplate(),
      plugins,
    });
    designerInstance.onChangeTemplate((t) => {
      currentTemplate.value = t;
    });
    designerInstance.onSaveTemplate((t) => {
      currentTemplate.value = t;
      alert('Template saved! (Ctrl+S)');
    });
  } else if (mode.value === 'form') {
    formInstance = new Form({
      domContainer: container,
      template: getRawTemplate(),
      plugins,
      inputs: [{}],
    });
    formInstance.onChangeInput((arg) => {
      console.log('Input changed:', arg);
    });
  } else {
    viewerInstance = new Viewer({
      domContainer: container,
      template: getRawTemplate(),
      plugins,
      inputs: [{}],
    });
  }
  } catch (e: any) {
    console.error('[pdfme-vue playground] Mount error:', e);
    if (container) container.innerHTML = `<div style="color:red;padding:20px;font-family:monospace">${e.message}<br><pre>${e.stack}</pre></div>`;
  }
};

const selectTemplate = (name: string) => {
  currentTemplateName.value = name;
  switch (name) {
    case 'blank': currentTemplate.value = blankTemplate; break;
    case 'invoice': currentTemplate.value = invoiceTemplate; break;
    case 'certificate': currentTemplate.value = certificateTemplate; break;
  }
  mountComponent();
};

const exportJson = () => {
  const t = designerInstance?.getTemplate() ?? getRawTemplate();
  importExportJson.value = JSON.stringify(t, null, 2);
  isImport.value = false;
  showJsonModal.value = true;
};

const openImport = () => {
  importExportJson.value = '';
  isImport.value = true;
  showJsonModal.value = true;
};

const doImport = () => {
  try {
    const t = JSON.parse(importExportJson.value) as Template;
    currentTemplate.value = t;
    showJsonModal.value = false;
    mountComponent();
  } catch (e) {
    alert('Invalid JSON: ' + (e as Error).message);
  }
};

const generatePdf = async () => {
  try {
    const t = designerInstance?.getTemplate() ?? getRawTemplate();
    const inputs = formInstance?.getInputs() ?? [{}];
    const pdf = await generate({ template: t, inputs, plugins });
    const blob = new Blob([pdf.buffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    window.open(url);
  } catch (e) {
    alert('PDF generation error: ' + (e as Error).message);
  }
};

watch(mode, () => mountComponent());

onMounted(mountComponent);

onBeforeUnmount(destroyAll);
</script>

<template>
  <div :style="{ display: 'flex', flexDirection: 'column', height: '100vh' }">
    <!-- Toolbar -->
    <div
      :style="{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        background: '#1a1a2e',
        color: '#fff',
        flexShrink: 0,
        flexWrap: 'wrap',
      }"
    >
      <span :style="{ fontWeight: 700, fontSize: '16px', marginRight: '16px' }">pdfme-vue Playground</span>

      <!-- Mode tabs -->
      <div :style="{ display: 'flex', gap: '4px' }">
        <button
          v-for="m in ['designer', 'form', 'viewer']"
          :key="m"
          :style="{
            padding: '6px 16px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            background: mode === m ? '#38a0ff' : '#333',
            color: '#fff',
            fontWeight: mode === m ? 700 : 400,
          }"
          @click="mode = m as any"
        >
          {{ m.charAt(0).toUpperCase() + m.slice(1) }}
        </button>
      </div>

      <div :style="{ width: '1px', height: '24px', background: '#555', margin: '0 8px' }" />

      <!-- Template selector -->
      <select
        :value="currentTemplateName"
        @change="(e: any) => selectTemplate(e.target.value)"
        :style="{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #555', background: '#333', color: '#fff' }"
      >
        <option value="blank">Blank Template</option>
        <option value="invoice">Invoice Template</option>
        <option value="certificate">Certificate Template</option>
      </select>

      <div :style="{ width: '1px', height: '24px', background: '#555', margin: '0 8px' }" />

      <!-- Actions -->
      <button
        :style="{ padding: '6px 16px', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer', background: '#333', color: '#fff' }"
        @click="exportJson"
      >
        Export JSON
      </button>
      <button
        :style="{ padding: '6px 16px', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer', background: '#333', color: '#fff' }"
        @click="openImport"
      >
        Import JSON
      </button>
      <button
        :style="{ padding: '6px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: '#e74c3c', color: '#fff', fontWeight: 700 }"
        @click="generatePdf"
      >
        Generate PDF
      </button>
    </div>

    <!-- Main content -->
    <div ref="containerRef" :style="{ flex: 1, overflow: 'hidden' }" />

    <!-- JSON Modal -->
    <div
      v-if="showJsonModal"
      :style="{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }"
      @click.self="showJsonModal = false"
    >
      <div
        :style="{
          background: '#fff',
          borderRadius: '8px',
          padding: '24px',
          width: '700px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }"
      >
        <h3 :style="{ margin: 0 }">{{ isImport ? 'Import Template JSON' : 'Export Template JSON' }}</h3>
        <textarea
          v-model="importExportJson"
          :readonly="!isImport"
          :style="{
            flex: 1,
            minHeight: '400px',
            fontFamily: 'monospace',
            fontSize: '12px',
            padding: '12px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            resize: 'none',
          }"
        />
        <div :style="{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }">
          <button
            :style="{ padding: '8px 20px', borderRadius: '4px', border: '1px solid #ddd', cursor: 'pointer', background: '#f5f5f5' }"
            @click="showJsonModal = false"
          >
            Close
          </button>
          <button
            v-if="!isImport"
            :style="{ padding: '8px 20px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: '#38a0ff', color: '#fff' }"
            @click="navigator.clipboard.writeText(importExportJson).then(() => alert('Copied!'))"
          >
            Copy to Clipboard
          </button>
          <button
            v-if="isImport"
            :style="{ padding: '8px 20px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: '#27ae60', color: '#fff', fontWeight: 700 }"
            @click="doImport"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
