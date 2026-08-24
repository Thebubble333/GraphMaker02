const distToSegment = (px, py, x1, y1, x2, y2) => {
    let l2 = (x2 - x1)**2 + (y2 - y1)**2;
    if (l2 === 0) return { dist: Math.hypot(px - x1, py - y1), projX: x1, projY: y1 };
    let t = ((px - x1)*(x2 - x1) + (py - y1)*(y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    let projX = x1 + t * (x2 - x1);
    let projY = y1 + t * (y2 - y1);
    return { dist: Math.hypot(px - projX, py - projY), projX, projY };
};

const distPointToRect = (px, py, cx, cy, w, h) => {
    let dx = Math.max(Math.abs(px - cx) - w/2, 0);
    let dy = Math.max(Math.abs(py - cy) - h/2, 0);
    return Math.hypot(dx, dy);
};

const distRectToSegment = (cx, cy, w, h, x1, y1, x2, y2) => {
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

// Edge 5 (BC): (20, 150) to (180, 150).
// Center is (100, 150).
// Normal is (0, 1) or (0, -1). Outward is (0, 1) if CM is above.
// Label pos is (100, 156).
// Label box is 20x16.
let minDist = Infinity;

// Test against edge 3 (BD): (20, 150) to (100, 100) -> Wait, B is 20, 150. D is 100, 100.
console.log("Dist to BD:", distRectToSegment(100, 156, 20, 16, 20, 150, 100, 100));

// Test against edge 6 (AC): (100, 20) to (180, 150).
console.log("Dist to AC:", distRectToSegment(100, 156, 20, 16, 100, 20, 180, 150));

