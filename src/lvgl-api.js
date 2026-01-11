// LVGL API Manager - Loads and manages LVGL API data for multiple versions
// This module handles loading JSON API files and provides version-specific
// functions, constants, and help documentation.

const SUPPORTED_VERSIONS = ['8.4.0', '9.2.2', '9.3.0', '9.4.0'];
const DEFAULT_VERSION = '9.2.2';

// Function name mappings between versions
// Maps v9 names to v8 names and vice versa
const FUNCTION_ALIASES = {
    // Widget renames (v8 -> v9)
    'lv_btn_create': 'lv_button_create',
    'lv_btnmatrix_create': 'lv_buttonmatrix_create',
    'lv_btnmatrix_set_map': 'lv_buttonmatrix_set_map',
    'lv_btnmatrix_set_ctrl_map': 'lv_buttonmatrix_set_ctrl_map',
    'lv_btnmatrix_set_one_checked': 'lv_buttonmatrix_set_one_checked',
    'lv_img_create': 'lv_image_create',
    'lv_img_set_src': 'lv_image_set_src',
    'lv_img_set_pivot': 'lv_image_set_pivot',
    'lv_img_set_rotation': 'lv_image_set_rotation',
    'lv_img_set_scale': 'lv_image_set_scale',
    'lv_img_set_inner_align': 'lv_image_set_inner_align',
    'lv_imgbtn_create': 'lv_imagebutton_create',
    'lv_imgbtn_set_src': 'lv_imagebutton_set_src',
    
    // Screen functions (v8 -> v9)
    'lv_scr_load_anim': 'lv_screen_load_anim',
    'lv_scr_load': 'lv_screen_load',
    
    // Display functions (v8 -> v9)
    'lv_disp_get_scr_act': 'lv_display_get_screen_active',
    'lv_disp_get_scr_prev': 'lv_display_get_screen_prev',
    'lv_disp_load_scr': 'lv_display_load_scr',
    'lv_disp_get_layer_top': 'lv_display_get_layer_top',
    'lv_disp_get_layer_sys': 'lv_display_get_layer_sys',
    'lv_disp_set_theme': 'lv_display_set_theme',
    'lv_disp_get_theme': 'lv_display_get_theme',
    'lv_disp_set_bg_color': 'lv_display_set_bg_color',
    'lv_disp_set_bg_image': 'lv_display_set_bg_image',
    'lv_disp_set_bg_opa': 'lv_display_set_bg_opa',
    
    // Object functions (v8 -> v9)
    'lv_obj_del': 'lv_obj_delete',
    'lv_obj_clean': 'lv_obj_delete_children',
    
    // v9 -> v8 (reverse mappings)
    'lv_button_create': 'lv_btn_create',
    'lv_buttonmatrix_create': 'lv_btnmatrix_create',
    'lv_buttonmatrix_set_map': 'lv_btnmatrix_set_map',
    'lv_buttonmatrix_set_ctrl_map': 'lv_btnmatrix_set_ctrl_map',
    'lv_buttonmatrix_set_one_checked': 'lv_btnmatrix_set_one_checked',
    'lv_image_create': 'lv_img_create',
    'lv_image_set_src': 'lv_img_set_src',
    'lv_image_set_pivot': 'lv_img_set_pivot',
    'lv_image_set_rotation': 'lv_img_set_rotation',
    'lv_image_set_scale': 'lv_img_set_scale',
    'lv_image_set_inner_align': 'lv_img_set_inner_align',
    'lv_imagebutton_create': 'lv_imgbtn_create',
    'lv_imagebutton_set_src': 'lv_imgbtn_set_src',
    'lv_screen_load_anim': 'lv_scr_load_anim',
    'lv_screen_load': 'lv_scr_load',
    'lv_display_get_screen_active': 'lv_disp_get_scr_act',
    'lv_obj_delete': 'lv_obj_del',
    'lv_obj_delete_children': 'lv_obj_clean',
};

