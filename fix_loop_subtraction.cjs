const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

const regex = /x: Math\.round\(best_t \* tx \+ best_n \* best_dir \* nx - pref_N_dir \* nx \* dist\),\n\s*y: Math\.round\(best_t \* ty \+ best_n \* best_dir \* ny - pref_N_dir \* ny \* dist\)/;

const replacement = `x: Math.round(best_t * tx + best_n * best_dir * nx - (e.isLoop ? nx * dist : pref_N_dir * nx * dist)),
                y: Math.round(best_t * ty + best_n * best_dir * ny - (e.isLoop ? ny * dist : pref_N_dir * ny * dist))`;

code = code.replace(regex, replacement);

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
