const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

const regex = /let baseOffY = ed\.labelOffset\?\.y \|\| -15;/g;
code = code.replace(regex, 'let baseOffY = ed.labelOffset?.y || 0;');

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
console.log('Fixed edge label offset fallback');
