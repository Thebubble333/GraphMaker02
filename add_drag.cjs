const fs = require('fs');
let code = fs.readFileSync('pages/BoxPlots.tsx', 'utf8');

const dragCode = `
  const handleBoxDragStart = (id: string, initialOffset: number, e: React.MouseEvent) => {
      e.stopPropagation();
      onMouseDown(e, { initialOffset }, (dx, dy, init) => {
          const mathYDelta = -(dy / engine.scaleY);
          setBoxPlots(prev => prev.map(b => {
              if (b.id !== id) return b;
              return { ...b, heightOffset: init.initialOffset + mathYDelta };
          }));
      });
  };
`;

code = code.replace(
    /const handleAxisLabelDragStart = \(axis: 'x' \| 'y', e: React\.MouseEvent\) => \{/,
    dragCode + "\n  const handleAxisLabelDragStart = (axis: 'x' | 'y', e: React.MouseEvent) => {"
);

fs.writeFileSync('pages/BoxPlots.tsx', code);
console.log('Added handleBoxDragStart');
