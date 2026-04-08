import type { PreviewProps } from '@pdfme/common';
import { PreviewUI } from './class';
import { DESTROYED_ERR_MSG } from './constants';
import Preview from './components/Preview.vue';
import AppContextProvider from './components/AppContextProvider.vue';
import { h } from 'vue';

class Form extends PreviewUI {
  private onChangeInputCallback?: (arg: { index: number; value: string; name: string }) => void;
  private onPageChangeCallback?: (pageInfo: { currentPage: number; totalPages: number }) => void;
  private pageCursor: number = 0;

  constructor(props: PreviewProps) {
    super(props);
  }

  public onChangeInput(cb: (arg: { index: number; value: string; name: string }) => void) {
    this.onChangeInputCallback = cb;
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

  public setInputs(inputs: { [key: string]: string }[]): void {
    const previousInputs = this.getInputs();

    super.setInputs(inputs);

    const changedInputs: Array<{ index: number; name: string; value: string }> = [];

    inputs.forEach((input, index) => {
      const prevInput = previousInputs[index] || {};
      const allKeys = new Set([...Object.keys(input), ...Object.keys(prevInput)]);

      allKeys.forEach((name) => {
        const newValue = input[name];
        const oldValue = prevInput[name];

        if (newValue !== oldValue) {
          changedInputs.push({ index, name, value: newValue });
        }
      });
    });

    changedInputs.forEach((input) => {
      if (this.onChangeInputCallback) {
        this.onChangeInputCallback(input);
      }
    });
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
              onChangeInput: (arg: { index: number; value: string; name: string }) => {
                const { index, value, name } = arg;
                if (self.onChangeInputCallback) {
                  self.onChangeInputCallback({ index, value, name });
                }
                if (self.inputs && self.inputs[index]) {
                  if (self.inputs[index][name] !== value) {
                    self.inputs[index][name] = value;
                    self.render();
                  }
                }
              },
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

export default Form;
