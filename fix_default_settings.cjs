const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

// 1. Update applyVertexStyle to take an optional override radius
code = code.replace(
    /const applyVertexStyle = \(style: VertexDisplayStyle, targetNodeIds\?: string\[\]\) => \{/,
    'const applyVertexStyle = (style: VertexDisplayStyle, targetNodeIds?: string[], overrideBaseRadius?: number) => {\n        const baseRadius = overrideBaseRadius || globalNodeRadius;'
);

code = code.replace(
    /labelStyle: 'none',\s*radius: 6/g,
    "labelStyle: 'none',\n                    radius: baseRadius"
);

code = code.replace(
    /labelStyle: 'outside',\s*radius: 6/g,
    "labelStyle: 'outside',\n                    radius: baseRadius"
);

code = code.replace(
    /labelStyle: 'inside',\s*radius: 15/g,
    "labelStyle: 'inside',\n                    radius: baseRadius * 2.5"
);

// 2. Update handleDefaultSettings to use applyVertexStyle and set defaults
const oldHandleDefaultSettings = /const handleDefaultSettings = \(\) => \{\s*forceSnapshot\(\);\s*setCanvasWidth\(378\);\s*setCanvasHeight\(302\);\s*setGlobalEdgeThickness\(1\.5\);\s*setGlobalFontSize\(11\);\s*setGlobalNodeRadius\(5\);\s*setGlobalEdgeLabelProximity\(8\);\s*setGlobalVertexLabelProximity\(15\);\s*setEdgeLabelClearanceRatio\(1\.5\);\s*setGlobalVertexStyle\('inside'\);\s*\};/;

const newHandleDefaultSettings = `const handleDefaultSettings = () => {
        forceSnapshot();
        setCanvasWidth(378);
        setCanvasHeight(302);
        setGlobalEdgeThickness(1.5);
        setGlobalFontSize(11);
        setGlobalNodeRadius(6); 
        setGlobalEdgeLabelProximity(8);
        setGlobalVertexLabelProximity(15);
        setEdgeLabelClearanceRatio(1.5);
        applyVertexStyle('inside', undefined, 6);
    };`;

code = code.replace(oldHandleDefaultSettings, newHandleDefaultSettings);

// 3. Update the Global Node Radius slider to trigger a snapshot and update all nodes
const oldRadiusSlider = /onChange=\{\(val\) => setGlobalNodeRadius\(Math\.max\(2, Math\.min\(30, val\)\)\)\}/;
const newRadiusSlider = `onChange={(val) => {
                                            forceSnapshot();
                                            const newRadius = Math.max(2, Math.min(30, val));
                                            setGlobalNodeRadius(newRadius);
                                            applyVertexStyle(globalVertexStyle, undefined, newRadius);
                                        }}`;
code = code.replace(oldRadiusSlider, newRadiusSlider);

// 4. Update the Global Vertex Style select to trigger a snapshot and update all nodes
const oldStyleSelect = /onChange=\{\(e\) => setGlobalVertexStyle\(e\.target\.value as 'inside' \| 'outside' \| 'none'\)\}/;
const newStyleSelect = `onChange={(e) => {
                                            forceSnapshot();
                                            applyVertexStyle(e.target.value as 'inside' | 'outside' | 'none');
                                        }}`;
code = code.replace(oldStyleSelect, newStyleSelect);

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
console.log('Fixed default settings and radius updates.');
