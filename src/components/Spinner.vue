<script setup lang="ts">
import { LoaderCircle } from 'lucide-vue-next';
</script>

<template>
  <div class="pdfme-spinner-container">
    <LoaderCircle :size="50" class="pdfme-spinner-icon" />
  </div>
</template>

<style scoped>
.pdfme-spinner-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--ant-color-primary, #38a0ff);
}

.pdfme-spinner-icon {
  animation: pdfme-spin 1s linear infinite;
}

@keyframes pdfme-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
