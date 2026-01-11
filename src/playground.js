// LVGL Playground - Interactive LVGL script editor and runtime

// Monaco Editor instances
let editor = null;
let jsOutputEditor = null;
let cOutputEditor = null;
let monacoLoaded = false;

// Load Monaco Editor
function initMonacoEditor(initialCode = '') {
    if (editor) {
        // Editor already exists, just set the value
        editor.setValue(initialCode);
        return Promise.resolve(editor);
    }
    
    return new Promise((resolve, reject) => {
        require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }});
        require(['vs/editor/editor.main'], function() {
            // Disable TypeScript diagnostics to prevent false errors
            monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                noSemanticValidation: true,
                noSyntaxValidation: false,
                noSuggestionDiagnostics: true
            });
            
            // Also disable for JavaScript
            monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                noSemanticValidation: true,
                noSyntaxValidation: false,
                noSuggestionDiagnostics: true
            });
            
            const container = document.getElementById('scriptInput');
            
            // Clear the container completely to remove any previous Monaco context
            if (container.hasAttribute('data-keybinding-context')) {
                container.innerHTML = '';
                container.removeAttribute('data-keybinding-context');
            }
            
            editor = monaco.editor.create(container, {
                value: initialCode,
                language: 'typescript',
                theme: 'vs',
                automaticLayout: true,
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'off',
                tabSize: 4,
                insertSpaces: true,
                detectIndentation: false,
                autoClosingBrackets: 'never',
                autoClosingQuotes: 'never',
                autoSurround: 'never'
            });
            
            // Disable spellcheck on the editor's textarea
            const editorElement = editor.getDomNode();
            if (editorElement) {
                const textareas = editorElement.querySelectorAll('textarea');
                textareas.forEach(textarea => {
                    textarea.setAttribute('spellcheck', 'false');
                    textarea.setAttribute('autocomplete', 'off');
                    textarea.setAttribute('autocorrect', 'off');
                    textarea.setAttribute('autocapitalize', 'off');
                });
            }
            
            // Auto-save on content change
            editor.onDidChangeModelContent(() => {
                const code = editor.getValue();
                localStorage.setItem('eez_script_saved', code);
            });
            
            monacoLoaded = true;
            resolve(editor);
        });
    });
}

// Get editor content
function getEditorContent() {
    return editor ? editor.getValue() : '';
}

// Set editor content
function setEditorContent(code) {
    if (editor) {
        editor.setValue(code);
    }
}

// Display errors inline in Monaco Editor
let errorDecorations = [];

function showEditorErrors(errors) {
    if (!editor || !monaco) return;
    
    const model = editor.getModel();
    const markers = errors.map(err => {
        // Use token length from error if available, otherwise default to 10
        let endColumn = err.column ? err.column + (err.length || 10) : 100;
        
        return {
            severity: monaco.MarkerSeverity.Error,
            startLineNumber: err.line || 1,
            startColumn: err.column || 1,
            endLineNumber: err.line || 1,
            endColumn: endColumn,
            message: err.message
        };
    });
    
    monaco.editor.setModelMarkers(model, 'eez-script', markers);
    
    // Add inline decorations to show error text in the editor
    const decorations = errors.map(err => ({
        range: new monaco.Range(err.line || 1, 1, err.line || 1, 1),
        options: {
            isWholeLine: false,
            after: {
                content: ` ❌ ${err.message}`,
                inlineClassName: 'inline-error-decoration'
            }
        }
    }));
    
    errorDecorations = editor.deltaDecorations(errorDecorations, decorations);
}

// Clear editor errors
function clearEditorErrors() {
    if (!editor || !monaco) return;
    const model = editor.getModel();
    monaco.editor.setModelMarkers(model, 'eez-script', []);
    
    // Clear inline decorations
    if (errorDecorations.length > 0) {
        errorDecorations = editor.deltaDecorations(errorDecorations, []);
    }
}

// Initialize output editors (readonly Monaco editors) - called lazily
function initJsOutputEditor() {
    if (jsOutputEditor || !monacoLoaded || !monaco) return;
    
    const container = document.getElementById('jsOutput');
    if (!container || container.offsetParent === null) return; // Skip if not visible
    
    // Check if container already has a Monaco editor
    if (container.hasAttribute('data-monaco-editor-initialized')) return;
    
    // Get pending code if any
    const pendingCode = container.dataset.pendingCode || '';
    
    jsOutputEditor = monaco.editor.create(container, {
        value: pendingCode,
        language: 'javascript',
        theme: 'vs',
        automaticLayout: true,
        readOnly: true,
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'off'
    });
    
    // Mark container as initialized
    container.setAttribute('data-monaco-editor-initialized', 'true');
    
    // Clear pending code
    delete container.dataset.pendingCode;
}

function initCOutputEditor() {
    if (cOutputEditor || !monacoLoaded || !monaco) return;
    
    const container = document.getElementById('cOutput');
    if (!container || container.offsetParent === null) return; // Skip if not visible
    
    // Check if container already has a Monaco editor
    if (container.hasAttribute('data-monaco-editor-initialized')) return;
    
    // Get pending code if any
    const pendingCode = container.dataset.pendingCode || '';
    
    cOutputEditor = monaco.editor.create(container, {
        value: pendingCode,
        language: 'c',
        theme: 'vs',
        automaticLayout: true,
        readOnly: true,
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'off'
    });
    
    // Mark container as initialized
    container.setAttribute('data-monaco-editor-initialized', 'true');
    
    // Clear pending code
    delete container.dataset.pendingCode;
}

// Copy editor content to clipboard
window.copyEditorToClipboard = function() {
    const content = getEditorContent();
    navigator.clipboard.writeText(content).then(() => {
        const btn = document.querySelector('.copy-button');
        btn.textContent = '✓ Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = '📋 Copy';
            btn.classList.remove('copied');
        }, 2000);
    });
};

const DISPLAY_WIDTH = 800;
const DISPLAY_HEIGHT = 480;
const FPS = 60;

canvas.width = DISPLAY_WIDTH;
canvas.height = DISPLAY_HEIGHT;
const ctx = canvas.getContext("2d");

// events
let pointerEvents = [];
let wheelUpdated = false;
let wheelPressed = 0;
let wheelDeltaY = 0;

// Current LVGL version and WASM module
let currentLvglVersion = null;
let wasm = null;
let lvgl = null;
let mainLoopRunning = false;
let loadedScriptVersions = new Set(); // Track which scripts are in the DOM

// Load a WASM runtime script dynamically
function loadWasmScript(version) {
    return new Promise((resolve, reject) => {
        // Reset module for new script
        window.module = {};

        // Remove old script if it exists (we need fresh instantiation each time)
        const oldScript = document.getElementById(`lvgl-wasm-${version}`);
        if (oldScript) {
            oldScript.remove();
        }

        const script = document.createElement('script');
        script.id = `lvgl-wasm-${version}`;
        script.src = `wasm/lvgl_runtime_v${version}.js`;
        script.onload = () => {
            const constructor = window.module["exports"];
            resolve(constructor);
        };
        script.onerror = () => {
            reject(new Error(`Failed to load WASM runtime for version ${version}`));
        };
        document.head.appendChild(script);
    });
}

