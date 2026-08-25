const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

const oldEffect = /useEffect\(\(\) => \{\n\s*\/\/ Populate initial graph on mount with first planar preset\n\s*const defaultPreset = MATRIX_PRESETS\[0\];\n\s*applyMatrixToGraph\(defaultPreset\.value, defaultPreset\.directed, showMatrixWeights, false, defaultPreset\.positions\);\n\s*\}, \[\]\);/;

const newEffect = `useEffect(() => {
        // Populate initial graph on mount with first planar preset
        // ONLY if no previous state exists in localStorage
        const saved = localStorage.getItem('ais_state_NetworkGrapher');
        if (!saved) {
            const defaultPreset = MATRIX_PRESETS[0];
            applyMatrixToGraph(defaultPreset.value, defaultPreset.directed, showMatrixWeights, false, defaultPreset.positions);
        }
    }, []);`;

code = code.replace(oldEffect, newEffect);
fs.writeFileSync('pages/NetworkGrapher.tsx', code);
console.log('Fixed mount bug');