// Constant name mappings between versions
// Maps v9 names to v8 names and vice versa
const CONSTANT_ALIASES = {
    // Screen load animation constants (v8 -> v9)
    'LV_SCR_LOAD_ANIM_NONE': 'LV_SCREEN_LOAD_ANIM_NONE',
    'LV_SCR_LOAD_ANIM_OVER_LEFT': 'LV_SCREEN_LOAD_ANIM_OVER_LEFT',
    'LV_SCR_LOAD_ANIM_OVER_RIGHT': 'LV_SCREEN_LOAD_ANIM_OVER_RIGHT',
    'LV_SCR_LOAD_ANIM_OVER_TOP': 'LV_SCREEN_LOAD_ANIM_OVER_TOP',
    'LV_SCR_LOAD_ANIM_OVER_BOTTOM': 'LV_SCREEN_LOAD_ANIM_OVER_BOTTOM',
    'LV_SCR_LOAD_ANIM_MOVE_LEFT': 'LV_SCREEN_LOAD_ANIM_MOVE_LEFT',
    'LV_SCR_LOAD_ANIM_MOVE_RIGHT': 'LV_SCREEN_LOAD_ANIM_MOVE_RIGHT',
    'LV_SCR_LOAD_ANIM_MOVE_TOP': 'LV_SCREEN_LOAD_ANIM_MOVE_TOP',
    'LV_SCR_LOAD_ANIM_MOVE_BOTTOM': 'LV_SCREEN_LOAD_ANIM_MOVE_BOTTOM',
    'LV_SCR_LOAD_ANIM_FADE_IN': 'LV_SCREEN_LOAD_ANIM_FADE_IN',
    'LV_SCR_LOAD_ANIM_FADE_ON': 'LV_SCREEN_LOAD_ANIM_FADE_ON',
    'LV_SCR_LOAD_ANIM_FADE_OUT': 'LV_SCREEN_LOAD_ANIM_FADE_OUT',
    'LV_SCR_LOAD_ANIM_OUT_LEFT': 'LV_SCREEN_LOAD_ANIM_OUT_LEFT',
    'LV_SCR_LOAD_ANIM_OUT_RIGHT': 'LV_SCREEN_LOAD_ANIM_OUT_RIGHT',
    'LV_SCR_LOAD_ANIM_OUT_TOP': 'LV_SCREEN_LOAD_ANIM_OUT_TOP',
    'LV_SCR_LOAD_ANIM_OUT_BOTTOM': 'LV_SCREEN_LOAD_ANIM_OUT_BOTTOM',
    
    // v9 -> v8 (reverse mappings for screen load animations)
    'LV_SCREEN_LOAD_ANIM_NONE': 'LV_SCR_LOAD_ANIM_NONE',
    'LV_SCREEN_LOAD_ANIM_OVER_LEFT': 'LV_SCR_LOAD_ANIM_OVER_LEFT',
    'LV_SCREEN_LOAD_ANIM_OVER_RIGHT': 'LV_SCR_LOAD_ANIM_OVER_RIGHT',
    'LV_SCREEN_LOAD_ANIM_OVER_TOP': 'LV_SCR_LOAD_ANIM_OVER_TOP',
    'LV_SCREEN_LOAD_ANIM_OVER_BOTTOM': 'LV_SCR_LOAD_ANIM_OVER_BOTTOM',
    'LV_SCREEN_LOAD_ANIM_MOVE_LEFT': 'LV_SCR_LOAD_ANIM_MOVE_LEFT',
    'LV_SCREEN_LOAD_ANIM_MOVE_RIGHT': 'LV_SCR_LOAD_ANIM_MOVE_RIGHT',
    'LV_SCREEN_LOAD_ANIM_MOVE_TOP': 'LV_SCR_LOAD_ANIM_MOVE_TOP',
    'LV_SCREEN_LOAD_ANIM_MOVE_BOTTOM': 'LV_SCR_LOAD_ANIM_MOVE_BOTTOM',
    'LV_SCREEN_LOAD_ANIM_FADE_IN': 'LV_SCR_LOAD_ANIM_FADE_IN',
    'LV_SCREEN_LOAD_ANIM_FADE_ON': 'LV_SCR_LOAD_ANIM_FADE_ON',
    'LV_SCREEN_LOAD_ANIM_FADE_OUT': 'LV_SCR_LOAD_ANIM_FADE_OUT',
    'LV_SCREEN_LOAD_ANIM_OUT_LEFT': 'LV_SCR_LOAD_ANIM_OUT_LEFT',
    'LV_SCREEN_LOAD_ANIM_OUT_RIGHT': 'LV_SCR_LOAD_ANIM_OUT_RIGHT',
    'LV_SCREEN_LOAD_ANIM_OUT_TOP': 'LV_SCR_LOAD_ANIM_OUT_TOP',
    'LV_SCREEN_LOAD_ANIM_OUT_BOTTOM': 'LV_SCR_LOAD_ANIM_OUT_BOTTOM',
    
    // Image align constants (v8 style names don't exist, only v9 has these)
    // But we might have LV_IMG_ALIGN -> LV_IMAGE_ALIGN if they existed
};