// Initialize WASM module for a specific version
function initWasmModule(constructor) {
    return new Promise((resolve) => {
        const wasmInstance = constructor(() => {
            resolve(wasmInstance);
        });
    });
}

// Initialize the playground
async function initPlayground() {
    // Get version from URL, localStorage, or default
    const urlParams = new URLSearchParams(window.location.search);
    const version = urlParams.get('version') || localStorage.getItem('lvgl_version') || LvglApi.getDefaultVersion();
    
    try {
        // Initialize LVGL API first
        await LvglApi.init();
        
        // Load and initialize the WASM module
        await loadAndInitWasm(version);
        
        // Initialize playground UI
        initSplitter();
        initHelpSplitter();
        initHelpPanel();
        initExamples();
        initVersionSelector();
        await loadSavedScript();
        initHelp();

        // Auto-run the loaded script
        setTimeout(() => runScript(), 100);
    } catch (error) {
        console.error('Failed to initialize playground:', error);
        showError(`Failed to initialize: ${error.message}`);
    }
}

// Load and initialize WASM for a specific version
async function loadAndInitWasm(version) {
    showStatus(`Loading LVGL v${version}...`);
    
    // Stop current main loop if running and wait for it to stop
    if (mainLoopRunning) {
        mainLoopRunning = false;
        // Wait a bit for the current loop iteration to complete
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Clear any pending pointer events
    pointerEvents = [];
    
    // Clear current script to avoid it running with wrong WASM
    currentScript = null;
    
    // Load the WASM constructor
    const constructor = await loadWasmScript(version);
    
    // Initialize the WASM module
    const newWasm = await initWasmModule(constructor);
    
    // Update globals atomically
    wasm = newWasm;
    lvgl = newWasm;
    
    // Initialize WASM
    wasm._init(
        0, // uint32_t wasmModuleId
        0, // uint32_t debuggerMessageSubsciptionFilter
        0, // uint8_t *assets
        1, // uint32_t assetsSize
        DISPLAY_WIDTH,  // uint32_t displayWidth 
        DISPLAY_HEIGHT, // uint32_t displayHeight
        false, // bool darkTheme
        0, // uint32_t timeZone,
        0  // bool screensLifetimeSupport
    );

    // Set up events if first time
    if (!currentLvglVersion) {
        setupEvents();
    }
    
    // Reset event manager for new WASM instance
    eventManager = new EventManager(wasm);
    
    // Set API version BEFORE starting main loop
    await LvglApi.setVersion(version);
    currentLvglVersion = version;
    localStorage.setItem('lvgl_version', version);
    
    // Start main loop
    mainLoopRunning = true;
    mainLoop();
    
    showStatus(`✓ LVGL v${version} ready`);
}

// Initialize version selector
function initVersionSelector() {
    const select = document.getElementById('versionSelect');
    if (!select) return;

    const versions = LvglApi.getSupportedVersions();
    select.innerHTML = '';
    
    for (const version of versions) {
        const option = document.createElement('option');
        option.value = version;
        option.textContent = `LVGL v${version}`;
        select.appendChild(option);
    }

    select.value = currentLvglVersion || versions[versions.length - 1];
    
    select.addEventListener('change', async function() {
        await changeVersion(this.value);
    });
}

// Update version selector to match current version
function updateVersionSelector(version) {
    const select = document.getElementById('versionSelect');
    if (select) {
        select.value = version;
    }
}

// Change LVGL version
async function changeVersion(version) {
    if (version === currentLvglVersion) return;

    try {
        // Load and initialize new WASM module
        await loadAndInitWasm(version);
        
        // Update URL without reload
        const url = new URL(window.location);
        url.searchParams.set('version', version);
        window.history.pushState({}, '', url);
        
        // Update selector
        updateVersionSelector(version);
        
        // Regenerate help
        initHelp();
        
        // Re-run script with new version
        setTimeout(() => runScript(), 100);
    } catch (error) {
        showError(`Failed to switch version: ${error.message}`);
    }
}
window.changeVersion = changeVersion;

function sendPointerEvent(event) {
    var bbox = canvas.getBoundingClientRect();

    const left = 0;
    const top = 0;
    const width = DISPLAY_WIDTH;
    const height = DISPLAY_HEIGHT;

    const x =
        (event.clientX -
            bbox.left -
            (left + (DISPLAY_WIDTH - width) / 2)) *
        (canvas.width / bbox.width);

    const y =
        (event.clientY -
            bbox.top -
            (top + (DISPLAY_HEIGHT - height) / 2)) *
        (canvas.height / bbox.height);

    const pressed = event.buttons == 1 ? 1 : 0;

    pointerEvents.push({ x, y, pressed });

    event.preventDefault();
    event.stopPropagation();
}

function setupEvents() {
    canvas.addEventListener("pointerdown", event => {
        canvas.focus();

        if (event.buttons == 4) {
            wheelUpdated = true;
            wheelPressed = 1;
        }

        canvas.setPointerCapture(event.pointerId);
        sendPointerEvent(event);

    }, true);

    canvas.addEventListener("pointermove", event => {
        sendPointerEvent(event);
    }, true);

    canvas.addEventListener("pointerup", event => {
        wheelUpdated = true;
        wheelPressed = 0;

        canvas.releasePointerCapture(event.pointerId);
        sendPointerEvent(event);
    }, true);

    canvas.addEventListener("pointercancel", event => {
        wheelUpdated = true;
        wheelPressed = 0;

        canvas.releasePointerCapture(event.pointerId);
        sendPointerEvent(event);
    }, true);

    canvas.addEventListener("wheel", event => {
        canvas.focus();

        wheelUpdated = true;
        wheelDeltaY += event.deltaY;

    }, { passive: false });
}

// ============================================================================
// Event Manager - Bridges EEZ Script callbacks to LVGL C events
// ============================================================================

class EventManager {
    constructor(wasmModule) {
        this.wasm = wasmModule;
        this.handlers = new Map(); // id -> {callback, obj, eventCode}
        this.nextId = 0;
        // Workaround for LVGL v9.3.0+ bug: event codes >= 10 don't filter correctly
        // We register with LV_EVENT_ALL and filter in JavaScript
        this.useJsFiltering = true;
    }

    register(obj, eventCode, callback, scope) {
        const id = this.nextId++;
        this.handlers.set(id, { callback, obj, eventCode });

        // Get the function pointer as an integer (not the JS wrapper)
        const dispatcherPtr = this.wasm._get_global_dispatcher_ptr();
        
        // Use LV_EVENT_ALL (0) for registration if JS filtering is enabled
        // This is a workaround for LVGL v9.3.0+ where event codes >= 10 don't filter correctly in WASM
        const registerEventCode = this.useJsFiltering ? 0 : eventCode;
        
        // Call lv_obj_add_event_cb with the global dispatcher pointer
        this.wasm._lv_obj_add_event_cb(obj, dispatcherPtr, registerEventCode, id);
        
        return id;
    }

    unregister(id) {
        this.handlers.delete(id);
        // Note: We don't remove the LVGL event callback here
        // The callback will just be a no-op if the handler is not in the map
    }

    clear() {
        this.handlers.clear();
        this.nextId = 0;
    }
    
    dispatch(handlerId, eventPtr) {
        const handler = this.handlers.get(handlerId);
        if (handler) {
            const actualEventCode = this.wasm._lv_event_get_code(eventPtr);
            
            // Skip draw/render events (26-34 in v9.3.0+) to avoid "Invalidate area during rendering" errors
            // These events should not trigger user callbacks
            if (actualEventCode >= 26 && actualEventCode <= 34) {
                return;
            }
            
            // If JS filtering is enabled, check if event code matches
            if (this.useJsFiltering && handler.eventCode !== 0) {
                if (actualEventCode !== handler.eventCode) {
                    // Event code doesn't match, skip
                    return;
                }
            }
            
            try {
                // Call the EEZ Script callback with the event pointer as a number
                handler.callback(eventPtr);
            } catch (error) {
                // Show error in UI instead of just console
                handleScriptError(error);
            }
        }
    }
}

let eventManager = null;

// Global dispatcher function called from WASM
window.js_dispatch_event = function(handlerId, eventPtr) {
    if (eventManager) {
        eventManager.dispatch(handlerId, eventPtr);
    }
};

function mainLoop() {
    // Exit early if loop has been stopped (e.g., during version switch)
    if (!mainLoopRunning) {
        return;
    }
    
    //
    for (let i = 0; i < pointerEvents.length; i++) {
        const pointerEvent = pointerEvents[i];
        wasm._onPointerEvent(
            pointerEvent.x,
            pointerEvent.y,
            pointerEvent.pressed
        );
    }
    pointerEvents = [];

    if (wheelUpdated) {
        wasm._onMouseWheelEvent(
            wheelDeltaY,
            wheelPressed
        );

        wheelUpdated = false;
        wheelDeltaY = 0;
    }

    wasm._mainLoop();

    var buf_addr = wasm._getSyncedBuffer();
    if (buf_addr != 0) {
        const screen = new Uint8ClampedArray(
            wasm.HEAPU8.subarray(
                buf_addr,
                buf_addr + DISPLAY_WIDTH * DISPLAY_HEIGHT * 4
            )
        );

        var imgData = new ImageData(
            screen,
            DISPLAY_WIDTH,
            DISPLAY_HEIGHT
        );

        ctx.putImageData(
            imgData,
            0,
            0,
            0,
            0,
            DISPLAY_WIDTH,
            DISPLAY_HEIGHT
        );
    }

    if (mainLoopRunning) {
        setTimeout(mainLoop, 1000 / FPS);
    }
}

// ============================================================================
// UI Management
// ============================================================================

// Initialize example dropdown
function initExamples() {
    const select = document.getElementById('exampleSelect');
    for (const key in EXAMPLE_SCRIPTS) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = EXAMPLE_SCRIPTS[key].name;
        select.appendChild(option);
    }

    select.addEventListener('change', function () {
        if (this.value) {
            const code = EXAMPLE_SCRIPTS[this.value].code;
            setEditorContent(code);
            // Save the loaded example to localStorage so it persists on reload
            localStorage.setItem('eez_script_saved', code);
            clearEditorErrors();
            this.value = '';
            runScript();
        }
    });
}

