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

function onWasmLoaded() {
    // Set global lvgl reference to wasm module
    lvgl = wasm;
    
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

    setupEvents();
    mainLoop();

    // Initialize playground UI
    initExamples();
    loadSavedScript();

    // Auto-run the loaded script
    setTimeout(() => runScript(), 100);
}

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

// Global LVGL instance reference
let lvgl = null;

// ============================================================================
// Event Manager - Bridges EEZ Script callbacks to LVGL C events
// ============================================================================

class EventManager {
    constructor(wasmModule) {
        this.wasm = wasmModule;
        this.handlers = new Map(); // id -> {callback, obj, eventCode}
        this.nextId = 0;
    }

    register(obj, eventCode, callback, scope) {
        const id = this.nextId++;
        this.handlers.set(id, { callback, obj, eventCode });

        // Get the function pointer as an integer (not the JS wrapper)
        const dispatcherPtr = this.wasm._get_global_dispatcher_ptr();
        
        // Call lv_obj_add_event_cb with the global dispatcher pointer
        this.wasm._lv_obj_add_event_cb(obj, dispatcherPtr, eventCode, id);
        
        return id;
    }

    unregister(id) {
        this.handlers.delete(id);
        // Note: We don't remove the LVGL event callback here
        // The callback will just be a no-op if the handler is not in the map
    }

    clear() {
        this.handlers.clear();
    }
    
    dispatch(handlerId, eventPtr) {
        const handler = this.handlers.get(handlerId);
        if (handler) {
            try {
                // Call the EEZ Script callback with the event pointer as a number
                // The callback can use lv_event_get_target, lv_event_get_code, etc.
                handler.callback(eventPtr);
            } catch (error) {
                console.error('Event handler error:', error);
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

    setTimeout(mainLoop, 1000 / FPS);
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
            document.getElementById('scriptInput').value = EXAMPLE_SCRIPTS[this.value].code;
            this.value = '';
            runScript();
        }
    });
}

// ============================================================================
// Help Tab - Generate docs from allowedFunctions
// ============================================================================

