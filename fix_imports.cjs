const fs = require('fs');
let code = fs.readFileSync('components/GraphToolbar.tsx', 'utf8');

code = code.replace(/\} from 'lucide-react';/, ', Trash2, RotateCcw } from "lucide-react";');

fs.writeFileSync('components/GraphToolbar.tsx', code);
console.log('Fixed imports');
