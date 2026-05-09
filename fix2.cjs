const fs = require('fs');
const file = 'pages/FrequencyTables.tsx';
let code = fs.readFileSync(file, 'utf8');
code = code.replace(/fontSize="18"/g, 'fontSize={ptToSvgUnits(fontSize)}');
fs.writeFileSync(file, code, 'utf8');
console.log('done');
