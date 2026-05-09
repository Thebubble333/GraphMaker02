const fs = require('fs');
const files = [
  'pages/BoxBuilder.tsx',
  'pages/BoxPlots.tsx',
  'pages/DotPlots.tsx',
  'pages/ShapeBuilder.tsx',
  'pages/StemAndLeaf.tsx',
  'pages/VisualQuartiles.tsx'
];

files.forEach(file => {
  let code = fs.readFileSync(file, 'utf8');
  code = code.replace(/useState\(\{ width: 16,/g, 'useState({ width: 15,');
  code = code.replace(/useState\(\{ width: 20,/g, 'useState({ width: 15,');
  code = code.replace(/useState\(\{ width: 18,/g, 'useState({ width: 15,');
  fs.writeFileSync(file, code, 'utf8');
});
console.log('widths updated');
