import { inject } from 'vue';
import { OptionsKey } from './injection-keys';
import { DEFAULT_MAX_ZOOM } from '../constants';

export function useMaxZoom(): number {
  const options = inject(OptionsKey, {});
  return options.maxZoom ? options.maxZoom / 100 : DEFAULT_MAX_ZOOM;
}