// ============================================================================
// Help Tab - Generate docs from LVGL API
// ============================================================================

// Store help metadata for on-demand generation
let helpMetadata = null;

function initHelp() {
    const container = document.getElementById('helpContent');
    const toc = document.getElementById('helpToc');
    if (!container || !toc) return;

    const helpData = LvglApi.getHelpData();
    const allowedFunctions = LvglApi.getAllowedFunctionsFull();
    const constants = LvglApi.getConstants();

    if (!helpData || !allowedFunctions) {
        container.textContent = 'Help generation failed: LVGL API data is not available.';
        toc.textContent = '';
        return;
    }

    const entries = Object.entries(allowedFunctions);
    if (entries.length === 0) {
        container.textContent = 'No LVGL functions available.';
        toc.textContent = '';
        return;
    }
    
    // Store metadata for on-demand generation
    helpMetadata = {
        helpData,
        allowedFunctions,
        constants
    };

    // Group functions by category (concepts/widgets) and then by group name
    const conceptGroups = new Map();
    const widgetGroups = new Map();
    
    for (const [name, spec] of entries) {
        // Skip alias functions to avoid duplicates
        if (spec.isAlias) continue;
        
        const category = spec.category || 'concepts';
        const groupName = spec.group || 'other';
        
        const targetMap = category === 'widgets' ? widgetGroups : conceptGroups;
        if (!targetMap.has(groupName)) targetMap.set(groupName, []);
        targetMap.get(groupName).push({ name, spec });
    }

    const toTitle = (groupName, category) => {
        // Special titles for common groups
        const specialTitles = {
            'obj': 'Object',
            'screen': 'Screen',
            'display': 'Display',
            'disp': 'Display (v8)',
            'event': 'Events',
            'group': 'Groups',
            'style': 'Styles',
            'color': 'Colors',
            'color32': 'Color32',
            'color16': 'Color16',
            'color24': 'Color24',
            'palette': 'Palette',
            'anim': 'Animation',
            'timer': 'Timer',
            'draw': 'Draw',
            'layer': 'Layer',
            'msgbox': 'Message Box',
            'animimg': 'Animated Image',
            'textarea': 'Text Area',
            'buttonmatrix': 'Button Matrix',
            'imagebutton': 'Image Button',
            'spinbox': 'Spin Box',
            'tabview': 'Tab View',
            'tileview': 'Tile View',
            'spangroup': 'Span Group'
        };

        if (specialTitles[groupName]) {
            return specialTitles[groupName];
        }

        // Capitalize each word
        return groupName
            .split('_')
            .map(s => s.charAt(0).toUpperCase() + s.slice(1))
            .join(' ');
    };

    const exampleForType = (type) => {
        switch (type) {
            case 'lv_obj':
                return 'obj';
            case 'number':
                return '0';
            case 'bool':
                return 'false';
            case 'cstring':
            case 'string':
                return '"text"';
            case 'lv_color':
                return '0xFF0000';
            case 'function':
                return 'on_event';
            default:
                return '0';
        }
    };

    const typeLabel = (type) => type || 'number';

    const emitSignature = (fnName, spec) => {
        const params = (spec.params || []).map((t, i) => `arg${i + 1}: ${typeLabel(t)}`).join(', ');
        const ret = spec.returnType ? typeLabel(spec.returnType) : 'number';
        return `${fnName}(${params}) -> ${ret}`;
    };

    const emitSignatureWithDocs = (fnName, spec) => {
        let result = '';
        
        // Function signature with parameter names from API
        const args = spec.args || [];
        const params = args.map((arg, i) => {
            const type = spec.params[i] || 'number';
            const name = arg.name || `arg${i + 1}`;
            return `${name}: ${typeLabel(type)}`;
        }).join(', ');
        
        const ret = spec.returnType ? typeLabel(spec.returnType) : 'number';
        result = `${fnName}(${params}) -> ${ret}`;
        
        return result;
    };

    const inferVarName = (groupName) => {
        if (groupName === 'obj') return 'obj';
        if (groupName === 'screen') return 'screen';
        return groupName;
    };

    const emitExampleLine = (fnName, spec, groupName) => {
        const params = spec.params || [];

        const isCreate = fnName.endsWith('_create') && params.length >= 1 && params[0] === 'lv_obj';
        const args = params.map((t, i) => {
            if (fnName === 'lv_obj_create' && i === 0) return '0';
            if (isCreate && i === 0) return 'screen';
            if (t === 'lv_obj') return i === 0 ? 'obj' : 'obj';
            return exampleForType(t);
        });

        if (spec.returnType === 'lv_obj') {
            const v = inferVarName(groupName);
            if (isCreate) {
                return `let ${v}: lv_obj = ${fnName}(${args.join(', ')});`;
            }
            return `let tmp: lv_obj = ${fnName}(${args.join(', ')});`;
        }

        return `${fnName}(${args.join(', ')});`;
    };

    // Sort group keys alphabetically
    const conceptKeys = Array.from(conceptGroups.keys()).sort((a, b) => a.localeCompare(b));
    const widgetKeys = Array.from(widgetGroups.keys()).sort((a, b) => a.localeCompare(b));

    // Store groups and helper functions in metadata for on-demand generation
    helpMetadata.conceptGroups = conceptGroups;
    helpMetadata.widgetGroups = widgetGroups;
    helpMetadata.toTitle = toTitle;
    helpMetadata.emitExampleLine = emitExampleLine;
    helpMetadata.emitSignatureWithDocs = emitSignatureWithDocs;

    container.innerHTML = '';
    toc.innerHTML = '';

    const tocButtons = [];
    const tocParentChildren = new Map(); // Track parent-child relationships
    
    const addTocItem = (label, targetId, isSubItem = false, parentId = null) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        btn.dataset.tocId = targetId;
        
        if (isSubItem) {
            btn.classList.add('toc-subitem');
            btn.classList.add('collapsed'); // Hidden by default
            if (parentId) {
                if (!tocParentChildren.has(parentId)) {
                    tocParentChildren.set(parentId, []);
                }
                tocParentChildren.get(parentId).push(btn);
            }
        } else if (parentId === null && !targetId.includes('boilerplate') && !targetId.includes('getting_started') && !targetId.includes('eez_script')) {
            // This is a potential parent (category header)
            btn.classList.add('toc-parent');
        }
        
        btn.addEventListener('click', () => {
            // If this is a parent, toggle expand/collapse
            if (btn.classList.contains('toc-parent')) {
                btn.classList.toggle('expanded');
                const children = tocParentChildren.get(targetId) || [];
                children.forEach(child => {
                    child.classList.toggle('collapsed');
                });
                // Don't change content visibility for parent clicks
                return;
            }
            
            // Clear container and generate content for this topic only
            container.innerHTML = '';
            
            // Generate and display the selected section
            if (targetId === 'help_getting_started') {
                generateGettingStartedSection(container);
            } else if (targetId === 'help_eez_script') {
                generateEezScriptSection(container);
            } else if (targetId === 'help_topic_boilerplate') {
                generateBoilerplateSection(container);
            } else if (targetId.startsWith('help_topic_concepts_')) {
                const groupName = targetId.replace('help_topic_concepts_', '').replace(/_/g, '_');
                generateFunctionGroupSection(container, groupName, 'concepts');
            } else if (targetId.startsWith('help_topic_widgets_')) {
                const groupName = targetId.replace('help_topic_widgets_', '').replace(/_/g, '_');
                generateFunctionGroupSection(container, groupName, 'widgets');
            } else if (targetId.startsWith('help_const_')) {
                const groupName = targetId.replace('help_const_', '').replace(/_/g, '_');
                generateConstantSection(container, groupName);
            } else if (targetId === 'help_concepts_header') {
                generateConceptsHeaderSection(container);
            } else if (targetId === 'help_widgets_header') {
                generateWidgetsHeaderSection(container);
            } else if (targetId === 'help_constants_header') {
                generateConstantsHeaderSection(container);
            }
            
            // Update active state
            tocButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Save last viewed topic
            localStorage.setItem('help_last_topic', targetId);
        });
        
        toc.appendChild(btn);
        tocButtons.push(btn);
        return btn;
    };

    // Build TOC only (no content pre-generation)
    addTocItem('Getting Started', 'help_getting_started', false, null);
    addTocItem('EEZ Script', 'help_eez_script', false, null);
    addTocItem('Boilerplate', 'help_topic_boilerplate', false, null);
    addTocItem('📚 Concepts', 'help_concepts_header', false, null);

    // Add concept groups to TOC
    for (const groupName of conceptKeys) {
        const items = conceptGroups.get(groupName);
        if (!items || items.length === 0) continue;
        const sectionId = `help_topic_concepts_${groupName.replace(/[^a-z0-9_]/gi, '_')}`;
        addTocItem(toTitle(groupName, 'concepts'), sectionId, true, 'help_concepts_header');
    }

    addTocItem('🧩 Widgets', 'help_widgets_header', false, null);

    // Add widget groups to TOC
    for (const groupName of widgetKeys) {
        const items = widgetGroups.get(groupName);
        if (!items || items.length === 0) continue;
        const sectionId = `help_topic_widgets_${groupName.replace(/[^a-z0-9_]/gi, '_')}`;
        addTocItem(toTitle(groupName, 'widgets'), sectionId, true, 'help_widgets_header');
    }

    addTocItem('🔢 Constants', 'help_constants_header', false, null);

    // Group constants by type
    const constantGroups = helpData.constantGroups || {};
    const sortedConstGroups = Object.keys(constantGroups).sort();
    
    // Filter to show only commonly used constant groups
    const importantConstGroups = sortedConstGroups.filter(name => {
        const lowerName = name.toLowerCase();
        return lowerName.includes('event') ||
               lowerName.includes('state') ||
               lowerName.includes('align') ||
               lowerName.includes('dir') ||
               lowerName.includes('part') ||
               lowerName.includes('flag') ||
               lowerName.includes('anim') ||
               lowerName.includes('scr_load') ||
               lowerName.includes('palette') ||
               lowerName.includes('opa') ||
               lowerName.includes('key') ||
               lowerName.includes('mode') ||
               name === 'style';
    });

    // Add constant groups to TOC
    for (const groupName of importantConstGroups) {
        const groupData = constantGroups[groupName];
        if (!groupData || !groupData.constants || groupData.constants.length === 0) continue;
        const sectionId = `help_const_${groupName.replace(/[^a-z0-9_]/gi, '_')}`;
        addTocItem(formatConstGroupName(groupName), sectionId, true, 'help_constants_header');
    }
    
    // Try to restore last viewed topic
    const lastTopic = localStorage.getItem('help_last_topic');
    let topicRestored = false;
    
    if (lastTopic) {
        // Find the button with this topic ID
        const lastTopicBtn = tocButtons.find(btn => btn.dataset.tocId === lastTopic);
        if (lastTopicBtn) {
            // If it's a subitem that's collapsed, expand its parent first
            if (lastTopicBtn.classList.contains('toc-subitem')) {
                const parentId = lastTopicBtn.classList.contains('collapsed') ? 
                    (lastTopic.startsWith('help_topic_concepts_') ? 'help_concepts_header' :
                     lastTopic.startsWith('help_topic_widgets_') ? 'help_widgets_header' :
                     lastTopic.startsWith('help_const_') ? 'help_constants_header' : null) : null;
                
                if (parentId) {
                    const parentBtn = tocButtons.find(btn => btn.dataset.tocId === parentId);
                    if (parentBtn && parentBtn.classList.contains('toc-parent') && !parentBtn.classList.contains('expanded')) {
                        parentBtn.classList.add('expanded');
                        const children = tocParentChildren.get(parentId) || [];
                        children.forEach(child => child.classList.remove('collapsed'));
                    }
                }
            }
            
            // Click the button to show the topic
            lastTopicBtn.click();
            topicRestored = true;
        }
    }
    
    // If no topic was restored, show Getting Started by default
    if (!topicRestored) {
        generateGettingStartedSection(container);
        tocButtons[0].classList.add('active'); // First button is Getting Started
    }
}

