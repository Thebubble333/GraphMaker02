const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

// Replace the opening tag
code = code.replace(
    /\{\s*inputType === 'manual' && \(\s*(<div className="p-3 flex flex-wrap gap-2 items-center">)/,
    '$1'
);

// We need to replace the closing tag. It looks like:
//                 )}
//                 {/* Easy Vertex Style Selector in Top Bar */}

code = code.replace(
    /\s*\)\}\s*(\{\/\* Easy Vertex Style Selector in Top Bar \*\/})/,
    '\n                $1'
);

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
console.log('Fixed toolbar visibility.');
