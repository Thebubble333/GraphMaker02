let dx = 50, dy = -50;
let len = Math.hypot(dx, dy);
let tx = dx / len;
let ty = dy / len;
let nx = -ty;
let ny = tx;

let dist = 8;
let cmX = 0, cmY = 0;
let midX = 100, midY = 100;

let c1 = { x: nx * dist, y: ny * dist };
let c2 = { x: -nx * dist, y: -ny * dist };
let d1 = Math.hypot(midX + c1.x - cmX, midY + c1.y - cmY);
let d2 = Math.hypot(midX + c2.x - cmX, midY + c2.y - cmY);
let pref_N_dir = d1 > d2 ? 1 : -1;

console.log("Auto-placer outX, outY:", pref_N_dir * nx, pref_N_dir * ny);

// Renderer math
let edx = dx, edy = dy;
let eDist = len;
let ux = edx / eDist;
let uy = edy / eDist;
let normX = -uy;
let normY = ux;

let vcx = midX - cmX;
let vcy = midY - cmY;
let dot = normX * vcx + normY * vcy;
let outX = dot >= 0 ? normX : -normX;
let outY = dot >= 0 ? normY : -normY;

console.log("Renderer outX, outY:", outX, outY);