function formatConstGroupName(name) {
    // Handle special cases
    if (name === 'style') return 'Style Properties';
    if (name.startsWith('lv_')) {
        return name.replace(/^lv_/, '').replace(/_t$/, '')
            .split('_')
            .map(s => s.charAt(0).toUpperCase() + s.slice(1))
            .join(' ');
    }
    return name.split('_')
        .map(s => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' ');
}

// Helper functions for on-demand content generation
function generateGettingStartedSection(container) {
    const section = document.createElement('div');
    section.className = 'help-section';
    section.id = 'help_getting_started';
    section.innerHTML = `
        <h3>Getting Started with LVGL Playground</h3>
        <p>Welcome to the LVGL Playground! This is an interactive browser-based environment where you can write, test, and experiment with LVGL (Light and Versatile Graphics Library) code without any installation or setup.</p>
        
        <h4>How It Works</h4>
        <p>The playground uses WebAssembly to run LVGL directly in your browser. You write code in a TypeScript-like syntax, and it gets transpiled to JavaScript and executed in real-time.</p>
        
        <h4>Your First LVGL Program</h4>
        <p>Every LVGL program in the playground starts with an <code>init()</code> function that creates and returns a screen:</p>
        <div class="help-snippet">
            <pre>function init(): lv_obj {
    let screen: lv_obj = lv_obj_create(0);
    lv_screen_load_anim(screen, LV_SCR_LOAD_ANIM_FADE_IN, 200, 0, false);
    
    // Add a label to the screen
    let label: lv_obj = lv_label_create(screen);
    lv_label_set_text(label, "Hello, LVGL!");
    lv_obj_center(label);
    
    return screen;
}</pre>
        </div>
        
        <h4>Using the Playground</h4>
        <ol>
            <li><strong>Write Code:</strong> Use the editor on the left to write your LVGL code</li>
            <li><strong>Run:</strong> Click the "▶ Run" button in the toolbar to execute your code</li>
            <li><strong>View Results:</strong> Switch between tabs to see:
                <ul>
                    <li><strong>Canvas:</strong> The rendered UI output</li>
                    <li><strong>JavaScript:</strong> The transpiled JavaScript code</li>
                    <li><strong>C:</strong> The equivalent C code</li>
                </ul>
            </li>
            <li><strong>Explore Examples:</strong> Use the Examples dropdown to load pre-built examples and learn from them</li>
        </ol>
        
        <h4>Navigation</h4>
        <ul>
            <li><strong>Boilerplate:</strong> Basic screen setup template to get started quickly</li>
            <li><strong>Concepts:</strong> Core LVGL functions grouped by category (objects, styles, events, etc.)</li>
            <li><strong>Widgets:</strong> UI components like buttons, labels, sliders, charts, and more</li>
            <li><strong>Constants:</strong> Predefined values for alignment, colors, states, and configuration</li>
        </ul>
        
        <h4>Tips & Tricks</h4>
        <ul>
            <li>Auto-save: Your code is automatically saved in the browser</li>
            <li>Type hints: Hover over function names to see parameter information</li>
            <li>Click any function in the help to see its signature and usage examples</li>
            <li>Use copy buttons to quickly grab code snippets</li>
            <li>Experiment freely - you can't break anything!</li>
        </ul>
    `;
    container.appendChild(section);
}

