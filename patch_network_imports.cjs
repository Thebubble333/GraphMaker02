const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

if (!code.includes('useGraphInteraction')) {
    code = code.replace(
        "import { useHistory } from '../hooks/useHistory';",
        "import { useHistory } from '../hooks/useHistory';\nimport { useGraphInteraction } from '../hooks/useGraphInteraction';"
    );
    fs.writeFileSync('pages/NetworkGrapher.tsx', code);
    console.log('Added useGraphInteraction import');
}
