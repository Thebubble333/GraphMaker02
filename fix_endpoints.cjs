const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

const regex = /currentNodes\.forEach\(on => \{\n\s*let d = distPointToRect/g;
const replacement = `currentNodes.forEach(on => {
                if (on.id === e.from || on.id === e.to) return;
                let d = distPointToRect`;

code = code.replace(regex, replacement);

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
