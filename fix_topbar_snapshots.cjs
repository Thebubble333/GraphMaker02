const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

code = code.replace(/onClick=\{\(\) => applyVertexStyle\('none'\)\}/g, "onClick={() => { forceSnapshot(); applyVertexStyle('none'); }}");
code = code.replace(/onClick=\{\(\) => applyVertexStyle\('outside'\)\}/g, "onClick={() => { forceSnapshot(); applyVertexStyle('outside'); }}");
code = code.replace(/onClick=\{\(\) => applyVertexStyle\('inside'\)\}/g, "onClick={() => { forceSnapshot(); applyVertexStyle('inside'); }}");

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
console.log('Fixed topbar snapshots');