function generateEezScriptSection(container) {
    const section = document.createElement('div');
    section.className = 'help-section';
    section.id = 'help_eez_script';
    section.innerHTML = `
        <h3>EEZ Script Language Guide</h3>
        <p>EEZ Script is a TypeScript-inspired scripting language designed specifically for LVGL development. It compiles to both JavaScript (for the playground) and C code (for embedded systems).</p>
        
        <h4>Type System</h4>
        <p>EEZ Script supports the following types:</p>
        <ul>
            <li><code>number</code> - JavaScript numbers (integers and floats)</li>
            <li><code>bool</code> - Boolean values (<code>true</code>/<code>false</code>)</li>
            <li><code>string</code> - JavaScript strings for display and debugging</li>
            <li><code>lv_obj</code> - LVGL object handles (used for all UI elements)</li>
            <li><code>lv_color</code> - LVGL color values</li>
        </ul>
        
        <h4>Variable Declaration</h4>
        <p>Variables must be declared with a type annotation:</p>
        <div class="help-snippet">
            <pre>let myNumber: number = 42;
let isEnabled: bool = true;
let message: string = "Hello, World!";
let button: lv_obj = lv_button_create(screen);</pre>
        </div>
        
        <h4>Function Declaration</h4>
        <p>Functions must declare parameter types and return type:</p>
        <div class="help-snippet">
            <pre>function createLabel(parent: lv_obj, text: string): lv_obj {
    let label: lv_obj = lv_label_create(parent);
    lv_label_set_text(label, text);
    return label;
}</pre>
        </div>
        
        <h4>Automatic Type Conversions</h4>
        <p>EEZ Script provides convenient automatic conversions:</p>
        <ul>
            <li><strong>String to C String:</strong> When passing a string to LVGL functions, it's automatically converted to a C-compatible format:
                <div class="help-snippet"><pre>lv_label_set_text(label, "My Text");  // String auto-converted</pre></div>
            </li>
            <li><strong>Number to Color:</strong> Hex numbers are automatically converted to LVGL colors:
                <div class="help-snippet"><pre>lv_obj_set_style_bg_color(obj, 0xFF0000, 0);  // Red color
lv_obj_set_style_text_color(label, 0x00FF00, 0);  // Green</pre></div>
            </li>
        </ul>
        
        <h4>The init() Function</h4>
        <p>Every EEZ Script program must have an <code>init()</code> function that creates and returns a screen:</p>
        <div class="help-snippet">
            <pre>function init(): lv_obj {
    let screen: lv_obj = lv_obj_create(0);
    lv_screen_load_anim(screen, LV_SCR_LOAD_ANIM_FADE_IN, 200, 0, false);
    
    // Create your UI here
    
    return screen;
}</pre>
        </div>
        
        <h4>Using LVGL Constants</h4>
        <p>LVGL constants are available directly in your code:</p>
        <ul>
            <li><strong>Alignment:</strong> <code>LV_ALIGN_CENTER</code>, <code>LV_ALIGN_TOP_LEFT</code>, etc.</li>
            <li><strong>Directions:</strong> <code>LV_DIR_HOR</code>, <code>LV_DIR_VER</code></li>
            <li><strong>States:</strong> <code>LV_STATE_DEFAULT</code>, <code>LV_STATE_PRESSED</code></li>
            <li><strong>Events:</strong> <code>LV_EVENT_CLICKED</code>, <code>LV_EVENT_VALUE_CHANGED</code></li>
        </ul>
        
        <h4>Common Patterns</h4>
        
        <h5>Creating Objects with Positioning</h5>
        <div class="help-snippet">
            <pre>let btn: lv_obj = lv_button_create(screen);
lv_obj_set_size(btn, 120, 50);
lv_obj_align(btn, LV_ALIGN_CENTER, 0, 0);</pre>
        </div>
        
        <h5>Styling Objects</h5>
        <div class="help-snippet">
            <pre>lv_obj_set_style_bg_color(obj, 0x2196F3, 0);
lv_obj_set_style_border_width(obj, 2, 0);
lv_obj_set_style_radius(obj, 10, 0);</pre>
        </div>
        
        <h5>Creating Parent-Child Hierarchies</h5>
        <div class="help-snippet">
            <pre>let panel: lv_obj = lv_obj_create(screen);
let label: lv_obj = lv_label_create(panel);  // Label is child of panel
lv_obj_center(label);  // Centers within parent</pre>
        </div>
        
        <h4>Best Practices</h4>
        <ul>
            <li>Always declare variable types explicitly</li>
            <li>Use descriptive variable names (<code>mainButton</code> instead of <code>btn1</code>)</li>
            <li>Create reusable functions for common UI patterns</li>
            <li>Use constants instead of magic numbers for colors and sizes</li>
            <li>Keep the init() function clean by extracting complex UI into helper functions</li>
        </ul>
        
        <h4>Limitations</h4>
        <ul>
            <li>No event callbacks in playground (use for static UI creation)</li>
            <li>No dynamic memory allocation beyond LVGL objects</li>
            <li>Limited to LVGL functions available in the current version</li>
        </ul>
    `;
    container.appendChild(section);
}

