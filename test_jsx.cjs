const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

let lines = code.split('\n');
for (let i = 2130; i < 2170; i++) {
    console.log(`${i+1}: ${lines[i]}`);
}