// API data storage
let apiData = {};
let currentVersion = DEFAULT_VERSION;

// Processed data for current version
let allowedFunctions = {};
let LVGL_CONSTANTS = {};
let helpData = null;

/**
 * Load API data for a specific version
 * @param {string} version - The LVGL version to load
 * @returns {Promise<Object>} The loaded API data
 */
async function loadApiData(version) {
    if (apiData[version]) {
        return apiData[version];
    }

    const response = await fetch(`data/lvgl-v${version}-api.json`);
    if (!response.ok) {
        throw new Error(`Failed to load API data for version ${version}`);
    }

    apiData[version] = await response.json();
    return apiData[version];
}

/**
 * Map C type to internal type representation
 * @param {string} cType - The C type string
 * @returns {string} The internal type
 */
function mapCTypeToInternal(cType) {
    if (!cType) return 'number';

    // Normalize the type string
    const normalized = cType.replace(/\s+/g, ' ').trim();

    // Object types
    if (normalized.includes('lv_obj_t')) {
        return 'lv_obj';
    }

    // Color type
    if (normalized.includes('lv_color_t')) {
        return 'lv_color';
    }

    // Callback types
    if (normalized.includes('_cb_t') || normalized.includes('_cb ')) {
        return 'function';
    }

    // String types
    if (normalized.includes('char *') || normalized.includes('char*')) {
        return 'cstring';
    }

    // Boolean
    if (normalized === 'bool') {
        return 'bool';
    }

    // Void (no return)
    if (normalized === 'void') {
        return 'void';
    }

    // Everything else is treated as number (int, uint32_t, etc.)
    return 'number';
}

/**
 * Process function definition from API JSON to internal format
 * @param {Object} funcDef - The function definition from JSON
 * @returns {Object} Processed function spec
 */
function processFunctionDef(funcDef) {
    const params = (funcDef.args || []).map(arg => mapCTypeToInternal(arg.type));
    const returnType = mapCTypeToInternal(funcDef.returns);

    const result = {
        params,
        returnType: returnType === 'void' ? 'number' : returnType,
        description: funcDef.description || '',
        returnsDescription: funcDef.returnsDescription || '',
        args: funcDef.args || []
    };

    // If static_inline is present, use it as the runtime function name
    // The original name is used in emitC, but runtimeName is used in interpreter and emitJS
    if (funcDef.static_inline) {
        result.runtimeName = funcDef.static_inline;
    }

    return result;
}

/**
 * Build allowed functions map from API data
 * @param {Object} data - The API data
 * @returns {Object} Map of function name to spec
 */
function buildAllowedFunctions(data) {
    const functions = {};

    // Process concepts (core functions)
    if (data.functions && data.functions.concepts) {
        for (const [groupName, groupFuncs] of Object.entries(data.functions.concepts)) {
            for (const funcDef of groupFuncs) {
                functions[funcDef.name] = {
                    ...processFunctionDef(funcDef),
                    group: groupName,
                    category: 'concepts'
                };
            }
        }
    }

    // Process widgets
    if (data.functions && data.functions.widgets) {
        for (const [widgetName, widgetFuncs] of Object.entries(data.functions.widgets)) {
            for (const funcDef of widgetFuncs) {
                functions[funcDef.name] = {
                    ...processFunctionDef(funcDef),
                    group: widgetName,
                    category: 'widgets'
                };
            }
        }
    }

    return functions;
}

