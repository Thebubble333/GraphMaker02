import React, { useState, useRef } from 'react';
import { Settings, Download, Copy, Plus, Trash2, FileText, Table as TableIcon } from 'lucide-react';
import { GraphToolbar } from '../components/GraphToolbar';
import { generateGraphImage, downloadSVG, copyImageToClipboard, ptToSvgUnits } from '../utils/imageExport';

interface DataRow {
  id: string;
  category: string;
  frequency: number;
}

export default function FrequencyTables() {
  const [data, setData] = useState<DataRow[]>([
    { id: '1', category: 'Black', frequency: 1 },
    { id: '2', category: 'Blue', frequency: 5 },
    { id: '3', category: 'Pink', frequency: 2 },
    { id: '4', category: 'White', frequency: 4 },
  ]);
  const [categoryLabel, setCategoryLabel] = useState('Colour');
  const [showTally, setShowTally] = useState(true);
  const [showTotal, setShowTotal] = useState(true);
  const [studentMode, setStudentMode] = useState(false);
  const [fontSize, setFontSize] = useState(11);
  const [activeTab, setActiveTab] = useState<'data' | 'raw' | 'settings'>('data');
  const [rawDataInput, setRawDataInput] = useState('');
  const [rawInputMode, setRawInputMode] = useState<'values' | 'pairs'>('values');
  
  const [dataType, setDataType] = useState<'categorical' | 'numerical-ungrouped' | 'numerical-grouped'>('categorical');
  const [classStart, setClassStart] = useState<number>(0);
  const [classWidth, setClassWidth] = useState<number>(10);
  const [numClasses, setNumClasses] = useState<number>(5);
  const [classFormat, setClassFormat] = useState<'hyphen' | 'inequality'>('hyphen');
  const [exportDpi, setExportDpi] = useState<number>(300);
  const [isCopied, setIsCopied] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);

  const handleAddRow = () => {
    setData([...data, { id: Date.now().toString(), category: `Item ${data.length + 1}`, frequency: 0 }]);
  };

  const handleUpdateRow = (id: string, updates: Partial<DataRow>) => {
    setData(data.map(row => row.id === id ? { ...row, ...updates } : row));
  };

  const handleRemoveRow = (id: string) => {
    setData(data.filter(row => row.id !== id));
  };

  const handleGenerateFromRaw = () => {
    if (!rawDataInput.trim()) return;
    
    if (rawInputMode === 'values') {
      // Split by tabs, commas, or newlines, then filter out empty strings
      const items = rawDataInput.split(/[\t,\n]+/).map(s => s.trim()).filter(Boolean);
      
      // If no items found after splitting by those, try spaces
      const finalItems = items.length > 1 ? items : rawDataInput.split(/[\s,\t,\n]+/).map(s => s.trim()).filter(Boolean);

      if (dataType === 'numerical-grouped') {
        const numbers = finalItems.map(Number).filter(n => !isNaN(n));
        if (numbers.length === 0) {
          alert("No valid numbers found in raw data.");
          return;
        }
        
        const min = Math.min(...numbers);
        const max = Math.max(...numbers);
        
        let currentStart = classStart;
        if (min < classStart) {
           currentStart = Math.floor(min / classWidth) * classWidth;
           setClassStart(currentStart);
        }
        
        const classCounts: Record<string, number> = {};
        const classes: string[] = [];
        
        let c = currentStart;
        while (c <= max) {
          const lower = c;
          const upper = c + classWidth;
          let category = '';
          if (classFormat === 'hyphen') {
            category = `${lower} - ${upper - 1}`;
          } else {
            category = `${lower} ≤ x < ${upper}`;
          }
          classes.push(category);
          classCounts[category] = 0;
          c += classWidth;
        }
        
        numbers.forEach(num => {
          const binIndex = Math.floor((num - currentStart) / classWidth);
          if (binIndex >= 0 && binIndex < classes.length) {
            classCounts[classes[binIndex]]++;
          } else if (binIndex >= classes.length) {
            classCounts[classes[classes.length - 1]]++;
          }
        });
        
        const newData: DataRow[] = classes.map((category, index) => ({
          id: Date.now().toString() + index,
          category,
          frequency: classCounts[category]
        }));
        
        setData(newData);
        setNumClasses(classes.length);
        
      } else if (dataType === 'numerical-ungrouped') {
        const numbers = finalItems.map(Number).filter(n => !isNaN(n));
        const counts: Record<number, number> = {};
        numbers.forEach(num => {
          counts[num] = (counts[num] || 0) + 1;
        });
        
        const sortedUnique = Array.from(new Set(numbers)).sort((a, b) => a - b);
        const newData: DataRow[] = sortedUnique.map((num, index) => ({
          id: Date.now().toString() + index,
          category: String(num),
          frequency: counts[num]
        }));
        
        setData(newData);
      } else {
        const counts: Record<string, number> = {};
        finalItems.forEach(item => {
          counts[item] = (counts[item] || 0) + 1;
        });

        const newData: DataRow[] = Object.entries(counts).map(([category, frequency], index) => ({
          id: Date.now().toString() + index,
          category,
          frequency
        }));

        setData(newData);
      }
    } else {
      // Pairs mode: e.g., "Black, 5, Red, 4" or "Black 5 Red 4"
      // Split by commas or newlines first to see if it's CSV-like
      let tokens = rawDataInput.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
      
      // If there are no commas or newlines, try splitting by spaces
      if (tokens.length <= 1) {
        tokens = rawDataInput.split(/\s+/).map(s => s.trim()).filter(Boolean);
      }

      const newData: DataRow[] = [];
      for (let i = 0; i < tokens.length; i += 2) {
        const category = tokens[i];
        const frequencyStr = tokens[i + 1];
        if (category && frequencyStr !== undefined) {
          const frequency = parseInt(frequencyStr, 10);
          if (!isNaN(frequency)) {
            newData.push({
              id: Date.now().toString() + i,
              category,
              frequency
            });
          }
        }
      }
      
      if (newData.length > 0) {
        setData(newData);
      } else {
        alert("Could not parse pairs. Ensure format is 'Category, Frequency, Category, Frequency...'");
        return;
      }
    }
    
    setActiveTab('data');
  };

  const handleGenerateClasses = () => {
    const newData: DataRow[] = [];
    for (let i = 0; i < numClasses; i++) {
      const lower = classStart + i * classWidth;
      const upper = classStart + (i + 1) * classWidth;
      let category = '';
      if (classFormat === 'hyphen') {
        category = `${lower} - ${upper - 1}`;
      } else {
        category = `${lower} ≤ x < ${upper}`;
      }
      newData.push({
        id: Date.now().toString() + i,
        category,
        frequency: 0
      });
    }
    setData(newData);
  };

  const handleExportCSV = () => {
    const csvContent = [
      `${categoryLabel},Frequency`,
      ...data.map(row => `${row.category},${row.frequency}`)
    ].join('\n');
    
    navigator.clipboard.writeText(csvContent);
    alert('Data copied to clipboard as CSV!');
  };

  const handleCopyText = () => {
    const text = data.map(row => `${row.category}, ${row.frequency}`).join(', ');
    navigator.clipboard.writeText(text);
    alert('Data copied to clipboard as text!');
  };

  const totalFrequency = data.reduce((sum, row) => sum + row.frequency, 0);
  const maxFrequency = Math.max(...data.map(d => d.frequency), 0);
  const maxTallyWidth = Math.floor(maxFrequency / 5) * (3 * 6 + 16) + (maxFrequency % 5) * 6;

  const approxTextWidth = (text: string) => text.length * 10 + 40;
  const col1Width = Math.max(150, approxTextWidth(categoryLabel), ...data.map(r => approxTextWidth(r.category)), showTotal ? approxTextWidth("Total") : 0);
  const col2Width = showTally ? Math.max(150, maxTallyWidth + 40, approxTextWidth("Tally marks")) : 0;
  const col3Width = Math.max(150, approxTextWidth("Frequency"), ...data.map(r => approxTextWidth(String(r.frequency))), showTotal ? approxTextWidth(String(totalFrequency)) : 0);
  
  const tableWidth = col1Width + col2Width + col3Width;
  const rowHeight = 40;
  const headerHeight = 40;
  const tableHeight = headerHeight + data.length * rowHeight + (showTotal ? rowHeight : 0);

  const handleExportSVG = () => {
    downloadSVG('frequency-table-svg', 'frequency-table.svg');
  };

  const handleExportPNG = async () => {
    const result = await generateGraphImage('frequency-table-svg', tableWidth + 4, tableHeight + 4, (tableWidth + 4) / 37.8, true, 0, exportDpi);
    if (result && result.blob) {
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'frequency-table.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleCopy = async () => {
    const result = await generateGraphImage('frequency-table-svg', tableWidth + 4, tableHeight + 4, (tableWidth + 4) / 37.8, true, 0, exportDpi);
    if (result && result.blob) {
      try {
        await copyImageToClipboard(result.blob, result.widthCm, result.heightCm);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy", err);
      }
    }
  };

  const renderTally = (count: number) => {
    const groupsOfFive = Math.floor(count / 5);
    const remainder = count % 5;
    const elements = [];
    
    let currentX = 0;
    const tallyHeight = 20;
    const tallySpacing = 6;
    const groupSpacing = 16;

    for (let i = 0; i < groupsOfFive; i++) {
      for (let j = 0; j < 4; j++) {
        elements.push(<line key={`tally-${i}-${j}`} x1={currentX + j * tallySpacing} y1={0} x2={currentX + j * tallySpacing} y2={tallyHeight} stroke="black" strokeWidth="2" />);
      }
      elements.push(<line key={`tally-diag-${i}`} x1={currentX - 2} y1={tallyHeight + 2} x2={currentX + 3 * tallySpacing + 2} y2={-2} stroke="black" strokeWidth="2" />);
      currentX += 3 * tallySpacing + groupSpacing;
    }

    for (let i = 0; i < remainder; i++) {
      elements.push(<line key={`tally-rem-${i}`} x1={currentX + i * tallySpacing} y1={0} x2={currentX + i * tallySpacing} y2={tallyHeight} stroke="black" strokeWidth="2" />);
    }

    return elements;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center shrink-0">
        <h1 className="text-xl font-bold text-gray-800">Frequency Tables</h1>
        <div className="flex gap-2">
          <button onClick={handleCopyText} className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm font-medium transition-colors">
            <FileText size={16} /> Copy Text
          </button>
          <button onClick={handleExportCSV} className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition-colors">
            <TableIcon size={16} /> Copy CSV
          </button>
          <GraphToolbar 
            onExportPNG={handleExportPNG} 
            onCopy={handleCopy} 
            isCopied={isCopied} 
            onExportSVG={handleExportSVG}
            exportDpi={exportDpi}
            onDpiChange={setExportDpi}
          />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <div className="flex border-b border-gray-200">
            <button
              className={`flex-1 py-3 text-sm font-medium border-b-2 ${activeTab === 'data' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('data')}
            >
              Data
            </button>
            <button
              className={`flex-1 py-3 text-sm font-medium border-b-2 ${activeTab === 'raw' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('raw')}
            >
              Raw
            </button>
            <button
              className={`flex-1 py-3 text-sm font-medium border-b-2 ${activeTab === 'settings' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('settings')}
            >
              <Settings size={16} className="inline mr-2 mb-0.5" />
              Settings
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'data' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Data Type</label>
                  <select 
                    value={dataType} 
                    onChange={(e) => setDataType(e.target.value as any)}
                    className="w-full border border-gray-300 rounded-md p-2 text-sm bg-white"
                  >
                    <option value="categorical">Categorical</option>
                    <option value="numerical-ungrouped">Numerical (Ungrouped)</option>
                    <option value="numerical-grouped">Numerical (Grouped)</option>
                  </select>
                </div>

                {dataType === 'numerical-grouped' && (
                  <div className="bg-gray-50 p-3 rounded border border-gray-200 space-y-3">
                    <h3 className="text-sm font-medium text-gray-700">Auto-Generate Classes</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500">Start Value</label>
                        <input type="number" value={classStart} onChange={e => setClassStart(Number(e.target.value))} className="w-full border rounded p-1 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500">Class Width</label>
                        <input type="number" value={classWidth} onChange={e => setClassWidth(Number(e.target.value))} className="w-full border rounded p-1 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500">Num Classes</label>
                        <input type="number" value={numClasses} onChange={e => setNumClasses(Number(e.target.value))} className="w-full border rounded p-1 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500">Format</label>
                        <select value={classFormat} onChange={e => setClassFormat(e.target.value as any)} className="w-full border rounded p-1 text-sm bg-white">
                          <option value="hyphen">10 - 19</option>
                          <option value="inequality">10 ≤ x &lt; 20</option>
                        </select>
                      </div>
                    </div>
                    <button onClick={handleGenerateClasses} className="w-full py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded text-xs font-medium">
                      Generate Empty Classes
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Category Label</label>
                  <input 
                    type="text" 
                    value={categoryLabel} 
                    onChange={(e) => setCategoryLabel(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-sm font-medium text-gray-700">Data Rows</label>
                    <button onClick={handleAddRow} className="text-indigo-600 hover:text-indigo-800 p-1"><Plus size={16} /></button>
                  </div>
                  {data.map((row) => (
                    <div key={row.id} className="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-200">
                      <input 
                        type="text" value={row.category} 
                        onChange={e => handleUpdateRow(row.id, { category: e.target.value })}
                        className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm" placeholder="Category"
                      />
                      <input 
                        type="number" value={row.frequency} min="0"
                        onChange={e => handleUpdateRow(row.id, { frequency: parseInt(e.target.value) || 0 })}
                        className="w-20 border border-gray-300 rounded px-2 py-1 text-sm" placeholder="Freq"
                      />
                      <button onClick={() => handleRemoveRow(row.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'raw' && (
              <div className="space-y-4 h-full flex flex-col">
                <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                  <button
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${rawInputMode === 'values' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setRawInputMode('values')}
                  >
                    Raw Values
                  </button>
                  <button
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${rawInputMode === 'pairs' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setRawInputMode('pairs')}
                  >
                    Category & Freq
                  </button>
                </div>

                <div className="space-y-2 flex-1 flex flex-col">
                  {rawInputMode === 'values' && (
                    <div className="space-y-2 mb-2">
                      <label className="block text-sm font-medium text-gray-700">Data Type</label>
                      <select 
                        value={dataType} 
                        onChange={(e) => setDataType(e.target.value as any)}
                        className="w-full border border-gray-300 rounded-md p-2 text-sm bg-white"
                      >
                        <option value="categorical">Categorical</option>
                        <option value="numerical-ungrouped">Numerical (Ungrouped)</option>
                        <option value="numerical-grouped">Numerical (Grouped)</option>
                      </select>
                      
                      {dataType === 'numerical-grouped' && (
                        <div className="bg-gray-50 p-3 rounded border border-gray-200 space-y-3">
                          <h3 className="text-sm font-medium text-gray-700">Group Settings</h3>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-gray-500">Start Value</label>
                              <input type="number" value={classStart} onChange={e => setClassStart(Number(e.target.value))} className="w-full border rounded p-1 text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500">Class Width</label>
                              <input type="number" value={classWidth} onChange={e => setClassWidth(Number(e.target.value))} className="w-full border rounded p-1 text-sm" />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs text-gray-500">Format</label>
                              <select value={classFormat} onChange={e => setClassFormat(e.target.value as any)} className="w-full border rounded p-1 text-sm bg-white">
                                <option value="hyphen">10 - 19</option>
                                <option value="inequality">10 ≤ x &lt; 20</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <label className="block text-sm font-medium text-gray-700">Paste Data</label>
                  <p className="text-xs text-gray-500">
                    {rawInputMode === 'values' 
                      ? "Paste individual values (e.g., Bus Car Walk Car Bus)" 
                      : "Paste pairs (e.g., Black, 5, Red, 4 or Black 5 Red 4)"}
                  </p>
                  <textarea 
                    value={rawDataInput} 
                    onChange={(e) => setRawDataInput(e.target.value)}
                    className="flex-1 w-full border border-gray-300 rounded-md p-2 text-sm font-mono resize-none"
                    placeholder={rawInputMode === 'values' ? "Bus Car Walk Car Bus\nTrain Walk Car Car Train" : "Black, 5\nRed, 4\nBlue, 10"}
                  />
                </div>
                <button 
                  onClick={handleGenerateFromRaw}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors"
                >
                  Generate Frequency Table
                </button>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-4">
                <label className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${studentMode ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-gray-200'}`}>
                  <div className={`w-5 h-5 rounded border flex items-center justify-center ${studentMode ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-300'}`}>
                    {studentMode && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                  </div>
                  <input 
                    type="checkbox" 
                    checked={studentMode} 
                    onChange={(e) => setStudentMode(e.target.checked)} 
                    className="hidden"
                  />
                  <div className="flex-1">
                    <span className="block text-xs font-bold text-gray-700 uppercase">Student Mode</span>
                    <span className="block text-xs text-gray-500 mt-0.5">Hide tallies and frequencies</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={showTally}
                    onChange={(e) => setShowTally(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Show Tally Marks Column
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={showTotal}
                    onChange={(e) => setShowTotal(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Show Total Row
                </label>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Font Size (pt)</label>
                  <input
                    type="number"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseFloat(e.target.value) || 11)}
                    className="w-full border border-gray-300 rounded-md p-2 text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1 bg-gray-100 overflow-auto flex items-center justify-center p-8">
          <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-gray-200 p-8">
            <svg 
              id="frequency-table-svg"
              ref={svgRef}
              width={tableWidth + 4} 
              height={tableHeight + 4} 
              viewBox={`-2 -2 ${tableWidth + 4} ${tableHeight + 4}`} 
              xmlns="http://www.w3.org/2000/svg"
              style={{ background: '#ffffff', fontFamily: 'sans-serif' }}
            >
              {/* Outer border */}
              <rect x={0} y={0} width={tableWidth} height={tableHeight} fill="none" stroke="black" strokeWidth="2" />
              
              {/* Header bottom border */}
              <line x1={0} y1={headerHeight} x2={tableWidth} y2={headerHeight} stroke="black" strokeWidth="2" />
              
              {/* Row borders */}
              {data.map((_, i) => (
                <line key={`row-${i}`} x1={0} y1={headerHeight + (i + 1) * rowHeight} x2={tableWidth} y2={headerHeight + (i + 1) * rowHeight} stroke="black" strokeWidth="1" />
              ))}

              {/* Column borders */}
              <line x1={col1Width} y1={0} x2={col1Width} y2={tableHeight} stroke="black" strokeWidth="2" />
              {showTally && (
                <line x1={col1Width + col2Width} y1={0} x2={col1Width + col2Width} y2={tableHeight} stroke="black" strokeWidth="2" />
              )}

              {/* Header Text */}
              <text x={col1Width / 2} y={headerHeight / 2 + 6} textAnchor="middle" fontWeight="bold" fill="black" fontSize={ptToSvgUnits(fontSize)}>{categoryLabel}</text>
              {showTally && (
                <text x={col1Width + col2Width / 2} y={headerHeight / 2 + 6} textAnchor="middle" fontWeight="bold" fill="black" fontSize={ptToSvgUnits(fontSize)}>Tally marks</text>
              )}
              <text x={col1Width + col2Width + col3Width / 2} y={headerHeight / 2 + 6} textAnchor="middle" fontWeight="bold" fill="black" fontSize={ptToSvgUnits(fontSize)}>Frequency</text>

              {/* Data Rows */}
              {data.map((row, i) => {
                const yCenter = headerHeight + i * rowHeight + rowHeight / 2;
                return (
                  <g key={`data-${i}`}>
                    <text x={col1Width / 2} y={yCenter + 6} textAnchor="middle" fill="black" fontSize={ptToSvgUnits(fontSize)}>{row.category}</text>
                    {showTally && !studentMode && (
                      <g transform={`translate(${col1Width + 20}, ${yCenter - 10})`}>
                        {renderTally(row.frequency)}
                      </g>
                    )}
                    {!studentMode && <text x={col1Width + col2Width + col3Width / 2} y={yCenter + 6} textAnchor="middle" fill="black" fontSize={ptToSvgUnits(fontSize)}>{row.frequency}</text>}
                  </g>
                );
              })}

              {/* Total Row */}
              {showTotal && (
                <g>
                  <text x={col1Width / 2} y={tableHeight - rowHeight / 2 + 6} textAnchor="middle" fontWeight="bold" fill="black" fontSize={ptToSvgUnits(fontSize)}>Total</text>
                  {!studentMode && <text x={col1Width + col2Width + col3Width / 2} y={tableHeight - rowHeight / 2 + 6} textAnchor="middle" fontWeight="bold" fill="black" fontSize={ptToSvgUnits(fontSize)}>{totalFrequency}</text>}
                </g>
              )}
            </svg>
          </div>
        </main>
      </div>
    </div>
  );
}
