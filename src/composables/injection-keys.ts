import type { InjectionKey } from 'vue';
import type { Font, PluginRegistry, UIOptions, Dict } from '@pdfme/common';

export const I18nKey: InjectionKey<(key: keyof Dict) => string> = Symbol('I18nContext');

export const FontKey: InjectionKey<Font> = Symbol('FontContext');

export const PluginsRegistryKey: InjectionKey<PluginRegistry> = Symbol('PluginsRegistry');

export const OptionsKey: InjectionKey<UIOptions> = Symbol('OptionsContext');

export const CacheKey: InjectionKey<Map<string | number, unknown>> = Symbol('CacheContext');
