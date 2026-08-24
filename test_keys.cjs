const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

console.log(code.includes('if (e.shiftKey) {'));

