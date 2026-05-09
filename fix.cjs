const fs = require('fs');
const files = [
  'pages/BoxPlots.tsx',
  'pages/DotPlots.tsx',
  'pages/PieCharts.tsx',
  'pages/BarCharts.tsx',
  'pages/SegmentedBarCharts.tsx',
  'pages/Histograms.tsx',
  'pages/NumberLine.tsx',
  'pages/VisualQuartiles.tsx',
  'pages/StemAndLeaf.tsx'
];
files.forEach(f => {
  const code = fs.readFileSync(f, 'utf8');
  // replace fontSize: \d+ -> fontSize: 11
  const updated = code.replace(/fontSize:\s*\d+/g, 'fontSize: 11');
  fs.writeFileSync(f, updated, 'utf8');
});
console.log('done');