function generateBoilerplateSection(container) {
    const intro = document.createElement('div');
    intro.className = 'help-section';
    intro.id = 'help_topic_boilerplate';
    intro.innerHTML = `
        <h3>Boilerplate: start a screen</h3>
        <div class="help-snippet">
            <button class="copy-button" onclick="copyToClipboard('help_snippet_boilerplate')">Copy</button>
            <pre id="help_snippet_boilerplate">function init(): lv_obj {
    let screen: lv_obj = lv_obj_create(0);
    lv_screen_load_anim(screen, LV_SCR_LOAD_ANIM_FADE_IN, 200, 0, false);
    return screen;
}</pre>
        </div>
    `;
    container.appendChild(intro);
}

function generateFunctionGroupSection(container, groupName, category) {
    if (!helpMetadata) return;
    
    const groups = category === 'concepts' ? helpMetadata.conceptGroups : helpMetadata.widgetGroups;
    const items = groups.get(groupName);
    if (!items || items.length === 0) return;
    
    items.sort((a, b) => a.name.localeCompare(b.name));

    const section = document.createElement('div');
    section.className = 'help-section';

    const title = document.createElement('h3');
    title.textContent = helpMetadata.toTitle(groupName, category);
    section.appendChild(title);

    const sigList = document.createElement('ul');
    sigList.className = 'function-list';
    for (const { name, spec } of items) {
        const li = document.createElement('li');
        
        const sigDiv = document.createElement('div');
        sigDiv.className = 'function-signature';
        const code = document.createElement('code');
        code.textContent = helpMetadata.emitSignatureWithDocs(name, spec);
        sigDiv.appendChild(code);
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-button copy-inline';
        copyBtn.textContent = 'Copy';
        copyBtn.onclick = () => {
            const args = spec.args || [];
            const argNames = args.map((arg, i) => arg.name || `arg${i + 1}`).join(', ');
            const funcCall = `${name}(${argNames})`;
            navigator.clipboard.writeText(funcCall).then(() => {
                copyBtn.textContent = '✓';
                setTimeout(() => copyBtn.textContent = 'Copy', 2000);
            }).catch(err => console.error('Copy failed:', err));
        };
        sigDiv.appendChild(copyBtn);
        
        li.appendChild(sigDiv);
        
        if (spec.description) {
            const descDiv = document.createElement('div');
            descDiv.className = 'function-description';
            descDiv.textContent = spec.description;
            li.appendChild(descDiv);
        }
        
        if (spec.args && spec.args.length > 0) {
            const hasParamDesc = spec.args.some(arg => arg.description);
            if (hasParamDesc) {
                const paramsDiv = document.createElement('div');
                paramsDiv.className = 'function-params';
                paramsDiv.innerHTML = '<strong>Parameters:</strong>';
                const paramsList = document.createElement('ul');
                for (const arg of spec.args) {
                    if (arg.description) {
                        const paramLi = document.createElement('li');
                        paramLi.innerHTML = `<code>${arg.name}</code>: ${arg.description}`;
                        paramsList.appendChild(paramLi);
                    }
                }
                paramsDiv.appendChild(paramsList);
                li.appendChild(paramsDiv);
            }
        }
        
        if (spec.returnsDescription) {
            const retDiv = document.createElement('div');
            retDiv.className = 'function-returns';
            retDiv.innerHTML = `<strong>Returns:</strong> ${spec.returnsDescription}`;
            li.appendChild(retDiv);
        }
        
        sigList.appendChild(li);
    }
    section.appendChild(sigList);

    const snippetId = `help_snippet_${category}_${groupName.replace(/[^a-z0-9_]/gi, '_')}`;
    const hasEventCb = items.some(x => (x.spec.params || []).includes('function'));

    let snippet = '';
    if (hasEventCb) {
        snippet += `function on_event(event: number) {\n    // Use lv_event_get_target(event), lv_event_get_code(event), ...\n}\n\n`;
    }

    snippet += `function init(): lv_obj {\n`;
    snippet += `    let screen: lv_obj = lv_obj_create(0);\n`;
    snippet += `    lv_screen_load_anim(screen, LV_SCR_LOAD_ANIM_FADE_IN, 200, 0, false);\n\n`;

    const createItem = items.find(x => x.name.endsWith('_create'));
    if (createItem) {
        snippet += `    ${helpMetadata.emitExampleLine(createItem.name, createItem.spec, groupName)}\n\n`;
    }

    for (const { name, spec } of items) {
        if (createItem && name === createItem.name) continue;
        snippet += `    ${helpMetadata.emitExampleLine(name, spec, groupName)}\n`;
    }

    snippet += `\n    return screen;\n}`;

    const snippetWrap = document.createElement('div');
    snippetWrap.className = 'help-snippet';
    snippetWrap.innerHTML = `
        <button class="copy-button" onclick="copyToClipboard('${snippetId}')">Copy</button>
        <pre id="${snippetId}"></pre>
    `;
    snippetWrap.querySelector('pre').textContent = snippet;
    section.appendChild(snippetWrap);

    container.appendChild(section);
}

