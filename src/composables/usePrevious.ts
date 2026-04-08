import { ref, watch, type Ref } from 'vue';

export function usePrevious<T>(value: Ref<T>): Ref<T | null> {
  const previous = ref<T | null>(null) as Ref<T | null>;

  watch(value, (_newVal, oldVal) => {
    previous.value = oldVal ?? null;
  });

  return previous;
}