function initHelp() {
    const container = document.getElementById('helpContent');
    const toc = document.getElementById('helpToc');
    if (!container || !toc) return;

    if (typeof allowedFunctions === 'undefined' || !allowedFunctions) {
        container.textContent = 'Help generation failed: allowedFunctions is not available.';
        toc.textContent = '';
        return;
    }

    const entries = Object.entries(allowedFunctions);
    if (entries.length === 0) {
        container.textContent = 'No LVGL functions are whitelisted (allowedFunctions is empty).';
        toc.textContent = '';
        return;
    }

    // Group by prefix: lv_obj_*, lv_label_*, lv_slider_* ...
    const groups = new Map();
    for (const [name, spec] of entries) {
        const parts = name.split('_');
        const prefix = parts.length >= 2 ? `${parts[0]}_${parts[1]}` : parts[0];
        if (!groups.has(prefix)) groups.set(prefix, []);
        groups.get(prefix).push({ name, spec });
    }

    const preferredOrder = [
        'lv_obj',
        'lv_screen',
        'lv_event',
        'lv_group',
        'lv_color',
        'lv_style',
        'lv_theme',
        'lv_palette',
        'lv_malloc'
    ];

    const toTitle = (prefix) => {
        const raw = prefix.replace(/^lv_/, '');
        if (raw === 'obj') return 'Object (lv_obj)';
        if (raw === 'screen') return 'Screen (lv_screen)';
        if (raw === 'event') return 'Events (lv_event)';
        if (raw === 'msgbox') return 'Message Box (lv_msgbox)';
        if (raw === 'animimg') return 'Animated Image (lv_animimg)';
        return raw
            .split('_')
            .map(s => s.charAt(0).toUpperCase() + s.slice(1))
            .join(' ') + ` (${prefix})`;
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

    const inferVarName = (prefix) => {
        const raw = prefix.replace(/^lv_/, '');
        if (raw === 'obj') return 'obj';
        if (raw === 'screen') return 'screen';
        return raw;
    };

    const emitExampleLine = (fnName, spec, prefix) => {
        const params = spec.params || [];

        const isCreate = fnName.endsWith('_create') && params.length >= 1 && params[0] === 'lv_obj';
        const args = params.map((t, i) => {
            if (fnName === 'lv_obj_create' && i === 0) return '0';
            if (isCreate && i === 0) return 'screen';
            if (t === 'lv_obj') return i === 0 ? 'obj' : 'obj';
            return exampleForType(t);
        });

        if (spec.returnType === 'lv_obj') {
            const v = inferVarName(prefix);
            if (isCreate) {
                return `let ${v}: lv_obj = ${fnName}(${args.join(', ')});`;
            }
            return `let tmp: lv_obj = ${fnName}(${args.join(', ')});`;
        }

        return `${fnName}(${args.join(', ')});`;
    };

    const groupKeys = Array.from(groups.keys());
    groupKeys.sort((a, b) => {
        const ai = preferredOrder.indexOf(a);
        const bi = preferredOrder.indexOf(b);
        if (ai !== -1 || bi !== -1) {
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
        }
        return a.localeCompare(b);
    });

    container.innerHTML = '';
    toc.innerHTML = '';

    const tocButtons = [];
    const addTocItem = (label, targetId) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        btn.addEventListener('click', () => {
            const target = document.getElementById(targetId);
            if (!target) return;
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            tocButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
        toc.appendChild(btn);
        tocButtons.push(btn);
        return btn;
    };

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
    addTocItem('Boilerplate', intro.id).classList.add('active');

    for (const prefix of groupKeys) {
        const items = groups.get(prefix);
        items.sort((a, b) => a.name.localeCompare(b.name));

        const section = document.createElement('div');
        section.className = 'help-section';
        section.id = `help_topic_${prefix.replace(/[^a-z0-9_]/gi, '_')}`;

        const title = document.createElement('h3');
        title.textContent = toTitle(prefix);
        section.appendChild(title);

        const sigList = document.createElement('ul');
        for (const { name, spec } of items) {
            const li = document.createElement('li');
            const code = document.createElement('code');
            code.textContent = emitSignature(name, spec);
            li.appendChild(code);
            sigList.appendChild(li);
        }
        section.appendChild(sigList);

        const snippetId = `help_snippet_${prefix.replace(/[^a-z0-9_]/gi, '_')}`;
        const hasEventCb = items.some(x => (x.spec.params || []).includes('function'));

        let snippet = '';
        if (hasEventCb) {
            snippet += `function on_event(event: number) {\n    // Use lv_event_get_target(event), lv_event_get_code(event), ...\n}\n\n`;
        }

        snippet += `function init(): lv_obj {\n`;
        snippet += `    let screen: lv_obj = lv_obj_create(0);\n`;
        snippet += `    lv_screen_load_anim(screen, LV_SCR_LOAD_ANIM_FADE_IN, 200, 0, false);\n\n`;

        const createItem = items.find(x => x.name === `${prefix}_create`);
        if (createItem) {
            snippet += `    ${emitExampleLine(createItem.name, createItem.spec, prefix)}\n\n`;
        }

        for (const { name, spec } of items) {
            if (createItem && name === createItem.name) continue;
            snippet += `    ${emitExampleLine(name, spec, prefix)}\n`;
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
        addTocItem(toTitle(prefix), section.id);
    }
}

// Tab switching
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabName + 'Tab').classList.add('active');
}
window.switchTab = switchTab;

// Clear editor
function clearEditor() {
    if (confirm('Clear the editor?')) {
        document.getElementById('scriptInput').value = '';
        localStorage.removeItem('eez_script_saved');
    }
}
window.clearEditor = clearEditor;

// Save script to localStorage
function saveScript() {
    const code = document.getElementById('scriptInput').value;
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

// Show error message
function showError(message) {
    const canvasTab = document.getElementById('canvasTab');
    const existingError = canvasTab.querySelector('.error');
    if (existingError) {
        existingError.remove();
    }

    const error = document.createElement('div');
    error.className = 'error';
    error.textContent = message;
    canvasTab.insertBefore(error, canvasTab.firstChild);
}

// Clear messages
function clearMessages() {
    document.querySelectorAll('.error, .status').forEach(el => el.remove());
}

// Run the script
let currentScript = null;

function runScript() {
    clearMessages();

    const scriptCode = document.getElementById('scriptInput').value.trim();
    if (!scriptCode) {
        showError('Please enter a script to run');
        return;
    }

    try {
        // Clear previous event handlers
        if (eventManager) {
            eventManager.clear();
        } else {
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
                }
            }
        };

        currentScript.init(globals, lvgl, LVGL_CONSTANTS, allowedFunctions);

        // Set event manager on the interpreter
        currentScript._interpreter.eventManager = eventManager;

        // Generate and display JS code
        const jsCode = currentScript.emitJS();
        document.getElementById('jsOutput').textContent = jsCode;

        // Generate and display C code
        const cCode = currentScript.emitC();
        document.getElementById('cOutput').textContent = cCode;

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
        const errorMsg = error.message || String(error);
        showError('Error: ' + errorMsg);
        console.error('Full error:', error);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
    }
}
window.runScript = runScript;

// Copy to clipboard functionality
function copyToClipboard(elementId) {
    // Map content IDs to actual output element IDs
    const actualId = elementId.replace('Content', '');
    const element = document.getElementById(actualId);
    let text;
    
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        text = element.value;
    } else {
        text = element.textContent;
    }
    
    navigator.clipboard.writeText(text).then(() => {
        // Find the copy button - it's a sibling in the parent container
        const button = element.tagName === 'TEXTAREA' 
            ? element.parentElement.querySelector('.copy-button')
            : element.parentElement.querySelector('.copy-button');
        
        if (button) {
            const originalText = button.textContent;
            button.textContent = '✓ Copied!';
            button.classList.add('copied');
            
            setTimeout(() => {
                button.textContent = originalText;
                button.classList.remove('copied');
            }, 2000);
        }
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy to clipboard');
    });
}
window.copyToClipboard = copyToClipboard;

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

// Load saved script on page load
function loadSavedScript() {
    const saved = localStorage.getItem('eez_script_saved');
    if (saved) {
        document.getElementById('scriptInput').value = saved;
    } else {
        // Load default example
        document.getElementById('scriptInput').value = EXAMPLE_SCRIPTS['dashboard'].code;
    }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    initSplitter();
    initHelp();
});
