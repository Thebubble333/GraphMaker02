const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

const regex = /currentNodes\.forEach\(on => \{\n\s*if \(on\.id === e\.from \|\| on\.id === e\.to\) return;\n\s*let d = distPointToRect\(on\.x, on\.y, px, py, lw, lh\);\n\s*\/\/ Node radius approx 15\n\s*if \(d - 15 < minOtherDist\) \{ minOtherDist = Math\.max\(0, d - 15\); closestObj = 'node ' \+ on\.label; \}\n\s*\}\);/g;

const replacement = `currentNodes.forEach(on => {
                if (on.id === e.from || on.id === e.to) return;
                let d = distPointToRect(on.x, on.y, px, py, lw, lh);
                let actualRadius = globalNodeRadius || 15;
                if (d - actualRadius < minOtherDist) { minOtherDist = Math.max(0, d - actualRadius); closestObj = 'node ' + on.label; }
            });`;

code = code.replace(regex, replacement);

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
