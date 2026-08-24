const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

const regex = /let best_t = 0;\s*let best_n = 0;\s*let best_dir = pref_N_dir;\s*let best_score = -Infinity;\s*const checkClearance = \(candT: number, candN: number, dir: number\) => {/;

const replacement = `let best_t = 0;
        let best_n = 0;
        let best_dir = pref_N_dir;
        let best_score = -Infinity;
        
        const checkClearance = (candT: number, candN: number, dir: number, debug = false) => {`;

code = code.replace(regex, replacement);

const regex2 = /let minOtherDist = Infinity;\s*currentEdges\.forEach\(oe => {/;
const replacement2 = `let minOtherDist = Infinity;
            let closestObj = '';
            currentEdges.forEach(oe => {`;

code = code.replace(regex2, replacement2);

const regex3 = /if \(d < minOtherDist\) minOtherDist = d;/g;
const replacement3 = `if (d < minOtherDist) { minOtherDist = d; closestObj = 'edge ' + oe.label; }`;

code = code.replace(regex3, replacement3);

const regex4 = /if \(d - 15 < minOtherDist\) minOtherDist = Math\.max\(0, d - 15\);/g;
const replacement4 = `if (d - 15 < minOtherDist) { minOtherDist = Math.max(0, d - 15); closestObj = 'node ' + on.label; }`;

code = code.replace(regex4, replacement4);

const regex5 = /return minOtherDist >= edgeLabelClearanceRatio \* candN;\s*};/g;
const replacement5 = `if (debug) console.log('Edge ' + e.label + ' at T=' + candT + ' N=' + candN + ' minDist=' + minOtherDist + ' closest=' + closestObj + ' required=' + (edgeLabelClearanceRatio * candN));
            return minOtherDist >= edgeLabelClearanceRatio * candN;
        };`;

code = code.replace(regex5, replacement5);

const regex6 = /if \(checkClearance\(candT, dist, cur_dir\)\) {/g;
const replacement6 = `if (checkClearance(candT, dist, cur_dir, candT === 0 && dir_idx === 0)) {`;

code = code.replace(regex6, replacement6);

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
