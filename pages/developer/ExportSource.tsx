
import React, { useState } from 'react';
import { Copy, Terminal, CheckCircle2, AlertCircle, FileCode } from 'lucide-react';

const BUNDLE_SCRIPT = `
const fs = require('fs');
const path = require('path');

// Configuration
const OUTPUT_FILE = 'project_bundle.txt';
const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', '.next', '.vscode'];
const IGNORE_FILES = ['.DS_Store', 'package-lock.json', 'yarn.lock', OUTPUT_FILE];
const ALLOWED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.html', '.css', '.scss', '.md', '.yml', '.yaml'];

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      if (!IGNORE_DIRS.includes(file)) {
        arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
      }
    } else {
      if (!IGNORE_FILES.includes(file) && ALLOWED_EXTENSIONS.includes(path.extname(file))) {
        arrayOfFiles.push(path.join(dirPath, "/", file));
      }
    }
  });

  return arrayOfFiles;
}

function bundleProject() {
  try {
    const allFiles = getAllFiles(process.cwd());
    let output = '';

    console.log(\`Found \${allFiles.length} files to bundle...\`);

    allFiles.forEach(filePath => {
      const relativePath = path.relative(process.cwd(), filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      
      output += \`--- START OF FILE \${relativePath} ---\\n\\n\`;
      output += content;
      output += \`\\n\\n\`;
    });

    fs.writeFileSync(OUTPUT_FILE, output);
    console.log(\`✅ Successfully created \${OUTPUT_FILE} with all source code.\`);
  } catch (err) {
    console.error("Error bundling project:", err);
  }
}

bundleProject();
`;

const ExportSource: React.FC = () => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(BUNDLE_SCRIPT);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex h-full flex-col bg-gray-50">
            <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                        <FileCode className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Export Source Code</h1>
                        <p className="text-sm text-gray-500">Bundle your entire project into a single text file.</p>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-auto p-8">
                <div className="max-w-4xl mx-auto space-y-6">
                    
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                        <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-800">
                            <p className="font-semibold mb-1">Browser Security Restriction</p>
                            <p>
                                Because this application runs in the browser, it cannot directly access or zip your local file system. 
                                However, you can use the Node.js script below to bundle your project files automatically.
                            </p>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                            <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                                <Terminal className="w-4 h-4" /> bundle_project.js
                            </h2>
                            <button 
                                onClick={handleCopy}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                    copied 
                                    ? 'bg-green-600 text-white shadow-sm' 
                                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                                {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                {copied ? 'Copied!' : 'Copy Script'}
                            </button>
                        </div>
                        <div className="p-0">
                            <pre className="text-sm bg-gray-900 text-gray-100 p-6 overflow-x-auto font-mono leading-relaxed custom-scrollbar">
                                {BUNDLE_SCRIPT}
                            </pre>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-gray-800">Instructions</h3>
                        <ol className="list-decimal list-inside space-y-3 text-sm text-gray-600 ml-2">
                            <li className="pl-2">
                                <span className="font-medium text-gray-900">Copy the script</span> above to your clipboard.
                            </li>
                            <li className="pl-2">
                                Create a new file named <code className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 text-red-600">bundle.js</code> in the root folder of your project.
                            </li>
                            <li className="pl-2">
                                Paste the script into that file and save it.
                            </li>
                            <li className="pl-2">
                                Open your terminal in the project root and run:
                                <div className="mt-2 p-3 bg-gray-900 text-gray-100 rounded-md font-mono inline-block">
                                    node bundle.js
                                </div>
                            </li>
                            <li className="pl-2">
                                A file named <code className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 text-blue-600">project_bundle.txt</code> will be created containing all your source code.
                            </li>
                        </ol>
                    </div>

                </div>
            </main>
        </div>
    );
};

export default ExportSource;
