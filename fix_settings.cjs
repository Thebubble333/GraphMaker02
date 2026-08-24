const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

const regex = /<div className="space-y-4 bg-white p-4 rounded-lg border shadow-sm">\n\s*<h3 className="font-medium text-indigo-900">Global Styles<\/h3>([\s\S]*?)<\/select>\n\s*<\/div>\n\s*<\/div>\n\s*<\/div>\n\s*<\/div>/;
const match = code.match(regex);

if (match) {
    const extracted = match[0];
    
    // Remove it from the current location
    code = code.replace(extracted, '');
    
    // Put it inside the settings tab
    const precedenceEnd = /\{inputType === 'precedence' && \([\s\S]*?<\/div>\n\s*\)\}/;
    const settingsTab = `\n                        {inputType === 'settings' && (
                            <div className="space-y-4">
                                \n${extracted}\n
                            </div>
                        )}`;
    code = code.replace(precedenceEnd, (m) => m + settingsTab);
    
    fs.writeFileSync('pages/NetworkGrapher.tsx', code);
    console.log("Success extracting");
} else {
    console.log("Failed to match block");
}
