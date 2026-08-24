const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

code = code.replace(
    /onClick=\{\(\) => \{\n\s*const newNodes = generateRegularPolygon/g,
    "onClick={() => {\n                                            forceSnapshot();\n                                            const newNodes = generateRegularPolygon"
);

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
console.log('Fixed Generate Layout snapshot');
