# pdfme-vue

A Vue 3 port of [`@pdfme/ui`](https://github.com/pdfme/pdfme) — the PDF template **Designer**, **Form**, and **Viewer** — with full schema and plugin compatibility with the original pdfme ecosystem.

If you already use `@pdfme/common`, `@pdfme/schemas`, `@pdfme/generator` in a Vue app, this package lets you drop in the editor UI without pulling in React, antd, `@dnd-kit`, `react-moveable`, and the rest of the React toolchain.

```bash
npm install pdfme-vue @pdfme/common @pdfme/schemas @pdfme/generator
```

> **Status**: early release (0.1.x). Core Designer / Form / Viewer work; the JSON-schema-driven property panel is simplified compared to the original's `form-render` and is on the roadmap.

---

## Features

- **Drop-in replacement** for `@pdfme/ui` in Vue apps — same `Designer` / `Form` / `Viewer` classes, same constructor signature, same `template` / `plugins` / `inputs` contract.
- **100% template compatibility** — templates authored in `@pdfme/ui` render identically here, and vice versa. All `@pdfme/schemas` plugins (text, image, barcodes, shapes, tables, etc.) work without changes.
- **Framework-agnostic packages reused** — `@pdfme/common`, `@pdfme/schemas`, `@pdfme/converter`, `@pdfme/generator` are consumed as-is via npm (peer deps, not vendored).
- **Vue 3 native** — Composition API, `provide`/`inject`, reactive state.
- **Single package** — only the UI layer is rewritten; nothing else is forked.

---

## Quick start

```ts
import { Designer } from 'pdfme-vue';
import { text, image, barcodes } from '@pdfme/schemas';
import type { Template } from '@pdfme/common';

const template: Template = {
  basePdf: { width: 210, height: 297, padding: [20, 20, 20, 20] },
  schemas: [[
    { name: 'title', type: 'text', position: { x: 20, y: 20 }, width: 100, height: 10, content: 'Hello' },
    { name: 'qr',    type: 'qrcode', position: { x: 20, y: 40 }, width: 40,  height: 40, content: 'https://example.com' },
  ]],
};

const designer = new Designer({
  domContainer: document.getElementById('container')!,
  template,
  plugins: { Text: text, Image: image, QR: barcodes.qrcode },
});

designer.onChangeTemplate((t) => console.log('template changed', t));
```

`Form` and `Viewer` have the same shape (plus an `inputs` array):

```ts
import { Form, Viewer } from 'pdfme-vue';

const form   = new Form  ({ domContainer, template, plugins, inputs: [{ title: 'Hi' }] });
const viewer = new Viewer({ domContainer, template, plugins, inputs: [{ title: 'Hi' }] });
```

Generate the actual PDF with `@pdfme/generator`:

```ts
import { generate } from '@pdfme/generator';

const pdf = await generate({ template, inputs: form.getInputs(), plugins });
```

---

## How this differs from `@pdfme/ui` (the React implementation)

[pdfme](https://github.com/pdfme/pdfme) is an 8-package monorepo. Only **one** package — `@pdfme/ui` — is tied to React. Everything else (`common`, `schemas`, `converter`, `generator`, `manipulator`, `pdf-lib`, `cli`) is framework-agnostic plain TypeScript. This is what makes a Vue port practical: you only need to rewrite the UI layer.

### Architecture

```
┌───────────────────────────────────────────────────────────┐
│  Your app                                                  │
├───────────────────────────────────────────────────────────┤
│  @pdfme/ui (React)       OR      pdfme-vue (Vue 3)        │
│  ─────────────────               ──────────────────        │
│  React 18 + antd                 Vue 3 + ant-design-vue    │
│  @dnd-kit                        HTML5 DnD API             │
│  react-moveable                  moveable (vanilla)        │
│  react-selecto                   selecto (vanilla)         │
│  form-render                     custom panel (simplified) │
│  React Context                   provide/inject            │
├───────────────────────────────────────────────────────────┤
│  @pdfme/common     @pdfme/schemas    @pdfme/converter     │  ← shared, unchanged
│  @pdfme/generator  @pdfme/manipulator   @pdfme/pdf-lib    │
└───────────────────────────────────────────────────────────┘
```

### Why plugins work unchanged

`@pdfme/schemas` plugins implement `ui(arg)` and `pdf(arg)` with a plain `HTMLDivElement` as the mount target — no React, no Vue. They already draw to the DOM imperatively:

```ts
// Excerpt from a schemas plugin (runs the same in either host)
const plugin: Plugin<MySchema> = {
  ui: async ({ schema, rootElement, value }) => {
    rootElement.innerHTML = `<span>${value}</span>`;
  },
  pdf: async (arg) => { /* draw into pdf-lib PDFPage */ },
  propPanel: { /* JSON-schema-ish config */ },
};
```

`pdfme-vue` hands the plugin the exact same `rootElement`, so every existing schema plugin (including custom ones) runs byte-identical.

### Mapping of React-specific deps

| Concern                  | `@pdfme/ui` (React)             | `pdfme-vue`                   |
|--------------------------|----------------------------------|-------------------------------|
| Component model          | React 18 + TSX                   | Vue 3 Composition API + SFC   |
| UI kit                   | `antd`                           | `ant-design-vue`              |
| Drag-and-drop list       | `@dnd-kit/*`                     | `vuedraggable` / HTML5 DnD    |
| Element transform        | `react-moveable`                 | `moveable` (vanilla)          |
| Multi-select             | `react-selecto`                  | `selecto` (vanilla)           |
| Icons                    | `lucide-react`                   | `lucide-vue-next`             |
| Property panel           | `form-render`                    | Custom (simplified — roadmap) |
| Context                  | `React.createContext`            | `provide` / `inject`          |
| Hooks                    | `useState` / `useEffect` / etc.  | `ref` / `computed` / `watch`  |

### Deliberately 1:1

- `Designer` / `Form` / `Viewer` class names and method signatures (`updateTemplate`, `getTemplate`, `onChangeTemplate`, `onSaveTemplate`, `onPageChange`, `getInputs`, `setInputs`, `destroy`, …).
- `props` shape: `domContainer`, `template`, `plugins`, `inputs`, `options`.
- Template JSON format (`basePdf`, `schemas`, `pdfmeVersion`, …).
- Event payloads.

You can copy templates back and forth between the two UIs — the same JSON round-trips through both.

---

## Playground

```bash
cd playground
npm install
npm run dev
```

Open the printed URL. The playground shows the Designer / Form / Viewer modes, import/export JSON, and a **Generate PDF** button that calls `@pdfme/generator`.

---

## Known issue: barcodes fail to render with `bwip-js@4.9.0`

If you see this in the browser console and all barcodes render as red error boxes (and come out blank in the generated PDF):

```
[@pdfme/ui] ReferenceError: bwipp_setanycolor is not defined
```

**This is an upstream bug in `bwip-js@4.9.0`** — `bwipp.mjs` calls `bwipp_setanycolor()` but never defines or exports it. It is **not** specific to `pdfme-vue`; the original `@pdfme/ui` is affected the same way when npm resolves to `4.9.0`. It has been fixed in `bwip-js@4.9.1` and later.

`@pdfme/schemas` depends on `bwip-js` with range `^4.9.0`, so fresh installs can pin to the broken `4.9.0` via lockfile.

### Fix (consuming app's `package.json`)

npm:

```jsonc
{
  "overrides": {
    "bwip-js": "^4.9.2"
  }
}
```

yarn:

```jsonc
{
  "resolutions": {
    "bwip-js": "^4.9.2"
  }
}
```

pnpm:

```jsonc
{
  "pnpm": {
    "overrides": {
      "bwip-js": "^4.9.2"
    }
  }
}
```

After editing, run `npm install` (or yarn / pnpm equivalent) and restart the dev server. If you use Vite, also clear `node_modules/.vite` so the pre-bundled deps are re-optimized.

---

## Development

```bash
# build the library (writes to ./dist)
npm run build

# watch mode for library dev
npm run dev

# type-check only
npm run type-check

# run playground against local source (alias set up in playground/vite.config.ts)
cd playground && npm install && npm run dev
```

The library is built with Vite in lib mode (ES only), CSS injected by JS, source maps on, minification off for readable stack traces. External peer deps (`@pdfme/common`, `@pdfme/schemas`, `@pdfme/converter`, `@pdfme/generator`, `vue`, `ant-design-vue`) are not bundled.

### Project layout

```
pdfme-vue/
├── src/
│   ├── Designer.ts        # class — same API as @pdfme/ui's Designer
│   ├── Form.ts
│   ├── Viewer.ts
│   ├── class.ts           # BaseUIClass (mount / destroy / plugin registry)
│   ├── components/        # Vue SFCs
│   ├── composables/       # Vue equivalents of React hooks
│   ├── i18n.ts            # translations
│   └── index.ts           # public exports: Designer, Form, Viewer
├── playground/            # Vue 3 app that aliases 'pdfme-vue' → ../src
├── LICENSE
├── package.json
└── vite.config.mts
```

---

## Roadmap

- [ ] Full JSON-schema property panel (replace the simplified panel with a `form-render`-equivalent for Vue) so every plugin's `propPanel` renders identically to `@pdfme/ui`.
- [ ] Publish to npm (`pdfme-vue`).
- [ ] CI: build, type-check, snapshot tests against fixture templates.
- [ ] Visual parity tests against `@pdfme/ui` using shared template fixtures.
- [ ] Document custom-plugin authoring for Vue consumers (same as pdfme, but with examples).

Contributions welcome.

---

## License

MIT — see [LICENSE](./LICENSE).

This project is a ground-up Vue 3 rewrite of the UI layer of [pdfme/pdfme](https://github.com/pdfme/pdfme) (© HandDot, MIT). The upstream `@pdfme/common`, `@pdfme/schemas`, `@pdfme/converter`, and `@pdfme/generator` packages are consumed as normal npm dependencies and are **not** redistributed in this package.

## Acknowledgements

- [pdfme](https://github.com/pdfme/pdfme) — the original TypeScript + React implementation that defines the template format, plugin contract, and the `Designer` / `Form` / `Viewer` API that this port mirrors.
- All the framework-agnostic libraries that made the port straightforward: `moveable`, `selecto`, `ant-design-vue`, `lucide-vue-next`.