/**
 * Add function aliases so code written for one version works on another
 * If a function exists in the API, add an alias with the alternative name
 * @param {Object} functions - The functions map to extend
 */
function addFunctionAliases(functions) {
    for (const [aliasName, targetName] of Object.entries(FUNCTION_ALIASES)) {
        // If the target function exists and the alias doesn't, add the alias
        if (functions[targetName] && !functions[aliasName]) {
            functions[aliasName] = {
                ...functions[targetName],
                aliasOf: targetName,
                isAlias: true
            };
        }
    }
}

/**
 * Add constant aliases so code written for one version works on another
 * If a constant exists in the API, add an alias with the alternative name
 * @param {Object} constants - The constants map to extend
 */
function addConstantAliases(constants) {
    for (const [aliasName, targetName] of Object.entries(CONSTANT_ALIASES)) {
        // If the target constant exists and the alias doesn't, add the alias
        if (constants[targetName] && !constants[aliasName]) {
            constants[aliasName] = {
                ...constants[targetName],
                aliasOf: targetName,
                isAlias: true
            };
        }
    }
}

/**
 * Build constants map from API data (enums and styles)
 * @param {Object} data - The API data
 * @returns {Object} Map of constant name to value and metadata
 */
function buildConstants(data) {
    const constants = {};

    // Process enums from all type sections
    if (data.types) {
        for (const [sectionName, section] of Object.entries(data.types)) {
            if (section.enums) {
                for (const [enumName, enumDef] of Object.entries(section.enums)) {
                    if (enumDef.items) {
                        for (const item of enumDef.items) {
                            // Skip items with complex expressions that result in 0
                            if (item.number !== undefined && item.number !== null) {
                                constants[item.name] = {
                                    value: item.number,
                                    enumType: enumName,
                                    description: item.description || '',
                                    category: 'enum'
                                };
                            }
                        }
                    }
                }
            }
        }
    }

    // Process styles
    if (data.styles) {
        for (const style of data.styles) {
            if (style.number !== undefined && style.number !== null) {
                constants[style.name] = {
                    value: style.number,
                    description: style.description || '',
                    category: 'style'
                };
            }
        }
    }

    // Process root-level constants
    if (data.constants) {
        for (const [name, constDef] of Object.entries(data.constants)) {
            if (constDef.number !== undefined && constDef.number !== null) {
                constants[name] = {
                    value: constDef.number,
                    description: constDef.description || '',
                    category: 'constant'
                };
            }
        }
    }

    return constants;
}

/**
 * Build help data structure from API data
 * @param {Object} data - The API data
 * @param {Object} functions - The processed functions map
 * @param {Object} constants - The processed constants map
 * @returns {Object} Help data structure
 */
