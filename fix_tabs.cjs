const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

// 1. Add settings to inputType
code = code.replace(/useState<'manual' \| 'matrix' \| 'precedence' \| 'regular'>\('manual'\)/, "useState<'manual' | 'matrix' | 'precedence' | 'regular' | 'settings'>('manual')");

// 2. Add Settings tab button
const precedenceBtn = /<button onClick=\{\(\) => setInputType\('precedence'\)\} className=\{`px-3 py-1\.5 rounded font-medium text-sm transition-colors \$\{inputType === 'precedence' \? 'bg-indigo-600 text-white shadow-xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'\}`\}>Precedence Table<\/button>/;
const settingsBtn = `<button onClick={() => setInputType('precedence')} className={\`px-3 py-1.5 rounded font-medium text-sm transition-colors \${inputType === 'precedence' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}\`}>Precedence Table</button>
                    <button onClick={() => setInputType('settings')} className={\`px-3 py-1.5 rounded font-medium text-sm transition-colors \${inputType === 'settings' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}\`}>Global Settings</button>`;
code = code.replace(precedenceBtn, settingsBtn);

// 3. Fix Add Cut Curve button wrap issue
const flexWrapDiv = /<div className="flex bg-gray-100 rounded-md p-1">/;
code = code.replace(flexWrapDiv, '<div className="flex flex-wrap items-center bg-gray-100 rounded-md p-1">');

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