function generateConstantSection(container, groupName) {
    if (!helpMetadata) return;
    
    const constantGroups = helpMetadata.helpData.constantGroups || {};
    const groupData = constantGroups[groupName];
    if (!groupData || !groupData.constants || groupData.constants.length === 0) return;

    const section = document.createElement('div');
    section.className = 'help-section';

    const title = document.createElement('h3');
    title.textContent = formatConstGroupName(groupName);
    section.appendChild(title);

    const table = document.createElement('table');
    table.className = 'constants-table';
    table.innerHTML = '<thead><tr><th>Constant</th><th>Value</th><th>Description</th></tr></thead>';
    const tbody = document.createElement('tbody');

    for (const constData of groupData.constants) {
        const tr = document.createElement('tr');
        const td1 = document.createElement('td');
        td1.innerHTML = `<code>${constData.name}</code>`;
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-button copy-inline';
        copyBtn.textContent = 'Copy';
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(constData.name).then(() => {
                copyBtn.textContent = '✓';
                setTimeout(() => copyBtn.textContent = 'Copy', 2000);
            }).catch(err => console.error('Copy failed:', err));
        };
        td1.appendChild(copyBtn);
        
        const td2 = document.createElement('td');
        td2.textContent = constData.value;
        const td3 = document.createElement('td');
        td3.textContent = constData.description || '';
        tr.appendChild(td1);
        tr.appendChild(td2);
        tr.appendChild(td3);
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    section.appendChild(table);
    container.appendChild(section);
}

function generateConceptsHeaderSection(container) {
    const header = document.createElement('div');
    header.className = 'help-section-header';
    header.innerHTML = '<h2>📚 Concepts</h2>';
    container.appendChild(header);
}

function generateWidgetsHeaderSection(container) {
    const header = document.createElement('div');
    header.className = 'help-section-header';
    header.innerHTML = '<h2>🧩 Widgets</h2>';
    container.appendChild(header);
}

function generateConstantsHeaderSection(container) {
    const header = document.createElement('div');
    header.className = 'help-section-header';
    header.innerHTML = '<h2>🔢 Constants</h2>';
    container.appendChild(header);
}

// Tab switching
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    // Initialize Monaco editors lazily when their tabs become visible
    if (tabName === 'javascript') {
        setTimeout(() => initJsOutputEditor(), 10);
    } else if (tabName === 'c') {
        setTimeout(() => initCOutputEditor(), 10);
    }
}
window.switchTab = switchTab;

// Clear editor
function clearEditor() {
    if (confirm('Clear the editor?')) {
        setEditorContent('');
        clearEditorErrors();
        localStorage.removeItem('eez_script_saved');
    }
}
window.clearEditor = clearEditor;

// Save script to localStorage
function saveScript() {
    const code = getEditorContent();
    localStorage.setItem('eez_script_saved', code);
    showStatus('Script saved!');
}
window.saveScript = saveScript;

// Show status message
function showStatus(message) {
    const canvasTab = document.getElementById('canvasTab');
    const existingStatus = canvasTab.querySelector('.status');
    if (existingStatus) {
        existingStatus.remove();
    }

    const status = document.createElement('div');
    status.className = 'status';
    status.textContent = message;
    canvasTab.insertBefore(status, canvasTab.firstChild);

    setTimeout(() => status.remove(), 3000);
}

// Handle script errors (from compilation, execution, or event handlers)
function handleScriptError(error) {
    const errorMsg = error.message || String(error);
    
    // Extract line, column, and length information from error message
    // Pattern 1: "At line X, column Y, length Z:" (from createRuntimeError with length)
    const atLineMatchWithLength = errorMsg.match(/At line (\d+), column (\d+), length (\d+)/);
    // Pattern 2: "At line X, column Y:" (from createRuntimeError without length)
    const atLineMatch = errorMsg.match(/At line (\d+), column (\d+)/);
    // Pattern 3: "line X:Y" or "line X column Y" (from lexer/parser)
    const lineColonMatch = errorMsg.match(/line (\d+):(\d+)/i);
    const lineColumnMatch = errorMsg.match(/line (\d+).*column (\d+)/i);
    
    let line = null;
    let column = null;
    let length = null;
    
    if (atLineMatchWithLength) {
        line = parseInt(atLineMatchWithLength[1]);
        column = parseInt(atLineMatchWithLength[2]);
        length = parseInt(atLineMatchWithLength[3]);
    } else if (atLineMatch) {
        line = parseInt(atLineMatch[1]);
        column = parseInt(atLineMatch[2]);
    } else if (lineColonMatch) {
        line = parseInt(lineColonMatch[1]);
        column = parseInt(lineColonMatch[2]);
    } else if (lineColumnMatch) {
        line = parseInt(lineColumnMatch[1]);
        column = parseInt(lineColumnMatch[2]);
    }
    
    // Extract just the message part (remove the "At line X, column Y:" or "At line X, column Y, length Z:" prefix)
    // Keep the "Runtime error:" or "Syntax error:" prefix in the message
    let displayMessage = errorMsg;
    if (atLineMatchWithLength) {
        displayMessage = errorMsg.replace(/^At line \d+, column \d+, length \d+:\s*/, '');
    } else if (atLineMatch) {
        displayMessage = errorMsg.replace(/^At line \d+, column \d+:\s*/, '');
    }
    
    // Show error in canvas with line/column info
    showError(displayMessage, line, column);
    
    // Show inline error in Monaco editor
    if (line) {
        const errors = [{
            line: line,
            column: column || 1,
            length: length,
            message: displayMessage.split('\n')[0] // Only show the first line of the error
        }];
        showEditorErrors(errors);
    }
}

// Show error message
function showError(message, line = null, column = null) {
    const canvasTab = document.getElementById('canvasTab');
    const existingError = canvasTab.querySelector('.error');
    if (existingError) {
        existingError.remove();
    }

    const error = document.createElement('div');
    error.className = 'error';
    
    // Add line/column info if available
    if (line) {
        const location = column ? `Line ${line}:${column}` : `Line ${line}`;
        error.innerHTML = `<strong>${location}:</strong> ${message}`;
    } else {
        error.textContent = message;
    }
    
    canvasTab.insertBefore(error, canvasTab.firstChild);
}

// Clear messages
function clearMessages() {
    document.querySelectorAll('.error, .status').forEach(el => el.remove());
}

// Run the script
let currentScript = null;

