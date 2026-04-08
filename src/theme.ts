// Theme configuration compatible with ant-design-vue ConfigProvider
// Mirrors the original @pdfme/ui theme but uses ant-design-vue's ThemeConfig format
export interface ThemeConfig {
  token?: {
    colorPrimary?: string;
    [key: string]: unknown;
  };
  components?: {
    Form?: {
      fontSize?: number;
      margin?: number;
      marginLG?: number;
      marginXS?: number;
      padding?: number;
      paddingLG?: number;
      paddingXS?: number;
      itemMarginBottom?: number;
      verticalLabelPadding?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export const defaultTheme: ThemeConfig = {
  token: {
    colorPrimary: '#38a0ff',
  },
  components: {
    Form: {
      fontSize: 12,
      margin: 8,
      marginLG: 12,
      marginXS: 4,
      padding: 8,
      paddingLG: 12,
      paddingXS: 4,
      itemMarginBottom: 4,
      verticalLabelPadding: '0 0 2px',
    },
  },
};
