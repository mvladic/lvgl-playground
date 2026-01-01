# LVGL Playground - Development Context

## Project Overview

This is an interactive playground for **EEZ Script**, a TypeScript-inspired scripting language that compiles to JavaScript and C for use with LVGL (Light and Versatile Graphics Library) v9.2.2 compiled to WebAssembly.

## EEZ Script Language

### Type System

EEZ Script supports the following types:
- `number` - JavaScript numbers (integers and floats)
- `bool` - Boolean values (`true`/`false`)
- `string` - JavaScript strings (for display/debugging)
- `cstring` - C-style null-terminated strings (pointers to UTF-8 in WASM memory)
- `lv_obj` - LVGL object handles (32-bit integers representing object pointers)
- `lv_color` - LVGL color values (32-bit color structs)

### Implicit Type Conversions

The language implements automatic type conversions:

1. **string → cstring**: When passing a string to an LVGL function expecting `cstring`, it's automatically converted using `System.stringToNewUTF8()`

2. **number → lv_color**: When passing a number to a function expecting `lv_color`, it's automatically wrapped with `lv_color_hex()`. Example:
   ```typescript
   lv_led_set_color(led, 0xFF0000)  // Auto-converts to lv_color_hex(0xFF0000)
   ```

These conversions work across all three execution modes: interpreter, JavaScript emission, and C emission.

### Function Declaration Syntax

```typescript
function function_name(param1: type1, param2: type2): return_type {
    let variable: type = value;
    // function body
    return result;
}
```

## Technical Implementation Details

### Color Handling (CRITICAL)

LVGL's `lv_color_hex()` uses **sret calling convention** (structure return) on WASM:
- Takes a pointer as first parameter where result is written
- Returns that same pointer
- Must allocate buffer ONCE per LVGL instance and reuse it

**Implementation in emitJS:**
```javascript
let led_color = (() => { 
    if (!lvgl._colorBuffer) lvgl._colorBuffer = lvgl._lv_malloc(4); 
    lvgl._lv_color_hex(lvgl._colorBuffer, color); 
    return lvgl._colorBuffer; 
})();
```

**Key points:**
- Single buffer per `lvgl` instance stored as `lvgl._colorBuffer`
- Allocated once on first use with `lv_malloc(4)` (4 bytes for color struct)
- Reused for all subsequent color conversions
- Works correctly with multiple LVGL contexts (each has its own buffer)

### Compiler Architecture

The `eez-script.js` file contains:

1. **Lexer** - Tokenizes source code
2. **Parser** - Builds AST (Abstract Syntax Tree)
3. **Type Checker** - Validates types and enables implicit conversions
4. **Interpreter** - Direct execution mode
5. **JS Emitter** - Generates JavaScript code
6. **C Emitter** - Generates C code

### Type Checking for Implicit Conversions

Key function: `getArgumentDeclaredType(func, argIndex, allowedFunctions)`

This determines the expected type for function arguments by:
1. Checking if function exists in `allowedFunctions` whitelist
2. Looking up parameter type at the given argument index
3. Enabling the compiler to insert automatic conversion wrappers

Used in `visitCallExpression()` to wrap arguments with conversion functions when types don't match but conversion is possible.

## Playground Features

### UI Components

- **Code Editor** (textarea): Write EEZ Script with syntax highlighting via CSS
- **Preview Tabs**: 
  - Canvas - Live LVGL rendering
  - JavaScript - Generated JS code
  - C - Generated C code
- **Examples Dropdown**: 10 pre-built example scripts
- **Run Button**: Compile and execute current script
- **LocalStorage**: Auto-saves code between sessions

### Example Scripts

Located in `EXAMPLE_SCRIPTS` object in `index.html`:
1. Hello World - Basic label
2. Button - Interactive button with label
3. Slider - Range input widget
4. Dashboard - Complex multi-widget layout
5. LED Colors - Color demonstration
6. Arc Gauge - Circular progress widget
7. Switch - Toggle widget
8. Checkbox - Checkbox widget
9. Dropdown - Selection widget
10. Simple - Minimal example

### Global Variables

- `lvgl` - Reference to WASM module instance (set in `onWasmLoaded`)
- `LVGL_CONSTANTS` - Object with all LVGL constants (LV_ALIGN_CENTER, etc.)
- `allowedFunctions` - Whitelist of 170+ LVGL functions with type signatures

### Initialization Flow

1. Load WASM module (`lvgl_runtime_v9.2.2.js`)
2. `onWasmLoaded()` callback fires
3. Set `lvgl = wasm` (global reference)
4. Initialize examples dropdown
5. Load saved script from localStorage or default example
6. Canvas setup for LVGL rendering
7. Start main loop for frame updates

## File Structure

- `index.html` - Main UI and orchestration
- `eez-script.js` - Complete EEZ Script compiler/interpreter
- `allowed_functions.js` - LVGL function signatures (optional, duplicated in HTML)
- `test-eez-script.js` - Unit tests for compiler
- `run.sh` - Development server launcher
- `package.json` - NPM scripts

## WASM Integration

The playground expects LVGL WASM runtime at `/wasm/lvgl_runtime_v9.2.2.js` (virtual mount point).

When running with live-server:
```bash
npx live-server --mount=/wasm:../studio-wasm-libs/release/wasm
```

## Key Design Decisions

### Why Implicit Conversions?

Makes API more ergonomic. Compare:
```typescript
// Without implicit conversion (verbose)
lv_led_set_color(led, lv_color_hex(0xFF0000))

// With implicit conversion (clean)
lv_led_set_color(led, 0xFF0000)
```

### Why Single Color Buffer?

- **Memory efficiency**: Only 4 bytes allocated per LVGL instance
- **Correctness**: Struct returned by `lv_color_hex()` must remain valid until used
- **Performance**: No repeated allocations
- **Multi-instance safe**: Each LVGL context has independent buffer

### Why Three Execution Modes?

1. **Interpreter**: Fast iteration, debugging
2. **JavaScript**: Deploy in browser, inspect generated code
3. **C**: Embedded targets, MCU deployment

## Common Issues & Solutions

### Issue: Dropdown not populating
**Cause**: `initExamples()` called before `lvgl` global was set  
**Solution**: Move `initExamples()` and `loadSavedScript()` into `onWasmLoaded()`

### Issue: Color buffer undefined
**Cause**: Using global `window._lvColorBuf` doesn't work with multiple instances  
**Solution**: Use `lvgl._colorBuffer` (instance property)

### Issue: Syntax errors in allowedFunctions
**Cause**: Mixed EEZ Script code with JavaScript object definition  
**Solution**: Keep allowedFunctions as pure JSON-like object with function signatures

## Testing

Run compiler tests:
```bash
node test-eez-script.js
```

## Future Enhancements

Potential improvements:
- Syntax highlighting in editor (CodeMirror/Monaco)
- Error highlighting with line numbers
- Autocomplete for LVGL functions
- More type conversions (arrays, structs)
- Event handlers / callbacks
- Animation support
- Multi-file projects
- Export to standalone HTML
- Share scripts via URL

## Related Projects

- **studio-wasm-libs** - LVGL WASM builds and EEZ framework
- **LVGL** - https://lvgl.io - Graphics library
- **Emscripten** - C/C++ to WebAssembly compiler

## Development History

Originally developed in `studio-wasm-libs/scripts/test`, moved to standalone project January 2026. Major features implemented:
- lv_color type and implicit conversions
- Interactive playground with examples
- localStorage persistence
- Multi-tab output display
- Comprehensive function whitelist
