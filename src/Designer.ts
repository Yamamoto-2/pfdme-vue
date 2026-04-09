import {
  cloneDeep as _rawCloneDeep,
  Template,
  DesignerProps,
  checkDesignerProps,
  checkTemplate,
  PDFME_VERSION,
} from '@pdfme/common';
import { BaseUIClass } from './class';
import { DESTROYED_ERR_MSG } from './constants';
import AppContextProvider from './components/AppContextProvider.vue';
import DesignerComponent from './components/Designer/DesignerComponent.vue';
import { h } from 'vue';

const cloneDeep = <T>(o: T): T => { try { return _rawCloneDeep(o); } catch { return JSON.parse(JSON.stringify(o)); } };

class Designer extends BaseUIClass {
  private onSaveTemplateCallback?: (template: Template) => void;
  private onChangeTemplateCallback?: (template: Template) => void;
  private onPageChangeCallback?: (pageInfo: { currentPage: number; totalPages: number }) => void;
  private pageCursor: number = 0;

  constructor(props: DesignerProps) {
    super(props);
    checkDesignerProps(props);
    this.render();
  }

  public saveTemplate() {
    if (!this.domContainer) throw Error(DESTROYED_ERR_MSG);
    if (this.onSaveTemplateCallback) {
      this.onSaveTemplateCallback(this.template);
    }
  }

  public updateTemplate(template: Template) {
    checkTemplate(template);
    if (!this.domContainer) throw Error(DESTROYED_ERR_MSG);
    this.template = cloneDeep(template);
    if (this.onChangeTemplateCallback) {
      this.onChangeTemplateCallback(template);
    }
    this.render();
  }

  public onSaveTemplate(cb: (template: Template) => void) {
    this.onSaveTemplateCallback = cb;
  }

  public onChangeTemplate(cb: (template: Template) => void) {
    this.onChangeTemplateCallback = cb;
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
            h(DesignerComponent, {
              template: self.template,
              size: self.size,
              onSaveTemplate: (template: Template) => {
                self.template = template;
                self.template.pdfmeVersion = PDFME_VERSION;
                if (self.onSaveTemplateCallback) {
                  self.onSaveTemplateCallback(template);
                }
              },
              onChangeTemplate: (template: Template) => {
                self.template = template;
                self.template.pdfmeVersion = PDFME_VERSION;
                if (self.onChangeTemplateCallback) {
                  self.onChangeTemplateCallback(template);
                }
              },
              onPageCursorChange: (newPageCursor: number, totalPages: number) => {
                self.pageCursor = newPageCursor;
                if (self.onPageChangeCallback) {
                  self.onPageChangeCallback({
                    currentPage: newPageCursor,
                    totalPages: totalPages,
                  });
                }
              },
            }),
        );
      },
    };

    this.mount(AppWrapper, {});
  }
}

export default Designer;
