const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

code = code.replace(
    /const adjustedNodes = res\.nodes\.map\(n => \(\{\n\s*\.\.\.n,\n\s*labelStyle: 'none' as const,\n\s*radius: 6\n\s*\}\)\);/,
    "const adjustedNodes = res.nodes.map(n => ({\n            ...n,\n            labelStyle: 'none' as const,\n            radius: globalNodeRadius\n        }));"
);

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
