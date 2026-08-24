const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

if (!code.includes("import { SmartNumberInput }")) {
    code = code.replace(
        "import { GraphToolbar } from '../components/GraphToolbar';",
        "import { GraphToolbar } from '../components/GraphToolbar';\nimport { SmartNumberInput } from '../components/SmartNumberInput';"
    );
}

// Replace initialVerticesCount
code = code.replace(
    /<input[\s\S]*?value=\{initialVerticesCount\}[\s\S]*?onChange=\{e => setInitialVerticesCount\(Number\(e.target.value\)\)\}[\s\S]*?className="w-16 border rounded p-1.5 text-sm"[\s\S]*?min=\{1\} max=\{50\}\s*\/>/,
    `<SmartNumberInput 
        value={initialVerticesCount}
        onChange={setInitialVerticesCount}
        className="w-16 border rounded p-1.5 text-sm"
        min={1} max={50}
    />`
);

// Replace radius
code = code.replace(
    /<input[\s\S]*?type="number"[\s\S]*?className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"[\s\S]*?value=\{nodes.find\(n => n.id === singleSelectedNode\)\?.radius \|\| 6\}[\s\S]*?onChange=\{\(e\) => setNodes\(nodes.map\(n => n.id === singleSelectedNode \? \{ \.\.\.n, radius: Number\(e.target.value\) \} : n\)\)\}\s*\/>/,
    `<SmartNumberInput 
        className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
        value={nodes.find(n => n.id === singleSelectedNode)?.radius || 6}
        onChange={(val) => setNodes(nodes.map(n => n.id === singleSelectedNode ? { ...n, radius: val } : n))}
        min={1} max={100}
    />`
);

// Replace loopRadiusY
code = code.replace(
    /<input[\s\S]*?type="number"[\s\S]*?step="0.1"[\s\S]*?className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"[\s\S]*?value=\{edges.find\(e => e.id === singleSelectedEdge\)\?.loopRadiusY \?\? 1.0\}[\s\S]*?onChange=\{\(e\) => setEdges\(edges.map\(e2 => e2.id === singleSelectedEdge \? \{ \.\.\.e2, loopRadiusY: Number\(e.target.value\) \} : e2\)\)\}\s*\/>/,
    `<SmartNumberInput 
        step="0.1"
        className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
        value={edges.find(e => e.id === singleSelectedEdge)?.loopRadiusY ?? 1.0}
        onChange={(val) => setEdges(edges.map(e2 => e2.id === singleSelectedEdge ? { ...e2, loopRadiusY: val } : e2))}
        min={0.1} max={10}
    />`
);

// Replace canvasWidth
code = code.replace(
    /<input[\s\S]*?type="number"[\s\S]*?value=\{Math.round\(canvasWidth \/ 37.7952755906 \* 10\) \/ 10\}[\s\S]*?onChange=\{\(e\) => setCanvasWidth\(Math.max\(100, Math.min\(2000, Math.round\(Number\(e.target.value\) \* 37.7952755906\)\)\)\)\}[\s\S]*?className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"[\s\S]*?step="0.1"\s*\/>/,
    `<SmartNumberInput 
        value={Math.round(canvasWidth / 37.7952755906 * 10) / 10}
        onChange={(val) => setCanvasWidth(Math.max(100, Math.min(2000, Math.round(val * 37.7952755906))))}
        className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
        step="0.1" min={1} max={50}
    />`
);

// Replace canvasHeight
code = code.replace(
    /<input[\s\S]*?type="number"[\s\S]*?value=\{Math.round\(canvasHeight \/ 37.7952755906 \* 10\) \/ 10\}[\s\S]*?onChange=\{\(e\) => setCanvasHeight\(Math.max\(100, Math.min\(2000, Math.round\(Number\(e.target.value\) \* 37.7952755906\)\)\)\)\}[\s\S]*?className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"[\s\S]*?step="0.1"\s*\/>/,
    `<SmartNumberInput 
        value={Math.round(canvasHeight / 37.7952755906 * 10) / 10}
        onChange={(val) => setCanvasHeight(Math.max(100, Math.min(2000, Math.round(val * 37.7952755906))))}
        className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
        step="0.1" min={1} max={50}
    />`
);

// Replace globalFontSize
code = code.replace(
    /<input[\s\S]*?type="number"[\s\S]*?value=\{globalFontSize\}[\s\S]*?onChange=\{\(e\) => setGlobalFontSize\(Math.max\(8, Math.min\(48, Number\(e.target.value\)\)\)\)\}[\s\S]*?className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"\s*\/>/,
    `<SmartNumberInput 
        value={globalFontSize}
        onChange={(val) => setGlobalFontSize(Math.max(8, Math.min(48, val)))}
        className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
        min={8} max={48}
    />`
);

// Replace globalEdgeThickness
code = code.replace(
    /<input[\s\S]*?type="number"[\s\S]*?value=\{globalEdgeThickness\}[\s\S]*?onChange=\{\(e\) => setGlobalEdgeThickness\(Math.max\(1, Math.min\(10, Number\(e.target.value\)\)\)\)\}[\s\S]*?className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"\s*\/>/,
    `<SmartNumberInput 
        value={globalEdgeThickness}
        onChange={(val) => setGlobalEdgeThickness(Math.max(1, Math.min(10, val)))}
        className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
        min={0.1} max={10} step="0.1"
    />`
);

// Replace globalNodeRadius
code = code.replace(
    /<input[\s\S]*?type="number"[\s\S]*?value=\{globalNodeRadius\}[\s\S]*?onChange=\{\(e\) => setGlobalNodeRadius\(Math.max\(2, Math.min\(30, Number\(e.target.value\)\)\)\)\}[\s\S]*?className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"\s*\/>/,
    `<SmartNumberInput 
        value={globalNodeRadius}
        onChange={(val) => setGlobalNodeRadius(Math.max(2, Math.min(30, val)))}
        className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
        min={2} max={30}
    />`
);

// Replace globalEdgeLabelProximity
code = code.replace(
    /<input[\s\S]*?type="number"[\s\S]*?value=\{globalEdgeLabelProximity\}[\s\S]*?onChange=\{\(e\) => setGlobalEdgeLabelProximity\(Math.max\(-50, Math.min\(100, Number\(e.target.value\)\)\)\)\}[\s\S]*?className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"\s*\/>/,
    `<SmartNumberInput 
        value={globalEdgeLabelProximity}
        onChange={(val) => setGlobalEdgeLabelProximity(Math.max(-50, Math.min(100, val)))}
        className="w-full border rounded p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
        min={-50} max={100}
    />`
);

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
