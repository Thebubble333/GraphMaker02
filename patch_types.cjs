const fs = require('fs');
let code = fs.readFileSync('types.ts', 'utf8');

if (!code.includes('labelOffset?: { x: number; y: number };')) {
    code = code.replace(
        /labelPos: 'top' \| 'left' \| 'none';/,
        "labelPos: 'top' | 'left' | 'none';\n  labelOffset?: { x: number; y: number };"
    );
    fs.writeFileSync('types.ts', code);
    console.log('Patched types.ts');
} else {
    console.log('types.ts already patched');
}
