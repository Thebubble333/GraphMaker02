const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

// The exported optimizeLabelPlacements function has access to globalVertexLabelProximity as an argument now.
// The default fallback in optimizeLabelPlacements:
code = code.replace(/if \(baseDx === undefined \|\| baseDy === undefined\) \{\n            baseDx = 15; baseDy = -15;\n        \}/, 
"if (baseDx === undefined || baseDy === undefined) {\n            baseDx = globalVertexLabelProximity * 0.707; baseDy = -globalVertexLabelProximity * 0.707;\n        }");

// The draggingLabel logic has NO access to globalVertexLabelProximity natively because it's inside the component!
code = code.replace(/if \(baseOffX === undefined \|\| baseOffY === undefined\) \{ baseOffX = 15; baseOffY = -15; \}/,
"if (baseOffX === undefined || baseOffY === undefined) { baseOffX = globalVertexLabelProximity * 0.707; baseOffY = -globalVertexLabelProximity * 0.707; }");

// For the rest inside the component:
code = code.replace(/\{ x: 15, y: -15 \}/g, "{ x: globalVertexLabelProximity * 0.707, y: -globalVertexLabelProximity * 0.707 }");

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
console.log('Replaced 15, -15 with globalVertexLabelProximity');
