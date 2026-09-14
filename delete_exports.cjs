const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

code = code.replace(/    const handleExportSVG = \(\) => \{[\s\S]*?\n    \};\n/, "");
code = code.replace(/    const handleExportPNG = async \(\) => \{[\s\S]*?\n    \};\n/, "");
code = code.replace(/    const handleCopy = async \(\) => \{[\s\S]*?\n    \};\n/, "");

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
