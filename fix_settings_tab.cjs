const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

// The block to extract
const blockRegex = /<div className="mt-8 border-t pt-4 space-y-4">\n\s*<h3 className="font-medium text-indigo-900">Global Styles<\/h3>[\s\S]*?<\/select>\n\s*<\/div>\n\s*<\/div>\n\s*<\/div>\n\s*<\/div>\n\s*<div className="mt-8 border-t pt-4 space-y-2">/;

const match = code.match(/<div className="mt-8 border-t pt-4 space-y-4">([\s\S]*?)<div className="mt-8 border-t pt-4 space-y-2">/);
if (match) {
    const extractedStyles = match[1];
    
    // Replace the old block to just leave the bottom buttons
    code = code.replace(match[0], '<div className="mt-8 border-t pt-4 space-y-2">');
    
    // Insert extracted block into settings tab
    const precedenceEnd = /\{inputType === 'precedence' && \([\s\S]*?<\/div>\n\s*\)\}/;
    const settingsTab = `\n                        {inputType === 'settings' && (
                            <div className="space-y-4">
                                ${extractedStyles}
                            </div>
                        )}`;
    code = code.replace(precedenceEnd, (m) => m + settingsTab);
    
    fs.writeFileSync('pages/NetworkGrapher.tsx', code);
    console.log("Extraction successful.");
} else {
    console.log("Could not find the global styles block exactly as specified.");
    
    // Let's try finding the h3
    const h3Match = code.match(/<h3 className="font-medium text-indigo-900">Global Styles<\/h3>[\s\S]*?<\/select>\n\s*<\/div>\n\s*<\/div>\n\s*<\/div>/);
    if (h3Match) {
       console.log("Found h3");
    }
}
