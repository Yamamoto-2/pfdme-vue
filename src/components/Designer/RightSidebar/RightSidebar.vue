<script setup lang="ts">
import { computed, inject } from 'vue';
import type { SidebarProps } from '../../../types';
import { Button } from 'ant-design-vue';
import { ArrowLeft, ArrowRight } from 'lucide-vue-next';
import { RIGHT_SIDEBAR_WIDTH, DESIGNER_CLASSNAME } from '../../../constants';
import ListView from './ListView/ListView.vue';
import DetailView from './DetailView/DetailView.vue';

const props = defineProps<SidebarProps>();
defineEmits<{ (e: 'deleteSchema', id: string): void }>();

const getActiveSchemas = () =>
  props.schemas.filter((s) => props.activeElements.map((ae) => ae.id).includes(s.id));

const getLastActiveSchema = () => {
  const activeSchemas = getActiveSchemas();
  return activeSchemas.length > 0 ? activeSchemas[activeSchemas.length - 1] : null;
};

const hasActiveSchemas = computed(() => getActiveSchemas().length > 0);
const lastActiveSchema = computed(() => getLastActiveSchema());
</script>

<template>
  <div
    :class="DESIGNER_CLASSNAME + 'right-sidebar'"
    :style="{
      position: 'absolute',
      right: 0,
      zIndex: 1,
      height: '100%',
      width: sidebarOpen ? RIGHT_SIDEBAR_WIDTH + 'px' : 0,
    }"
  >
    <!-- Toggle Button -->
    <Button
      :class="DESIGNER_CLASSNAME + 'sidebar-toggle'"
      :style="{
        position: 'absolute',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        top: '14px',
        right: '16px',
        paddingTop: '2px',
        zIndex: 100,
      }"
      @click="setSidebarOpen(!sidebarOpen)"
    >
      <ArrowRight v-if="sidebarOpen" :stroke-width="1.5" :size="20" />
      <ArrowLeft v-else :stroke-width="1.5" :size="20" />
    </Button>

    <!-- Sidebar Content -->
    <div
      :style="{
        width: RIGHT_SIDEBAR_WIDTH + 'px',
        height: '100%',
        display: sidebarOpen ? 'flex' : 'none',
        top: 0,
        right: 0,
        position: 'absolute',
        fontFamily: `'Open Sans', sans-serif`,
        boxSizing: 'border-box',
        background: 'var(--ant-color-bg-layout, #f5f5f5)',
        borderLeft: '1px solid var(--ant-color-split, #f0f0f0)',
      }"
    >
      <ListView
        v-if="!hasActiveSchemas"
        :schemas="schemas"
        :onSortEnd="onSortEnd"
        :onEdit="onEdit"
        :hoveringSchemaId="hoveringSchemaId"
        :onChangeHoveringSchemaId="onChangeHoveringSchemaId"
        :changeSchemas="changeSchemas"
      />
      <DetailView
        v-else-if="lastActiveSchema"
        :size="size"
        :schemas="schemas"
        :schemasList="schemasList"
        :pageSize="pageSize"
        :basePdf="basePdf"
        :changeSchemas="changeSchemas"
        :activeElements="activeElements"
        :deselectSchema="deselectSchema"
        :activeSchema="lastActiveSchema"
        @deleteSchema="(id: string) => $emit('deleteSchema', id)"
      />
    </div>
  </div>
</template>