function runScript() {
    // Switch to canvas tab to show the output
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector('.tab[onclick*="canvas"]')?.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById('canvasTab').classList.add('active');
    
    clearMessages();
    clearEditorErrors();

    const scriptCode = getEditorContent().trim();
    if (!scriptCode) {
        showError('Please enter a script to run');
        return;
    }

    // Make sure we have a valid WASM module
    if (!wasm || !lvgl) {
        showError('WASM module not loaded. Please wait for initialization.');
        return;
    }

    try {
        // Clear previous event handlers and ensure eventManager uses current WASM
        if (eventManager) {
            eventManager.clear();
        }
        // Always ensure eventManager is using the current WASM instance
        if (!eventManager || eventManager.wasm !== wasm) {
            eventManager = new EventManager(wasm);
        }

        // Compile the script
        currentScript = eez_script_compile(scriptCode);

        // Initialize with globals, lvgl instance and constants
        const globals = {
            System: {
                stringToNewUTF8: {
                    function: lvgl.stringToNewUTF8.bind(lvgl),
                    params: ['string'],
                    returnType: 'number'
                },
                UTF8ToString: {
                    function: lvgl.UTF8ToString.bind(lvgl),
                    params: ['number'],
                    returnType: 'string'
                }
            }
        };

        // Get version-specific functions and constants
        const allowedFunctions = LvglApi.getAllowedFunctions();
        const LVGL_CONSTANTS = LvglApi.getConstants();

        currentScript.init(globals, lvgl, LVGL_CONSTANTS, allowedFunctions);

        // Set event manager on the interpreter
        currentScript._interpreter.eventManager = eventManager;

        // Generate and display JS code
        const jsCode = currentScript.emitJS();
        if (jsOutputEditor) {
            jsOutputEditor.setValue(jsCode);
        }
        // Store for later if editor not created yet
        if (!jsOutputEditor) {
            const jsContainer = document.getElementById('jsOutput');
            jsContainer.dataset.pendingCode = jsCode;
        }

        // Generate and display C code
        const cCode = currentScript.emitC();
        if (cOutputEditor) {
            cOutputEditor.setValue(cCode);
        }
        // Store for later if editor not created yet
        if (!cOutputEditor) {
            const cContainer = document.getElementById('cOutput');
            cContainer.dataset.pendingCode = cCode;
        }

        // Find and execute the init function (try common names)
        const initFunctions = ['init'];
        let executed = false;
        let lastError = null;

        for (const funcName of initFunctions) {
            try {
                currentScript.exec(funcName);
                executed = true;
                showStatus('✓ Script executed successfully!');
                break;
            } catch (e) {
                lastError = e;
                // Try next function name
            }
        }

        if (!executed) {
            if (lastError) {
                // Show the actual error from execution
                throw lastError;
            } else {
                showError('No entry function found. Please define one of: ' + initFunctions.join(', '));
            }
        }

    } catch (error) {
        handleScriptError(error);
    }
}
window.runScript = runScript;

// Copy to clipboard functionality
function copyToClipboard(elementId) {
    let text = '';
    let buttonElement = null;
    
    // Handle Monaco editor outputs
    if (elementId === 'jsOutputContent' && jsOutputEditor) {
        text = jsOutputEditor.getValue();
    } else if (elementId === 'cOutputContent' && cOutputEditor) {
        text = cOutputEditor.getValue();
    } else {
        // Fallback to DOM element
        const actualId = elementId.replace('Content', '');
        const element = document.getElementById(actualId);
        if (!element) {
            console.error('Element not found:', actualId);
            alert('Failed to copy to clipboard');
            return;
        }
        
        if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
            text = element.value;
        } else {
            text = element.textContent;
        }
        
        // Find the copy button
        buttonElement = element.parentElement ? element.parentElement.querySelector('.copy-button') : null;
    }
    
    if (!text) {
        console.error('No text to copy');
        alert('Failed to copy to clipboard');
        return;
    }
    
    navigator.clipboard.writeText(text).then(() => {
        if (buttonElement) {
            const originalText = buttonElement.textContent;
            buttonElement.textContent = '✓ Copied!';
            buttonElement.classList.add('copied');
            
            setTimeout(() => {
                buttonElement.textContent = originalText;
                buttonElement.classList.remove('copied');
            }, 2000);
        }
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy to clipboard');
    });
}
window.copyToClipboard = copyToClipboard;

// Toggle Help Panel
function toggleHelp() {
    const helpPanel = document.getElementById('helpPanel');
    const helpSplitter = document.getElementById('helpSplitter');
    const helpBtn = document.getElementById('helpToggleBtn');
    const isHidden = helpPanel.classList.contains('hidden');
    
    if (isHidden) {
        helpPanel.classList.remove('hidden');
        helpSplitter.classList.remove('hidden');
        if (helpBtn) {
            helpBtn.textContent = '✓ Hide Help';
            helpBtn.classList.add('active');
        }
        localStorage.setItem('help_panel_state', 'open');
    } else {
        helpPanel.classList.add('hidden');
        helpSplitter.classList.add('hidden');
        if (helpBtn) {
            helpBtn.textContent = '📖 Show Help';
            helpBtn.classList.remove('active');
        }
        localStorage.setItem('help_panel_state', 'closed');
    }
}
window.toggleHelp = toggleHelp;

// Initialize Help Panel State
function initHelpPanel() {
    const helpPanel = document.getElementById('helpPanel');
    const helpSplitter = document.getElementById('helpSplitter');
    const helpBtn = document.getElementById('helpToggleBtn');
    const savedState = localStorage.getItem('help_panel_state');
    const savedWidth = localStorage.getItem('help_panel_width');
    
    // Restore saved width
    if (savedWidth) {
        helpPanel.style.width = savedWidth;
    }
    
    // Default to open, or use saved state
    if (savedState === 'closed') {
        helpPanel.classList.add('hidden');
        helpSplitter.classList.add('hidden');
        if (helpBtn) {
            helpBtn.textContent = '📖 Show Help';
            helpBtn.classList.remove('active');
        }
    } else {
        helpPanel.classList.remove('hidden');
        helpSplitter.classList.remove('hidden');
        if (helpBtn) {
            helpBtn.textContent = '✓ Hide Help';
            helpBtn.classList.add('active');
        }
    }
}

// Splitter functionality
function initSplitter() {
    const splitter = document.getElementById('splitter');
    const editorPanel = document.querySelector('.editor-panel');
    const container = document.querySelector('.container');
    let isDragging = false;

    splitter.addEventListener('mousedown', (e) => {
        isDragging = true;
        splitter.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const containerRect = container.getBoundingClientRect();
        const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
        
        // Constrain between 20% and 80%
        if (newWidth >= 20 && newWidth <= 80) {
            editorPanel.style.width = newWidth + '%';
        }
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            splitter.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}

// Help splitter functionality
function initHelpSplitter() {
    const helpSplitter = document.getElementById('helpSplitter');
    const helpPanel = document.getElementById('helpPanel');
    const previewPanel = document.querySelector('.preview-panel');
    let isDragging = false;

    helpSplitter.addEventListener('mousedown', (e) => {
        isDragging = true;
        helpSplitter.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const panelRect = previewPanel.getBoundingClientRect();
        const newWidth = ((panelRect.right - e.clientX) / panelRect.width) * 100;
        
        // Constrain between 20% and 50%
        if (newWidth >= 20 && newWidth <= 50) {
            helpPanel.style.width = newWidth + '%';
        }
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            helpSplitter.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            // Save the width to localStorage
            localStorage.setItem('help_panel_width', helpPanel.style.width);
        }
    });
}

// Help TOC splitter functionality
// Load saved script on page load
async function loadSavedScript() {
    const saved = localStorage.getItem('eez_script_saved');
    // Use saved script if available, otherwise load the first example ('simple')
    const initialCode = saved || EXAMPLE_SCRIPTS['simple'].code;
    
    // Initialize Monaco Editor with the saved/default code
    await initMonacoEditor(initialCode);
}

// Initialize on page load - initPlayground is called from HTML
// (removed DOMContentLoaded handler to prevent double initialization)
