const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

const regex = /if \(e\.isLoop\) \{\n\s*midX = e\.cp1 \? e\.cp1\.x : fn\.x;\n\s*midY = e\.cp1 \? e\.cp1\.y : fn\.y - 60;\n\s*dx = 1; dy = 0;\n\s*\}/;

const replacement = `if (e.isLoop) {
            midX = e.cp1 ? e.cp1.x : fn.x;
            midY = e.cp1 ? e.cp1.y : fn.y - 60;
            dx = midX - fn.x; dy = midY - fn.y;
            // The renderer calculates default tangent for loops as perpendicular to (mid - fn)
            // Wait, the renderer uses dx = midX - fn.x, dy = midY - fn.y. 
            // It computes defOffX = (dx / ldist) * prox.
            // Which means the default outward direction is (dx, dy).
            // For the auto-placer, nx, ny are derived from dx, dy.
            // If outward is (dx, dy), then nx must be (dx, dy).
            // So ty = -dx, tx = dy. Thus dx = dy, dy = -dx.
            let temp = dx; dx = dy; dy = -temp;
            if (dx === 0 && dy === 0) { dx = 1; dy = 0; }
        }`;

code = code.replace(regex, replacement);

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
