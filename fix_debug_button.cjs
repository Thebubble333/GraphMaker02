const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

const targetStr = `Auto-Place Labels (Physics)\n                            </button>`;
const replacement = `Auto-Place Labels (Physics)\n                            </button>\n                            <button className="w-full bg-white border border-gray-300 text-gray-700 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium hover:bg-gray-50 transition-colors" onClick={() => setDebugEdgeLabels(!debugEdgeLabels)}>\n                                {debugEdgeLabels ? 'Hide Physics Debug' : 'Show Physics Debug'}\n                            </button>`;

code = code.replace(targetStr, replacement);
fs.writeFileSync('pages/NetworkGrapher.tsx', code);
