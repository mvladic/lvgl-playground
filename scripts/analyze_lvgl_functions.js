const fs = require('fs');
const path = require('path');

// Read the allLvglFunctions from lvgl-functions.json
const lvglFunctionsJson = JSON.parse(
    fs.readFileSync('../gen-studio-symbols/lvgl-functions.json', 'utf8')
);

const allSymbols = lvglFunctionsJson.allLvglFunctions.filter(s => s.startsWith('lv_'));

// Patterns to identify non-functions
const typePatterns = [
    /_t$/,           // ends with _t (types)
    /_class$/,       // ends with _class (class definitions)
    /^lv_font_$/,    // lv_font_ prefix pattern
    /^lv_cf$/,       // lv_cf (enum)
    /^lv_fallback$/,
    /^lv_font_conv$/,
    /^lv_img_conv$/,
    /^lv_img_conv_v9$/,
    /^lv_font_montserrat_24$/,
    /^lv_include$/,
    /^lv_pct$/,      // macro
    /^lv_style_set_$/,  // prefix pattern
    /^lv_obj_set_style_$/,  // prefix pattern
];

// Filter out obvious non-functions based on naming patterns
const potentialFunctions = allSymbols.filter(symbol => {
    return !typePatterns.some(pattern => pattern.test(symbol));
});

// Now search LVGL headers for function declarations
const lvglDir = '../../lvgl-runtime/v9.2.2/lvgl/src';

function searchHeaders(dir, functions) {
    const found = new Map();
    
    function searchDir(currentDir) {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            
            if (entry.isDirectory()) {
                searchDir(fullPath);
            } else if (entry.name.endsWith('.h')) {
                const content = fs.readFileSync(fullPath, 'utf8');
                const lines = content.split('\n');
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    
                    // Skip comments, typedefs, externs for non-functions
                    if (line.startsWith('//') || line.startsWith('/*') || 
                        line.startsWith('*') || line.includes('typedef')) {
                        continue;
                    }
                    
                    // Look for function declarations
                    for (const func of functions) {
                        // Pattern: return_type function_name(params)
                        const funcPattern = new RegExp(`\\b${func}\\s*\\(`);
                        if (funcPattern.test(line) && !found.has(func)) {
                            // Extract return type and params if possible
                            const match = line.match(/^(\S+\s+\**)\s*(\w+)\s*\((.*?)\)/);
                            if (match) {
                                found.set(func, {
                                    returnType: match[1].trim(),
                                    params: match[3]
                                });
                            } else {
                                found.set(func, { returnType: 'unknown', params: 'unknown' });
                            }
                        }
                    }
                }
            }
        }
    }
    
    searchDir(dir);
    return found;
}

console.log(`Searching for ${potentialFunctions.length} potential functions...`);
const foundFunctions = searchHeaders(lvglDir, potentialFunctions);

console.log(`Found ${foundFunctions.size} functions in headers`);

// Generate output
const result = {};
for (const [funcName, info] of foundFunctions) {
    result[funcName] = info;
}

// Write results
fs.writeFileSync('lvgl_functions_found.json', JSON.stringify(result, null, 2));
console.log('Results written to lvgl_functions_found.json');

// Also print function names only
const functionNames = Array.from(foundFunctions.keys()).sort();
console.log('\nFunction names:');
console.log(functionNames.join('\n'));
