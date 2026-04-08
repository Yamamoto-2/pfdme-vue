import { watch, onMounted, onBeforeUnmount, type Ref } from 'vue';
import type { Size } from '@pdfme/common';
import { ZOOM } from '@pdfme/common';
import { RULER_HEIGHT } from '../constants';

export function useScrollPageCursor(props: {
  containerRef: Ref<HTMLDivElement | null>;
  pageSizes: Ref<Size[]>;
  scale: () => number;
  pageCursor: Ref<number>;
  onChangePageCursor: (page: number) => void;
}) {
  let scrollHandler: (() => void) | null = null;

  const setupScroll = () => {
    const node = props.containerRef.value;
    if (scrollHandler && node) {
      node.removeEventListener('scroll', scrollHandler);
    }

    scrollHandler = () => {
      const el = props.containerRef.value;
      if (!props.pageSizes.value[0] || !el) return;

      const scroll = el.scrollTop;
      const { top } = el.getBoundingClientRect();
      const currentScale = props.scale();

      const pageHeights = props.pageSizes.value.reduce((acc, cur, i) => {
        let value = (cur.height * ZOOM + RULER_HEIGHT) * currentScale;
        if (i === 0) {
          value += top - value / 2;
        } else {
          value += acc[i - 1];
        }
        return acc.concat(value);
      }, [] as number[]);

      let _pageCursor = 0;
      pageHeights.forEach((ph, i) => {
        if (scroll > ph) {
          _pageCursor = i + 1 >= pageHeights.length ? pageHeights.length - 1 : i + 1;
        }
      });

      if (_pageCursor !== props.pageCursor.value) {
        props.onChangePageCursor(_pageCursor);
      }
    };

    if (node) {
      node.addEventListener('scroll', scrollHandler);
    }
  };

  onMounted(setupScroll);

  watch([props.containerRef, props.pageSizes, props.pageCursor], setupScroll);

  onBeforeUnmount(() => {
    const node = props.containerRef.value;
    if (scrollHandler && node) {
      node.removeEventListener('scroll', scrollHandler);
    }
  });
}
