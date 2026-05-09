const fs = require('fs');
const file = 'pages/TreeDiagrams.tsx';
let code = fs.readFileSync(file, 'utf8');

// Replace standard renderToSVG 16 with ptToSvgUnits(fontSize)
code = code.replace(/texEngine\.renderToSVG\((.*?), (.*?), (.*?), 16, /g, 'texEngine.renderToSVG($1, $2, $3, ptToSvgUnits(fontSize), ');

// Replace fontSize="18" inside <text>
code = code.replace(/fontSize="18"/g, 'fontSize={ptToSvgUnits(fontSize)}');

fs.writeFileSync(file, code, 'utf8');
console.log('done replacing');
