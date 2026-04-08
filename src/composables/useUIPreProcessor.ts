import { ref, watch, onBeforeUnmount } from 'vue';
import type { Template, Size } from '@pdfme/common';
import { ZOOM, getB64BasePdf, b64toUint8Array, isBlankPdf } from '@pdfme/common';
import { pdf2img, pdf2size } from '@pdfme/converter';
import { arrayBufferToBase64 } from '../helper';
import { RULER_HEIGHT } from '../constants';

const getScale = (n: number, paper: number) =>
  Math.floor((n / paper > 1 ? 1 : n / paper) * 100) / 100;

export function useUIPreProcessor(props: {
  template: () => Template;
  size: () => Size;
  zoomLevel: () => number;
  maxZoom: () => number;
}) {
  const backgrounds = ref<string[]>([]);
  const pageSizes = ref<Size[]>([]);
  const scale = ref(0);
  const error = ref<Error | null>(null);
  let isMounted = true;
  let requestId = 0;

  onBeforeUnmount(() => {
    isMounted = false;
  });

  const init = async (prop: { template: Template; size: Size }) => {
    const {
      template: { basePdf, schemas },
      size,
    } = prop;

    let paperWidth: number;
    let paperHeight: number;
    let _backgrounds: string[];
    let _pageSizes: { width: number; height: number }[];

    if (isBlankPdf(basePdf)) {
      const { width, height } = basePdf;
      paperWidth = width * ZOOM;
      paperHeight = height * ZOOM;
      _backgrounds = schemas.map(
        () =>
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdj+P///38ACfsD/QVDRcoAAAAASUVORK5CYII=',
      );
      _pageSizes = schemas.map(() => ({ width, height }));
    } else {
      const _basePdf = await getB64BasePdf(basePdf);
      const uint8Array = b64toUint8Array(_basePdf);
      const createPdfArrayBuffer = () => {
        const buffer = new ArrayBuffer(uint8Array.byteLength);
        new Uint8Array(buffer).set(uint8Array);
        return buffer;
      };

      const [pageSizeBuffer, imageBuffer] = [createPdfArrayBuffer(), createPdfArrayBuffer()];
      const [_pages, imgBuffers] = await Promise.all([
        pdf2size(pageSizeBuffer),
        pdf2img(imageBuffer, { scale: props.maxZoom() }),
      ]);
      _pageSizes = _pages;
      paperWidth = _pageSizes[0].width * ZOOM;
      paperHeight = _pageSizes[0].height * ZOOM;
      _backgrounds = imgBuffers.map(arrayBufferToBase64);
    }

    const _scale = Math.min(
      getScale(size.width, paperWidth),
      getScale(size.height - RULER_HEIGHT, paperHeight),
    );

    return {
      backgrounds: _backgrounds,
      pageSizes: _pageSizes,
      scale: _scale,
    };
  };

  const runInit = async (prop: { template: Template; size: Size }) => {
    const currentRequestId = ++requestId;

    try {
      const result = await init(prop);
      if (!isMounted || currentRequestId !== requestId) {
        return;
      }

      pageSizes.value = result.pageSizes;
      scale.value = result.scale;
      backgrounds.value = result.backgrounds;
      error.value = null;
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      if (isMounted && currentRequestId === requestId) {
        error.value = e;
        console.error('[@pdfme-vue]', e);
      }
    }
  };

  watch(
    [props.template, props.size],
    () => {
      void runInit({ template: props.template(), size: props.size() });
    },
    { immediate: true },
  );

  const refresh = (template: Template) => runInit({ template, size: props.size() });

  return {
    backgrounds,
    pageSizes,
    scale: () => scale.value * props.zoomLevel(),
    error,
    refresh,
  };
}
