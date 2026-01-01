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
});
