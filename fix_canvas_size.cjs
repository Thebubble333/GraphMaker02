const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

code = code.replace(/const \[canvasWidth, setCanvasWidth\] = useState\(454\);/, 'const [canvasWidth, setCanvasWidth] = useState(378);');
code = code.replace(/setCanvasWidth\(454\); setCanvasHeight\(302\);/g, 'setCanvasWidth(378); setCanvasHeight(302);');

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
console.log('Fixed default canvas size.');
