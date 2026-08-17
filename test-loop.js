const peakX = 0; const peakY = -60;
const fromX = 0; const fromY = 0;
const dx = peakX - fromX; const dy = peakY - fromY;
const hypot = Math.hypot(dx, dy);
const A = Math.atan2(dy, dx) * 180 / Math.PI;
console.log({ hypot, A });