function buildHelpData(data, functions, constants) {
    const help = {
        functionGroups: {},
        constantGroups: {}
    };

    // Group functions by category and group
    for (const [funcName, funcSpec] of Object.entries(functions)) {
        const category = funcSpec.category || 'other';
        const group = funcSpec.group || 'other';
        const key = `${category}/${group}`;

        if (!help.functionGroups[key]) {
            help.functionGroups[key] = {
                category,
                group,
                functions: []
            };
        }

        help.functionGroups[key].functions.push({
            name: funcName,
            ...funcSpec
        });
    }

    // Sort functions within each group
    for (const groupData of Object.values(help.functionGroups)) {
        groupData.functions.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Group constants by enum type or category
    for (const [constName, constSpec] of Object.entries(constants)) {
        const group = constSpec.enumType || constSpec.category || 'other';

        if (!help.constantGroups[group]) {
            help.constantGroups[group] = {
                name: group,
                constants: []
            };
        }

        help.constantGroups[group].constants.push({
            name: constName,
            ...constSpec
        });
    }

    // Sort constants within each group
    for (const groupData of Object.values(help.constantGroups)) {
        groupData.constants.sort((a, b) => a.name.localeCompare(b.name));
    }

    return help;
}

/**
 * Set the current LVGL version and rebuild data structures
 * @param {string} version - The version to set
 * @returns {Promise<void>}
 */
async function setVersion(version) {
    if (!SUPPORTED_VERSIONS.includes(version)) {
        throw new Error(`Unsupported LVGL version: ${version}. Supported: ${SUPPORTED_VERSIONS.join(', ')}`);
    }

    const data = await loadApiData(version);
    currentVersion = version;

    // Rebuild data structures
    allowedFunctions = buildAllowedFunctions(data);
    
    // Add function aliases for cross-version compatibility
    addFunctionAliases(allowedFunctions);
    
    // Build full constants with metadata
    const fullConstants = buildConstants(data);
    
    // Add constant aliases for cross-version compatibility
    addConstantAliases(fullConstants);
    
    // Create simple value map for runtime use
    LVGL_CONSTANTS = {};
    for (const [name, spec] of Object.entries(fullConstants)) {
        LVGL_CONSTANTS[name] = spec.value;
    }

    // Build help data (exclude aliases from help to avoid confusion)
    const functionsWithoutAliases = {};
    for (const [name, spec] of Object.entries(allowedFunctions)) {
        if (!spec.isAlias) {
            functionsWithoutAliases[name] = spec;
        }
    }
    helpData = buildHelpData(data, functionsWithoutAliases, fullConstants);

    console.log(`LVGL API loaded for version ${version}: ${Object.keys(allowedFunctions).length} functions (including aliases), ${Object.keys(LVGL_CONSTANTS).length} constants`);
}

/**
 * Get the simple allowed functions map (for runtime)
 * @returns {Object} Map of function name to {params, returnType, aliasOf?}
 */
function getAllowedFunctions() {
    // Return simplified version for runtime compatibility
    const simplified = {};
    for (const [name, spec] of Object.entries(allowedFunctions)) {
        simplified[name] = {
            params: spec.params,
            returnType: spec.returnType
        };
        // Include aliasOf so runtime can resolve to actual function name
        if (spec.aliasOf) {
            simplified[name].aliasOf = spec.aliasOf;
        }
        // Include runtimeName (from static_inline) so runtime knows the actual WASM function
        if (spec.runtimeName) {
            simplified[name].runtimeName = spec.runtimeName;
        }
    }
    return simplified;
}

/**
 * Get the full allowed functions map (with descriptions)
 * @returns {Object} Full function specifications
 */
function getAllowedFunctionsFull() {
    return allowedFunctions;
}

/**
 * Get the constants map
 * @returns {Object} Map of constant name to value
 */
function getConstants() {
    return LVGL_CONSTANTS;
}

/**
 * Get the help data
 * @returns {Object} Help data structure
 */
function getHelpData() {
    return helpData;
}

/**
 * Get current version
 * @returns {string} Current LVGL version
 */
function getCurrentVersion() {
    return currentVersion;
}

/**
 * Get supported versions
 * @returns {string[]} Array of supported version strings
 */
function getSupportedVersions() {
    return [...SUPPORTED_VERSIONS];
}

/**
 * Get default version
 * @returns {string} Default LVGL version
 */
function getDefaultVersion() {
    return DEFAULT_VERSION;
}

/**
 * Initialize the LVGL API (does not load any version yet)
 * @returns {Promise<void>}
 */
async function initLvglApi() {
    // Just a placeholder for any future initialization
    // Actual version loading is done via setVersion()
}

// Export for use in other modules
window.LvglApi = {
    init: initLvglApi,
    setVersion,
    getCurrentVersion,
    getSupportedVersions,
    getDefaultVersion,
    getAllowedFunctions,
    getAllowedFunctionsFull,
    getConstants,
    getHelpData
};
