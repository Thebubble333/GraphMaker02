const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

code = code.replace(/const distToSegment = \([\s\S]*?return \{ dist: Math.hypot\(px - projX, py - projY\), projX, projY \};\n    \};\n/g, 
`const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
        let l2 = (x2 - x1)**2 + (y2 - y1)**2;
        if (l2 === 0) return { dist: Math.hypot(px - x1, py - y1), projX: x1, projY: y1 };
        let t = ((px - x1)*(x2 - x1) + (py - y1)*(y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        let projX = x1 + t * (x2 - x1);
        let projY = y1 + t * (y2 - y1);
        return { dist: Math.hypot(px - projX, py - projY), projX, projY };
    };
    
    const distPointToRect = (px: number, py: number, cx: number, cy: number, w: number, h: number) => {
        let dx = Math.max(Math.abs(px - cx) - w/2, 0);
        let dy = Math.max(Math.abs(py - cy) - h/2, 0);
        return Math.hypot(dx, dy);
    };
    
    const distRectToSegment = (cx: number, cy: number, w: number, h: number, x1: number, y1: number, x2: number, y2: number) => {
        let minDist = Infinity;
        let corners = [
            {x: cx - w/2, y: cy - h/2},
            {x: cx + w/2, y: cy - h/2},
            {x: cx + w/2, y: cy + h/2},
            {x: cx - w/2, y: cy + h/2}
        ];
        for (let c of corners) {
            minDist = Math.min(minDist, distToSegment(c.x, c.y, x1, y1, x2, y2).dist);
        }
        minDist = Math.min(minDist, distPointToRect(x1, y1, cx, cy, w, h));
        minDist = Math.min(minDist, distPointToRect(x2, y2, cx, cy, w, h));
        for (let i = 1; i < 5; i++) {
            let px = x1 + (x2 - x1) * (i / 5);
            let py = y1 + (y2 - y1) * (i / 5);
            minDist = Math.min(minDist, distPointToRect(px, py, cx, cy, w, h));
        }
        return minDist;
    };
`);

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
