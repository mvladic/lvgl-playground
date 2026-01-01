const fs = require('fs');

// Read the found functions
const foundFunctions = JSON.parse(fs.readFileSync('lvgl_functions_found.json', 'utf8'));

// Type mapping function
function mapCTypeToEezType(cType) {
    cType = cType.trim();
    
    // Pointer to lv_obj_t
    if (cType.includes('lv_obj_t') && cType.includes('*')) {
        return 'lv_obj';
    }
    
    // const char * (string parameter)
    if (cType.includes('char') && cType.includes('*')) {
        return 'cstring';
    }
    
    // Various int types
    if (cType.match(/\b(int|int8_t|int16_t|int32_t|int64_t|uint8_t|uint16_t|uint32_t|uint64_t|lv_coord_t|size_t)\b/)) {
        return 'number';
    }
    
    // Boolean
    if (cType.includes('bool')) {
        return 'bool';
    }
    
    // void return type
    if (cType === 'void') {
        return 'number'; // void functions return nothing, use number as default
    }
    
    // Default for pointers and other types
    return 'number';
}

function parseParams(paramsStr) {
    if (!paramsStr || paramsStr === 'void' || paramsStr === 'unknown') {
        return [];
    }
    
    // Simple parameter parsing - split by comma, but be careful with nested types
    const params = [];
    let depth = 0;
    let current = '';
    
    for (let i = 0; i < paramsStr.length; i++) {
        const char = paramsStr[i];
        if (char === '(' || char === '<') depth++;
        else if (char === ')' || char === '>') depth--;
        else if (char === ',' && depth === 0) {
            params.push(current.trim());
            current = '';
            continue;
        }
        current += char;
    }
    if (current.trim()) params.push(current.trim());
    
    // Extract types from parameters
    return params.map(param => {
        // Remove parameter name - take everything before the last word
        const parts = param.trim().split(/\s+/);
        if (parts.length === 0) return 'number';
        
        // Join all but last part (the name)
        const typeStr = parts.slice(0, -1).join(' ');
        return mapCTypeToEezType(typeStr || param);
    });
}

// Generate the allowedFunctions object
const allowedFunctions = {};

for (const [funcName, info] of Object.entries(foundFunctions)) {
    const params = parseParams(info.params);
    const returnType = mapCTypeToEezType(info.returnType);
    
    allowedFunctions[funcName] = {
        params,
        returnType
    };
}

// Format as JavaScript object for index.html
let output = 'const allowedFunctions = {\n';
for (const [funcName, info] of Object.entries(allowedFunctions).sort()) {
    const paramsStr = info.params.map(p => `'${p}'`).join(', ');
    output += `    '${funcName}': { params: [${paramsStr}], returnType: '${info.returnType}' },\n`;
}
output += '};';

fs.writeFileSync('allowed_functions.js', output);
console.log(`Generated allowedFunctions with ${Object.keys(allowedFunctions).length} functions`);
console.log('Output written to allowed_functions.js');
