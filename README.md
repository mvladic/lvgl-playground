# LVGL Playground

Interactive playground for testing EEZ Script with LVGL graphics library.

## Features

- **Interactive Code Editor**: Write EEZ Script code with TypeScript-style syntax
- **Live Preview**: See your LVGL UI rendered in real-time on HTML5 Canvas
- **Multiple LVGL Versions**: Support for LVGL 8.4.0, 9.2.2, 9.3.0, and 9.4.0
- **Multiple Output Modes**: View generated JavaScript and C code
- **Comprehensive Help**: Searchable documentation with function descriptions and parameter info
- **Example Scripts**: 10+ pre-built examples demonstrating different LVGL widgets
- **LocalStorage Persistence**: Your code is automatically saved

## LVGL Version Support

The playground supports multiple LVGL versions. Select a version from the dropdown in the toolbar:
- **8.4.0** - Legacy version
- **9.2.2** - Default version
- **9.3.0** - Stable version
- **9.4.0** - Latest features

API data for each version is loaded from JSON files in the `data/` directory.

## EEZ Script Language

EEZ Script is a TypeScript-inspired language with:
- Static typing: `number`, `bool`, `string`, `lv_obj`, `lv_color`
- Implicit conversions: `string` → `cstring`, `number` → `lv_color`
- Function declarations with type annotations
- Access to LVGL functions (version-dependent)

## Quick Start

1. Start the development server:
   ```bash
   npm run dev
   ```
   
   Or manually:
   ```bash
   npx live-server --mount=/wasm:../studio-wasm-libs/release/wasm
   ```

2. Open your browser to `http://localhost:8080`

3. Select an LVGL version from the dropdown (optional)

4. Try the examples from the dropdown or write your own code!

## Example Code

```typescript
function create_button(): lv_obj {
    let screen: lv_obj = lv_obj_create(0);
    let btn: lv_obj = lv_button_create(screen);
    lv_obj_set_pos(btn, 100, 100);
    lv_obj_set_size(btn, 120, 50);
    
    let label: lv_obj = lv_label_create(btn);
    lv_label_set_text(label, "Click Me!");
    lv_obj_set_style_align(label, LV_ALIGN_CENTER, 0);
    
    return screen;
}
```

## Project Structure

```
├── index.html           - Main playground interface
├── src/
│   ├── eez-script.js   - EEZ Script compiler/interpreter
│   ├── lvgl-api.js     - LVGL API manager (multi-version support)
│   ├── examples.js     - Example scripts
│   └── playground.js   - Main application logic
├── data/
│   ├── lvgl-v8.4.0-api.json  - LVGL 8.4.0 API definitions
│   ├── lvgl-v9.2.2-api.json  - LVGL 9.2.2 API definitions
│   ├── lvgl-v9.3.0-api.json  - LVGL 9.3.0 API definitions
│   └── lvgl-v9.4.0-api.json  - LVGL 9.4.0 API definitions
└── wasm/
    └── lvgl_runtime_*.js     - WASM runtime files
```

## WASM Files

The playground requires LVGL WASM runtime files from the `studio-wasm-libs` project.

## License

MIT
