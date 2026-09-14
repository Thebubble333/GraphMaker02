const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');
code = code.split('if (!res)').join(''); // Wait, what if there were real `if (!res)`?
fs.writeFileSync('pages/NetworkGrapher.tsx', code);
