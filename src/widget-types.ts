import type { SchemaForUI, ChangeSchemas, UIOptions, Size, BasePdf } from '@pdfme/common';

/**
 * Local replacement for PropPanelWidgetProps from @pdfme/common.
 * The original extends form-render's WidgetProps which we don't have installed.
 * This type provides the same properties used by widget functions.
 */
export type WidgetProps = {
  rootElement: HTMLDivElement;
  activeSchema: SchemaForUI;
  activeElements: HTMLElement[];
  changeSchemas: ChangeSchemas;
  schemas: SchemaForUI[];
  options: UIOptions;
  theme: Record<string, unknown>;
  i18n: (key: string) => string;
  // form-render WidgetProps fields that plugins may use
  schema?: Record<string, unknown>;
  value?: unknown;
  onChange?: (value: unknown) => void;
  disabled?: boolean;
  readOnly?: boolean;
  // Additional props passed from our DetailView
  size?: Size;
  schemasList?: SchemaForUI[][];
  pageSize?: Size;
  basePdf?: BasePdf;
  deselectSchema?: () => void;
};
