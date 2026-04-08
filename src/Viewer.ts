import type { PreviewProps } from '@pdfme/common';
import { PreviewUI } from './class';
import { DESTROYED_ERR_MSG } from './constants';
import Preview from './components/Preview.vue';
import AppContextProvider from './components/AppContextProvider.vue';
import { h } from 'vue';

class Viewer extends PreviewUI {
  private onPageChangeCallback?: (pageInfo: { currentPage: number; totalPages: number }) => void;
  private pageCursor: number = 0;

  constructor(props: PreviewProps) {
    super(props);
    this.render();
    console.warn(
      '[@pdfme-vue] Viewer component is deprecated and will be removed in a future version.',
    );
  }

  public onPageChange(cb: (pageInfo: { currentPage: number; totalPages: number }) => void) {
    this.onPageChangeCallback = cb;
  }

  public getPageCursor() {
    return this.pageCursor;
  }

  public getTotalPages() {
    if (!this.domContainer) throw Error(DESTROYED_ERR_MSG);
    return this.template.schemas.length;
  }

  protected render() {
    if (!this.domContainer) throw Error(DESTROYED_ERR_MSG);
    const self = this;

    const AppWrapper = {
      render() {
        return h(
          AppContextProvider,
          {
            lang: self.getLang(),
            font: self.getFont(),
            plugins: self.getPluginsRegistry(),
            options: self.getOptions(),
          },
          () =>
            h(Preview, {
              template: self.template,
              size: self.size,
              inputs: self.inputs,
              onPageChange: (pageInfo: { currentPage: number; totalPages: number }) => {
                self.pageCursor = pageInfo.currentPage;
                if (self.onPageChangeCallback) {
                  self.onPageChangeCallback(pageInfo);
                }
              },
            }),
        );
      },
    };

    this.mount(AppWrapper, {});
  }
}

export default Viewer;
