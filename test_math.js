const math = require('mathjs');

let val = math.evaluate('sqrt(x-2)', {x: 0});
console.log('val:', val);
console.log('typeof:', typeof val);
console.log('isFinite:', Number.isFinite(val));
