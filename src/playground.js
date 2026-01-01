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

const LVGL_CONSTANTS = {
    LV_SCR_LOAD_ANIM_FADE_IN: 9,
    LV_SIZE_CONTENT: 1073741823,
    LV_ALIGN_CENTER: 9,
    LV_ALIGN_TOP_LEFT: 0,
    LV_ALIGN_TOP_MID: 1,
    LV_ALIGN_TOP_RIGHT: 2,
    LV_ALIGN_LEFT_MID: 6,
    LV_PART_MAIN: 0,
    LV_PART_INDICATOR: 65536,
    LV_PART_KNOB: 131072,
    LV_STATE_DEFAULT: 0,
    LV_STATE_CHECKED: 1,
    LV_ARC_MODE_NORMAL: 0,
    LV_BAR_MODE_NORMAL: 0,
    LV_LABEL_LONG_WRAP: 0,
    LV_PALETTE_BLUE: 0,
    LV_PALETTE_RED: 1,
    LV_PALETTE_GREEN: 2,
    LV_PALETTE_ORANGE: 3
}

// Global LVGL instance reference
let lvgl = null;

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

const EXAMPLE_SCRIPTS = {
    'simple': {
        name: '1. Simple Label',
        code: `// Simple example: Create a label in the center
function init(): lv_obj {
let screen: lv_obj = lv_obj_create(0);
lv_screen_load_anim(screen, LV_SCR_LOAD_ANIM_FADE_IN, 200, 0, false);

let label: lv_obj = lv_label_create(screen);
lv_obj_set_style_align(label, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
lv_label_set_text(label, "Hello from EEZ Script!");

return screen;
}`
    },
    'button': {
        name: '2. Button Example',
        code: `// Button with styled label
function init(): lv_obj {
let screen: lv_obj = lv_obj_create(0);
lv_screen_load_anim(screen, LV_SCR_LOAD_ANIM_FADE_IN, 200, 0, false);

let button: lv_obj = lv_button_create(screen);
lv_obj_set_size(button, 200, 60);
lv_obj_set_style_align(button, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);

let label: lv_obj = lv_label_create(button);
lv_obj_set_style_align(label, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
lv_label_set_text(label, "Click Me!");

return screen;
}`
    },
    'leds': {
        name: '3. LED Indicators',
        code: `// Colorful LED indicators
function init(): lv_obj {
let screen: lv_obj = lv_obj_create(0);
lv_screen_load_anim(screen, LV_SCR_LOAD_ANIM_FADE_IN, 200, 0, false);

// Title
let title: lv_obj = lv_label_create(screen);
lv_obj_set_pos(title, 280, 100);
lv_label_set_text(title, "LED Status Indicators");

// Green LED
let led1: lv_obj = lv_led_create(screen);
lv_obj_set_pos(led1, 320, 160);
lv_obj_set_size(led1, 40, 40);
lv_led_set_color(led1, 0x00FF00);
lv_led_set_brightness(led1, 255);

let label1: lv_obj = lv_label_create(screen);
lv_obj_set_pos(label1, 370, 168);
lv_label_set_text(label1, "Online");

// Orange LED
let led2: lv_obj = lv_led_create(screen);
lv_obj_set_pos(led2, 320, 220);
lv_obj_set_size(led2, 40, 40);
lv_led_set_color(led2, 0xFFA500);
lv_led_set_brightness(led2, 255);

let label2: lv_obj = lv_label_create(screen);
lv_obj_set_pos(label2, 370, 228);
lv_label_set_text(label2, "Warning");

// Red LED
let led3: lv_obj = lv_led_create(screen);
lv_obj_set_pos(led3, 320, 280);
lv_obj_set_size(led3, 40, 40);
lv_led_set_color(led3, 0xFF0000);
lv_led_set_brightness(led3, 255);

let label3: lv_obj = lv_label_create(screen);
lv_obj_set_pos(label3, 370, 288);
lv_label_set_text(label3, "Error");

return screen;
}`
    },
    'slider': {
        name: '4. Slider & Bar',
        code: `// Slider and progress bar
function init(): lv_obj {
let screen: lv_obj = lv_obj_create(0);
lv_screen_load_anim(screen, LV_SCR_LOAD_ANIM_FADE_IN, 200, 0, false);

// Title
let title: lv_obj = lv_label_create(screen);
lv_obj_set_pos(title, 280, 100);
lv_label_set_text(title, "Slider & Bar Demo");

// Slider
let slider: lv_obj = lv_slider_create(screen);
lv_obj_set_pos(slider, 250, 180);
lv_obj_set_size(slider, 300, 20);
lv_slider_set_range(slider, 0, 100);
lv_slider_set_value(slider, 75, 0);

// Progress bar
let bar: lv_obj = lv_bar_create(screen);
lv_obj_set_pos(bar, 250, 250);
lv_obj_set_size(bar, 300, 30);
lv_bar_set_range(bar, 0, 100);
lv_bar_set_value(bar, 50, 0);

return screen;
}`
    },
    'arc': {
        name: '5. Arc Gauge',
        code: `// Arc gauge / circular progress
function init(): lv_obj {
let screen: lv_obj = lv_obj_create(0);
lv_screen_load_anim(screen, LV_SCR_LOAD_ANIM_FADE_IN, 200, 0, false);

// Title
let title: lv_obj = lv_label_create(screen);
lv_obj_set_pos(title, 310, 60);
lv_label_set_text(title, "Arc Gauge Demo");

// Arc 1
let arc1: lv_obj = lv_arc_create(screen);
lv_obj_set_pos(arc1, 200, 140);
lv_obj_set_size(arc1, 150, 150);
lv_arc_set_range(arc1, 0, 100);
lv_arc_set_value(arc1, 75);
lv_arc_set_bg_start_angle(arc1, 135);
lv_arc_set_bg_end_angle(arc1, 45);

// Arc 2
let arc2: lv_obj = lv_arc_create(screen);
lv_obj_set_pos(arc2, 450, 140);
lv_obj_set_size(arc2, 150, 150);
lv_arc_set_range(arc2, 0, 100);
lv_arc_set_value(arc2, 50);
lv_arc_set_bg_start_angle(arc2, 135);
lv_arc_set_bg_end_angle(arc2, 45);

return screen;
}`
    },
    'checkboxes': {
        name: '6. Checkbox Group',
        code: `// Checkbox group
function init(): lv_obj {
let screen: lv_obj = lv_obj_create(0);
lv_screen_load_anim(screen, LV_SCR_LOAD_ANIM_FADE_IN, 200, 0, false);

// Title
let title: lv_obj = lv_label_create(screen);
lv_obj_set_pos(title, 300, 80);
lv_label_set_text(title, "Settings Panel");

// Checkboxes
let cb1: lv_obj = lv_checkbox_create(screen);
lv_obj_set_pos(cb1, 280, 150);
lv_checkbox_set_text(cb1, "Enable notifications");

let cb2: lv_obj = lv_checkbox_create(screen);
lv_obj_set_pos(cb2, 280, 200);
lv_checkbox_set_text(cb2, "Auto-save enabled");

let cb3: lv_obj = lv_checkbox_create(screen);
lv_obj_set_pos(cb3, 280, 250);
lv_checkbox_set_text(cb3, "Dark mode");

let cb4: lv_obj = lv_checkbox_create(screen);
lv_obj_set_pos(cb4, 280, 300);
lv_checkbox_set_text(cb4, "Show advanced options");

return screen;
}`
    },
    'switches': {
        name: '7. Switch Panel',
        code: `// Switch controls
function init(): lv_obj {
let screen: lv_obj = lv_obj_create(0);
lv_screen_load_anim(screen, LV_SCR_LOAD_ANIM_FADE_IN, 200, 0, false);

// Title
let title: lv_obj = lv_label_create(screen);
lv_obj_set_pos(title, 300, 80);
lv_label_set_text(title, "Control Panel");

// WiFi switch
let label1: lv_obj = lv_label_create(screen);
lv_obj_set_pos(label1, 250, 150);
lv_label_set_text(label1, "WiFi");

let sw1: lv_obj = lv_switch_create(screen);
lv_obj_set_pos(sw1, 450, 145);

// Bluetooth switch
let label2: lv_obj = lv_label_create(screen);
lv_obj_set_pos(label2, 250, 210);
lv_label_set_text(label2, "Bluetooth");

let sw2: lv_obj = lv_switch_create(screen);
lv_obj_set_pos(sw2, 450, 205);

// Airplane mode
let label3: lv_obj = lv_label_create(screen);
lv_obj_set_pos(label3, 250, 270);
lv_label_set_text(label3, "Airplane Mode");

let sw3: lv_obj = lv_switch_create(screen);
lv_obj_set_pos(sw3, 450, 265);

return screen;
}`
    },
    'spinner': {
        name: '8. Spinner & Loading',
        code: `// Loading spinner
function init(): lv_obj {
let screen: lv_obj = lv_obj_create(0);
lv_screen_load_anim(screen, LV_SCR_LOAD_ANIM_FADE_IN, 200, 0, false);

// Title
let title: lv_obj = lv_label_create(screen);
lv_obj_set_pos(title, 320, 100);
lv_label_set_text(title, "Loading...");

// Spinner
let spinner: lv_obj = lv_spinner_create(screen);
lv_obj_set_pos(spinner, 350, 180);
lv_obj_set_size(spinner, 100, 100);
lv_spinner_set_anim_params(spinner, 1000, 60);

// Status label
let status: lv_obj = lv_label_create(screen);
lv_obj_set_pos(status, 290, 320);
lv_label_set_text(status, "Please wait...");

return screen;
}`
    },
    'roller': {
        name: '9. Roller Selector',
        code: `// Roller selector widget
function init(): lv_obj {
let screen: lv_obj = lv_obj_create(0);
lv_screen_load_anim(screen, LV_SCR_LOAD_ANIM_FADE_IN, 200, 0, false);

// Title
let title: lv_obj = lv_label_create(screen);
lv_obj_set_pos(title, 300, 60);
lv_label_set_text(title, "Select Option");

// Roller
let roller: lv_obj = lv_roller_create(screen);
lv_obj_set_pos(roller, 320, 120);
lv_roller_set_options(roller, "Option 1\\nOption 2\\nOption 3\\nOption 4\\nOption 5\\nOption 6\\nOption 7", 0);
lv_roller_set_selected(roller, 2, 0);

return screen;
}`
    },
    'dashboard': {
        name: '10. Full Dashboard',
        code: `// Create a title label with custom styling
function create_title(parent: lv_obj, text: string, x: number, y: number): lv_obj {
let label: lv_obj = lv_label_create(parent);
lv_obj_set_pos(label, x, y);
lv_label_set_text(label, text);
return label;
}

// Create a button with label
function create_button(parent: lv_obj, label_text: string, x: number, y: number, w: number, h: number): lv_obj {
let button: lv_obj = lv_button_create(parent);
lv_obj_set_pos(button, x, y);
lv_obj_set_size(button, w, h);

let label: lv_obj = lv_label_create(button);
lv_obj_set_size(label, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
lv_obj_set_style_align(label, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
lv_label_set_text(label, label_text);

return button;
}

// Create a slider with label
function create_slider_panel(parent: lv_obj, label_text: string, x: number, y: number): lv_obj {
let label: lv_obj = lv_label_create(parent);
lv_obj_set_pos(label, x, y);
lv_label_set_text(label, label_text);

let slider: lv_obj = lv_slider_create(parent);
lv_obj_set_pos(slider, x, y + 30);
lv_obj_set_size(slider, 200, 10);
lv_slider_set_range(slider, 0, 100);
lv_slider_set_value(slider, 50, 0);

return slider;
}

// Create a switch with label
function create_switch_panel(parent: lv_obj, label_text: string, x: number, y: number): lv_obj {
let label: lv_obj = lv_label_create(parent);
lv_obj_set_pos(label, x, y);
lv_label_set_text(label, label_text);

let sw: lv_obj = lv_switch_create(parent);
lv_obj_set_pos(sw, x + 120, y - 5);

return sw;
}

// Create an arc widget
function create_arc_panel(parent: lv_obj, label_text: string, x: number, y: number): lv_obj {
let label: lv_obj = lv_label_create(parent);
lv_obj_set_pos(label, x + 30, y - 25);
lv_label_set_text(label, label_text);

let arc: lv_obj = lv_arc_create(parent);
lv_obj_set_pos(arc, x, y);
lv_obj_set_size(arc, 120, 120);
lv_arc_set_range(arc, 0, 100);
lv_arc_set_value(arc, 75);
lv_arc_set_bg_start_angle(arc, 135);
lv_arc_set_bg_end_angle(arc, 45);

return arc;
}

// Create a bar widget
function create_bar_panel(parent: lv_obj, label_text: string, x: number, y: number): lv_obj {
let label: lv_obj = lv_label_create(parent);
lv_obj_set_pos(label, x, y);
lv_label_set_text(label, label_text);

let bar: lv_obj = lv_bar_create(parent);
lv_obj_set_pos(bar, x, y + 30);
lv_obj_set_size(bar, 200, 20);
lv_bar_set_range(bar, 0, 100);
lv_bar_set_value(bar, 65, 0);

return bar;
}

// Create a checkbox
function create_checkbox_panel(parent: lv_obj, label_text: string, x: number, y: number): lv_obj {
let checkbox: lv_obj = lv_checkbox_create(parent);
lv_obj_set_pos(checkbox, x, y);
lv_checkbox_set_text(checkbox, label_text);

return checkbox;
}

// Create LED indicator
function create_led_panel(parent: lv_obj, label_text: string, x: number, y: number, color: number): lv_obj {
let label: lv_obj = lv_label_create(parent);
lv_obj_set_pos(label, x + 30, y + 5);
lv_label_set_text(label, label_text);

let led: lv_obj = lv_led_create(parent);
lv_obj_set_pos(led, x, y);
lv_obj_set_size(led, 20, 20);
lv_led_set_color(led, color);
lv_led_set_brightness(led, 255);

return led;
}

// Main screen initialization function
function init(): lv_obj {
let screen: lv_obj = lv_obj_create(0);
lv_screen_load_anim(screen, LV_SCR_LOAD_ANIM_FADE_IN, 200, 0, false);

// Dashboard Title
create_title(screen, "LVGL Dashboard Demo", 250, 20);

// Row 1: Sliders
create_slider_panel(screen, "Temperature", 50, 70);
create_slider_panel(screen, "Humidity", 300, 70);
create_slider_panel(screen, "Pressure", 550, 70);

// Row 2: Switches and Arc
create_switch_panel(screen, "Power", 50, 150);
create_switch_panel(screen, "WiFi", 50, 190);
create_switch_panel(screen, "Bluetooth", 50, 230);

create_arc_panel(screen, "Speed", 320, 160);

create_bar_panel(screen, "CPU Load", 530, 150);
create_bar_panel(screen, "Memory", 530, 210);

// Row 3: Checkboxes
create_checkbox_panel(screen, "Enable Logging", 50, 300);
create_checkbox_panel(screen, "Auto Update", 50, 340);
create_checkbox_panel(screen, "Dark Mode", 50, 380);

// Row 3: LED Status Indicators
create_led_panel(screen, "System OK", 300, 300, 0x00FF00);
create_led_panel(screen, "Warning", 300, 340, 0xFFA500);
create_led_panel(screen, "Error", 300, 380, 0xFF0000);

// Row 3: Action Buttons
create_button(screen, "Start", 530, 300, 100, 40);
create_button(screen, "Stop", 640, 300, 100, 40);
create_button(screen, "Reset", 530, 350, 100, 40);
create_button(screen, "Settings", 640, 350, 100, 40);

return screen;
}`
    }
};

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

        // Generate and display JS code
        const jsCode = currentScript.emitJS();
        document.getElementById('jsOutput').textContent = jsCode;

        // Generate and display C code
        const cCode = currentScript.emitC();
        document.getElementById('cOutput').textContent = cCode;

        // Find and execute the init function (try common names)
        const initFunctions = ['init', 'main', 'init_dashboard', 'init_simple', 'init_button', 'init_slider', 'init_leds'];
        let executed = false;

        for (const funcName of initFunctions) {
            try {
                currentScript.exec(funcName);
                executed = true;
                showStatus('✓ Script executed successfully!');
                break;
            } catch (e) {
                // Try next function name
            }
        }

        if (!executed) {
            showError('No entry function found. Please define one of: ' + initFunctions.join(', '));
        }

    } catch (error) {
        showError('Error: ' + error.message);
        console.error(error);
    }
}
window.runScript = runScript;

// Load saved script on page load
function loadSavedScript() {
    const saved = localStorage.getItem('eez_script_saved');
    if (saved) {
        document.getElementById('scriptInput').value = saved;
    } else {
        // Load default example
        document.getElementById('scriptInput').value = EXAMPLE_SCRIPTS['simple'].code;
    }
}
