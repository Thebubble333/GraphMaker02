import { useState, useEffect, useCallback, useMemo } from 'react';
import { GraphConfig, FunctionDef, PointDef, VerticalLineDef, FeaturePoint, IntegralDef, TangentDef } from '../types';
import { CARTESIAN_CONFIG } from '../config/graphDefaults';
import { analyzeFunction, analyzeGraphIntersection, calculateTangentEquation, findSnapPoint, preprocessMathExpression } from '../utils/mathAnalysis';
import { formatCoordinate } from '../utils/mathFormatting';
import { useHistory } from './useHistory';
import * as math from 'mathjs';
import { CM_TO_PX } from '../constants';

export interface BackgroundImage {
    url: string;
    opacity: number;
    x: number; // Math Coordinates (Left)
    y: number; // Math Coordinates (Top)
    width: number; // Math Width
    height: number; // Math Height
    rotation: number;
}

const INITIAL_FUNCS: FunctionDef[] = [
  { 
      id: '1', expression: 'sin(x)', color: '#000000', 
      strokeWidth: 2.0, visible: true, lineType: 'solid', 
      domain: ['', ''], domainInclusive: [true, true],
      isCollapsed: false, plotterType: 'experimental'
  }
];

export const useFunctionGrapherState = () => {
  // --- STATE ---
  const [config, setConfig] = useState<GraphConfig>({
      ...CARTESIAN_CONFIG,
      // Function Grapher Specific Overrides (if any)
      axisLabels: ["$x$", "$y$"],
      offsetXAxisNumY: 3
  });
  
  const [functions, setFunctions] = useState<FunctionDef[]>(INITIAL_FUNCS);
  const [points, setPoints] = useState<PointDef[]>([]);
  const [verticalLines, setVerticalLines] = useState<VerticalLineDef[]>([]);
  const [integrals, setIntegrals] = useState<IntegralDef[]>([]);
  const [tangents, setTangents] = useState<TangentDef[]>([]);
  const [features, setFeatures] = useState<FeaturePoint[]>([]);
  
  const [intersectionSelection, setIntersectionSelection] = useState<string[]>([]);
  
  const [dimCm, setDimCm] = useState({ width: 12, height: 12 });
  const [isFixedSize, setIsFixedSize] = useState(true);
  const [showExactValues, setShowExactValues] = useState(false);
  
  const [windowSettings, setWindowSettings] = useState({
    xMin: "-4", xMax: "4", yMin: "-4", yMax: "4",
    xStep: "1", yStep: "1", xSubdivisions: 2, ySubdivisions: 2
  });

  const [bgImage, setBgImage] = useState<BackgroundImage | null>(null);

  // --- HELPERS ---
  const parseMath = useCallback((input: string | number): number => {
      try {
          const val = math.evaluate(preprocessMathExpression(String(input)).parsed);
          return typeof val === 'number' && isFinite(val) ? val : 0;
      } catch { return 0; }
  }, []);

  // --- EFFECTS ---

  const globalScope = useMemo(() => {
      const scope: Record<string, any> = {};
      functions.forEach(f => {
          if (!f.expression) return;
          const { parsed } = preprocessMathExpression(f.expression);
          
          // Check if it's an assignment like a=5 or f(x)=...
          // But not y=... or x=...
          const eqIndex = parsed.indexOf('=');
          if (eqIndex !== -1) {
              const prevChar = parsed[eqIndex - 1];
              const nextChar = parsed[eqIndex + 1];
              if (prevChar !== '<' && prevChar !== '>' && prevChar !== '=' && prevChar !== '!' && nextChar !== '=') {
                  const leftSide = parsed.substring(0, eqIndex).trim();
                  if (!leftSide.startsWith('y') && !leftSide.startsWith('x')) {
                      try {
                          math.evaluate(parsed, scope);
                      } catch {}
                  }
              }
          }
      });
      return scope;
  }, [functions]);

  // 1. Sync Config with Window/Dimensions
  useEffect(() => {
    setConfig(prev => ({
        ...prev,
        layoutMode: isFixedSize ? 'fixed' : 'auto',
        targetWidth: Math.round(dimCm.width * CM_TO_PX),
        targetHeight: Math.round(dimCm.height * CM_TO_PX)
    }));
  }, [dimCm, isFixedSize]);

  useEffect(() => {
    let xMin = parseMath(windowSettings.xMin);
    let xMax = parseMath(windowSettings.xMax);
    let yMin = parseMath(windowSettings.yMin);
    let yMax = parseMath(windowSettings.yMax);
    
    if (xMin >= xMax) xMax = xMin + 1;
    if (yMin >= yMax) yMax = yMin + 1;
    
    let xStep = Math.abs(parseMath(windowSettings.xStep));
    if (xStep < 1e-9) xStep = 1;
    let yStep = Math.abs(parseMath(windowSettings.yStep));
    if (yStep < 1e-9) yStep = 1;
    
    const xSub = Math.max(1, Math.round(Number(windowSettings.xSubdivisions) || 1));
    const ySub = Math.max(1, Math.round(Number(windowSettings.ySubdivisions) || 1));

    setConfig(prev => {
      let updatedShowZero = prev.showZeroLabel;
      if (prev.autoZeroLabel) {
          updatedShowZero = yMin >= 0;
      }
      return {
        ...prev,
        xRange: [xMin, xMax],
        yRange: [yMin, yMax],
        majorStep: [xStep, yStep],
        subdivisions: [xSub, ySub],
        showZeroLabel: updatedShowZero
      };
    });
  }, [windowSettings, parseMath]);

  // 2. Analyze Functions (Features & Intersections)
  const analyzableFunctionsSignature = useMemo(() => {
      return functions
          .filter(f => !(f.locked && f.isCollapsed) || intersectionSelection.includes(f.id))
          .map(f => `${f.id}:${f.expression}:${f.yExpression || ''}:${f.domain[0]}:${f.domain[1]}:${f.domainInclusive[0]}:${f.domainInclusive[1]}:${f.color}:${f.visible}:${f.locked}`)
          .join('|');
  }, [functions, intersectionSelection]);

  useEffect(() => {
      let newFeatures: FeaturePoint[] = [];
      
      functions.forEach(f => {
          const feats = analyzeFunction(f, config.xRange, config.yRange, showExactValues, globalScope);
          newFeatures = [...newFeatures, ...feats];
      });

      if (intersectionSelection.length === 2) {
          const f1 = functions.find(f => f.id === intersectionSelection[0]);
          const f2 = functions.find(f => f.id === intersectionSelection[1]);
          if (f1 && f2) {
              const intersects = analyzeGraphIntersection(f1, f2, config.xRange, showExactValues, globalScope);
              newFeatures = [...newFeatures, ...intersects];
          }
      }

      setFeatures(prev => {
          // Group previous features by functionId + type for ordinal fallback matching when parameters/expressions change
          const prevByGroup = new Map<string, FeaturePoint[]>();
          prev.forEach(p => {
              const key = `${p.functionId}::${p.type}`;
              const arr = prevByGroup.get(key) || [];
              arr.push(p);
              prevByGroup.set(key, arr);
          });

          const newGroupCounters = new Map<string, number>();

          return newFeatures.map(nf => {
              const key = `${nf.functionId}::${nf.type}`;
              const idx = newGroupCounters.get(key) || 0;
              newGroupCounters.set(key, idx + 1);

              // 1. Try exact ID match first
              let existing = prev.find(p => p.id === nf.id);
              // 2. Fallback to same (functionId, type) ordinal index if close enough (e.g. parameter slider dragging)
              if (!existing) {
                  const groupArr = prevByGroup.get(key);
                  if (groupArr && groupArr[idx]) {
                      existing = groupArr[idx];
                  }
              }

              if (existing) {
                  const useExact = existing.useExactLabel;
                  let finalLabel = nf.label;
                  if (useExact !== undefined && useExact !== showExactValues) {
                      finalLabel = nf.type.includes('asymptote')
                          ? nf.label
                          : formatCoordinate(nf.x, nf.y, useExact);
                  }
                  return { 
                      ...nf, 
                      visible: existing.visible, 
                      showLabel: existing.showLabel,
                      customLabelOffset: existing.customLabelOffset,
                      color: existing.color,
                      size: existing.size,
                      useExactLabel: useExact,
                      label: finalLabel
                  };
              }
              // Default endpoints to visible when a domain bound is set
              const defaultVisible = nf.type === 'endpoint';
              return { ...nf, visible: defaultVisible, showLabel: false };
          });
      });
  }, [analyzableFunctionsSignature, config.xRange, config.yRange, showExactValues, intersectionSelection, globalScope]); 

  // 3. Keep tangent equations in sync when globalScope (parameters) or source function expression changes
  const nonLockedFunctionsSignature = useMemo(() => {
      return functions
          .filter(f => !f.locked)
          .map(f => `${f.id}:${f.expression}`)
          .join('|');
  }, [functions]);

  useEffect(() => {
      if (tangents.length === 0) return;
      const derivedUpdates: Record<string, string> = {};
      tangents.forEach(t => {
          if (!t.derivedFunctionId) return;
          const sourceFunc = functions.find(f => f.id === t.functionId);
          if (sourceFunc && sourceFunc.expression) {
              const eqn = calculateTangentEquation(sourceFunc.expression, t.x, t.mode, globalScope);
              derivedUpdates[t.derivedFunctionId] = eqn ?? '';
          }
      });
      if (Object.keys(derivedUpdates).length > 0) {
          setFunctions(prev => {
              let changed = false;
              const next = prev.map(f => {
                  if (derivedUpdates[f.id] !== undefined && f.expression !== derivedUpdates[f.id]) {
                      changed = true;
                      return { ...f, expression: derivedUpdates[f.id] };
                  }
                  return f;
              });
              return changed ? next : prev;
          });
      }
  }, [globalScope, nonLockedFunctionsSignature]);

  // --- ACTIONS ---

  const handleLoadPreset = useCallback((key: string) => {
      const newFuncs: FunctionDef[] = [];
      let newWin = { ...windowSettings };
      let newConfig = { ...config };
      
      const createFunc = (expr: string, color: string, domain: [string, string] = ['', '']): FunctionDef => ({
         id: Date.now().toString() + Math.random(), expression: expr, color, strokeWidth: 2.0, 
         visible: true, lineType: 'solid', domain, domainInclusive: [true, true], plotterType: 'experimental'
      });

      // Reset defaults
      newConfig.piXAxis = false;
      newConfig.piYAxis = false;
      newConfig.showMinorGrid = true;
      setShowExactValues(false);
      setIntersectionSelection([]);
      setIntegrals([]);
      setTangents([]);
      setBgImage(null);

      switch (key) {
          case 'standard':
              newFuncs.push(createFunc('', '#000000'));
              newWin = { xMin: "-5", xMax: "5", yMin: "-5", yMax: "5", xStep: "1", yStep: "1", xSubdivisions: 1, ySubdivisions: 1 };
              newConfig.axisLabels = ["$x$", "$y$"];
              newConfig.showMinorGrid = false;
              break;
          case 'trig':
              newFuncs.push(createFunc('sin(x)', '#000000'));
              newFuncs.push(createFunc('cos(x)', '#e11d48'));
              newWin = { xMin: "-2pi", xMax: "2pi", yMin: "-4", yMax: "4", xStep: "pi/2", yStep: "1", xSubdivisions: 2, ySubdivisions: 2 };
              newConfig.piXAxis = true; newConfig.piYAxis = false;
              setShowExactValues(true);
              break;
          case 'polynomials':
              newFuncs.push(createFunc('x^2', '#000000'));
              newFuncs.push(createFunc('0.5x^3 - 2x', '#2563eb'));
              newWin = { xMin: "-5", xMax: "5", yMin: "-5", yMax: "5", xStep: "1", yStep: "1", xSubdivisions: 2, ySubdivisions: 2 };
              break;
          case 'quadrant1':
              newFuncs.push(createFunc('sqrt(x)', '#000000'));
              newWin = { xMin: "0", xMax: "10", yMin: "0", yMax: "10", xStep: "1", yStep: "1", xSubdivisions: 2, ySubdivisions: 2 };
              newConfig.xAxisAt = 'zero'; newConfig.yAxisAt = 'zero';
              break;
          case 'kinematics':
              newFuncs.push(createFunc('-4.9x^2 + 20x', '#ea580c'));
              newWin = { xMin: "0", xMax: "5", yMin: "-5", yMax: "25", xStep: "1", yStep: "5", xSubdivisions: 1, ySubdivisions: 1 };
              newConfig.axisLabels = ["$t$ (s)", "$s$ (m)"];
              newConfig.xAxisAt = 'zero'; newConfig.yAxisAt = 'zero';
              newConfig.showMinorGrid = false;
              break;
      }

      setFunctions(newFuncs);
      setWindowSettings(newWin);
      setConfig(newConfig);
      setFeatures([]); 
      setVerticalLines([]);
      setPoints([]);
  }, [config, windowSettings]);

  // Functions CRUD
  const addFunction = (type: 'function' | 'parameter' | 'parametric' = 'function') => {
    let paramName = 'a';
    if (type === 'parameter') {
        const usedNames = functions.map(f => {
            const match = f.expression.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
            return match ? match[1] : null;
        }).filter(Boolean);
        const alphabet = 'abcdefghijklmnopqrstuvwxyz';
        for (const char of alphabet) {
            if (!usedNames.includes(char) && char !== 'x' && char !== 'y' && char !== 'f' && char !== 'g') {
                paramName = char;
                break;
            }
        }
    }

    setFunctions([...functions, { 
      id: Date.now().toString(), 
      expression: type === 'parameter' ? `${paramName} = 1` : (type === 'parametric' ? 'cos(t)' : ''), 
      yExpression: type === 'parametric' ? 'sin(t)' : undefined,
      type: type === 'parameter' ? 'parameter' : undefined,
      isParametric: type === 'parametric',
      color: '#000000', 
      strokeWidth: 2.0, visible: true, domain: ['', ''], domainInclusive: [true, true], isCollapsed: false, plotterType: 'experimental'
    }]);
  };

  const updateFunction = (id: string, updates: Partial<FunctionDef>) => {
      const nextFunctions = functions.map(f => f.id === id ? { ...f, ...updates } : f);
      
      if (updates.expression !== undefined) {
          const dependentTangents = tangents.filter(t => t.functionId === id);
          if (dependentTangents.length > 0) {
              const newExpr = updates.expression;
              const derivedUpdates: Record<string, string> = {}; 

              dependentTangents.forEach(t => {
                  if (t.derivedFunctionId) {
                      const eqn = calculateTangentEquation(newExpr, t.x, t.mode, globalScope);
                      if (eqn !== null) derivedUpdates[t.derivedFunctionId] = eqn;
                  }
              });

              const finalFunctions = nextFunctions.map(f => {
                  if (derivedUpdates[f.id] !== undefined) {
                      return { ...f, expression: derivedUpdates[f.id] };
                  }
                  return f;
              });
              setFunctions(finalFunctions);
              return;
          }
      }
      
      const parentTangent = tangents.find(t => t.derivedFunctionId === id);
      if (parentTangent) {
          const tanUpdates: Partial<TangentDef> = {};
          if (updates.visible !== undefined) tanUpdates.visible = updates.visible;
          if (updates.color !== undefined) tanUpdates.color = updates.color;
          if (updates.strokeWidth !== undefined) tanUpdates.strokeWidth = updates.strokeWidth;
          if (updates.lineType !== undefined) tanUpdates.lineType = updates.lineType;
          if (Object.keys(tanUpdates).length > 0) {
              setTangents(prev => prev.map(t => t.id === parentTangent.id ? { ...t, ...tanUpdates } : t));
          }
      }

      setFunctions(nextFunctions);
  };

  const removeFunction = (id: string) => {
    setFunctions(funcs => funcs.filter(f => f.id !== id));
    setFeatures(prev => prev.filter(p => p.functionId !== id));
    setIntersectionSelection(prev => prev.filter(selId => selId !== id));
    setIntegrals(prev => prev.filter(i => i.functionId1 !== id && i.functionId2 !== id));
    
    const tangentUsingThis = tangents.find(t => t.derivedFunctionId === id);
    if (tangentUsingThis) {
        setTangents(prev => prev.filter(t => t.id !== tangentUsingThis.id));
    } else {
        setTangents(prev => {
            const toKeep: TangentDef[] = [];
            const idsToRemoveDerived: string[] = [];
            prev.forEach(t => {
                if (t.functionId === id) {
                    if (t.derivedFunctionId) idsToRemoveDerived.push(t.derivedFunctionId);
                } else {
                    toKeep.push(t);
                }
            });
            if (idsToRemoveDerived.length > 0) {
                setTimeout(() => {
                    setFunctions(current => current.filter(f => !idsToRemoveDerived.includes(f.id)));
                }, 0);
            }
            return toKeep;
        });
    }
  };

  // Tangents CRUD
  const addTangent = (customX?: number, customFuncId?: string) => {
      const targetFunc = (customFuncId ? functions.find(f => f.id === customFuncId) : null)
          || functions.find(f => f.type !== 'parameter' && !f.isParametric && !f.locked)
          || functions[0];
      if (!targetFunc) return;

      const derivedId = Date.now().toString() + "_derived";
      const x = customX !== undefined ? Number(customX.toFixed(2)) : 1;
      const mode = 'tangent';
      const eqn = calculateTangentEquation(targetFunc.expression, x, mode, globalScope);

      setFunctions(prev => [...prev, {
          id: derivedId,
          expression: eqn || '',
          color: '#000000',
          strokeWidth: 1.5,
          visible: true,
          lineType: 'dashed',
          domain: ['', ''],
          domainInclusive: [false, false],
          isCollapsed: true,
          locked: true,
          plotterType: 'experimental'
      }]);

      setTangents([...tangents, {
          id: Date.now().toString(),
          functionId: targetFunc.id,
          derivedFunctionId: derivedId,
          x: x,
          mode: mode,
          color: '#000000',
          visible: true,
          showPoint: true,
          lineType: 'dashed',
          strokeWidth: 1.5
      }]);
  };

  const updateTangent = (id: string, updates: Partial<TangentDef>) => {
      const targetTangent = tangents.find(t => t.id === id);
      if (!targetTangent) return;
      const next = { ...targetTangent, ...updates };

      setTangents(prev => prev.map(t => t.id === id ? next : t));

      if (next.derivedFunctionId) {
          const sourceFunc = functions.find(f => f.id === next.functionId);
          if (sourceFunc) {
              const funcUpdates: Partial<FunctionDef> = {};
              
              if (updates.x !== undefined || updates.mode !== undefined || updates.functionId !== undefined) {
                  const newEqn = calculateTangentEquation(sourceFunc.expression, next.x, next.mode, globalScope);
                  funcUpdates.expression = newEqn ?? '';
              }
              if (updates.color !== undefined) funcUpdates.color = updates.color;
              if (updates.lineType !== undefined) funcUpdates.lineType = updates.lineType;
              if (updates.strokeWidth !== undefined) funcUpdates.strokeWidth = updates.strokeWidth;
              if (updates.visible !== undefined) funcUpdates.visible = updates.visible;

              if (Object.keys(funcUpdates).length > 0) {
                  setFunctions(current => current.map(f => f.id === next.derivedFunctionId ? { ...f, ...funcUpdates } : f));
              }
          }
      }
  };

  const removeTangent = (id: string) => {
      const t = tangents.find(x => x.id === id);
      if (t && t.derivedFunctionId) {
          setFunctions(prev => prev.filter(f => f.id !== t.derivedFunctionId));
      }
      setTangents(prev => prev.filter(x => x.id !== id));
  };

  const decoupleTangent = (id: string) => {
      const t = tangents.find(x => x.id === id);
      if (t && t.derivedFunctionId) {
          setFunctions(prev => prev.map(f => f.id === t.derivedFunctionId ? { ...f, locked: false } : f));
      }
      setTangents(prev => prev.filter(x => x.id !== id));
  };

  // Other CRUD
  const updateFeatures = (ids: string[], updates: Partial<FeaturePoint>) => setFeatures(prev => prev.map(f => ids.includes(f.id) ? { ...f, ...updates } : f));
  const addVerticalLine = (customX?: string) => setVerticalLines([...verticalLines, { id: Date.now().toString(), x: customX ?? '2', color: '#000000', lineType: 'dashed', strokeWidth: 1.5, visible: true }]);
  const updateVerticalLine = (id: string, u: Partial<VerticalLineDef>) => setVerticalLines(l => l.map(x => x.id === id ? { ...x, ...u } : x));
  const removeVerticalLine = (id: string) => setVerticalLines(l => l.filter(x => x.id !== id));
  const addPoint = (customX?: string, customY?: string) => setPoints([...points, { id: Date.now().toString(), x: customX ?? '0', y: customY ?? '0', color: '#000000', size: 4, style: 'filled', label: customX && customY ? `(${customX}, ${customY})` : '', visible: true }]);
  const updatePoint = (id: string, u: Partial<PointDef>) => setPoints(p => p.map(x => x.id === id ? { ...x, ...u } : x));
  const removePoint = (id: string) => setPoints(p => p.filter(x => x.id !== id));
  const handleSettingChange = (field: keyof typeof windowSettings, value: string) => setWindowSettings(prev => ({ ...prev, [field]: value }));
  
  const togglePiX = (checked: boolean) => {
      setConfig(prev => ({...prev, piXAxis: checked}));
      if (checked) setWindowSettings(prev => ({ ...prev, xMin: "-2pi", xMax: "2pi", xStep: "pi/2" }));
      else setWindowSettings(prev => ({ ...prev, xMin: "-4", xMax: "4", xStep: "1" }));
  };
  const togglePiY = (checked: boolean) => {
      setConfig(prev => ({...prev, piYAxis: checked}));
      if (checked) setWindowSettings(prev => ({ ...prev, yMin: "-2pi", yMax: "2pi", yStep: "pi/2" }));
      else setWindowSettings(prev => ({ ...prev, yMin: "-4", yMax: "4", yStep: "1" }));
  };

  const toggleIntersectionSelection = (id: string) => {
      setIntersectionSelection(prev => {
          if (prev.includes(id)) return prev.filter(x => x !== id);
          if (prev.length >= 2) return [prev[1], id]; 
          return [...prev, id];
      });
  };

  const addIntegral = () => {
      const eligible = functions.filter(f => f.type !== 'parameter' && !f.isParametric && !f.locked && f.expression.trim() !== '');
      const defaultFuncs = eligible.slice(0, 2).map(f => f.id);
      const primaryId = defaultFuncs[0] || functions.find(f => f.type !== 'parameter' && !f.isParametric)?.id || '';
      setIntegrals([...integrals, {
          id: Date.now().toString(),
          functionId1: primaryId,
          functionIds: defaultFuncs.length > 0 ? defaultFuncs : (primaryId ? [primaryId] : []),
          verticalLineIds: [],
          includeXAxis: defaultFuncs.length < 2,
          includeYAxis: false,
          customLines: [],
          shadingMode: 'auto',
          seedPoint: null,
          start: defaultFuncs.length < 2 ? '0' : '',
          end: defaultFuncs.length < 2 ? '2' : '',
          color: '#808080',
          opacity: 0.25,
          visible: true
      }]);
  };
  const updateIntegral = (id: string, updates: Partial<IntegralDef>) => setIntegrals(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  const removeIntegral = (id: string) => setIntegrals(prev => prev.filter(i => i.id !== id));

  const updateFunctionDomain = (id: string, index: 0 | 1, valStr: string) => {
      setFunctions(funcs => funcs.map(f => {
          if (f.id !== id) return f;
          const newDomain = [...f.domain] as [string, string];
          newDomain[index] = valStr;
          return { ...f, domain: newDomain };
      }));
  };
  
  const toggleDomainInclusive = (id: string, index: 0 | 1) => {
      setFunctions(funcs => funcs.map(f => {
          if (f.id !== id) return f;
          const newInc = [...f.domainInclusive] as [boolean, boolean];
          newInc[index] = !newInc[index];
          return { ...f, domainInclusive: newInc };
      }));
  };

  const historyState = useMemo(() => ({
      config,
      functions,
      points,
      verticalLines,
      integrals,
      tangents,
      features,
      intersectionSelection,
      dimCm,
      isFixedSize,
      showExactValues,
      windowSettings,
      bgImage
  }), [
      config, functions, points, verticalLines, integrals, tangents,
      features, intersectionSelection, dimCm, isFixedSize, showExactValues,
      windowSettings, bgImage
  ]);

  const {
      forceSnapshot,
      undo,
      redo,
      canUndo,
      canRedo,
      exportToFile,
      importFromFile
  } = useHistory({
      appId: 'FunctionGrapher',
      version: 2,
      currentState: historyState,
      onRestore: (restored) => {
          if (!restored) return;
          if (restored.config) setConfig({ ...CARTESIAN_CONFIG, axisLabels: ["$x$", "$y$"], offsetXAxisNumY: 3, ...restored.config });
          if (restored.functions) setFunctions(restored.functions);
          if (restored.points) setPoints(restored.points);
          if (restored.verticalLines) setVerticalLines(restored.verticalLines);
          if (restored.integrals) setIntegrals(restored.integrals);
          if (restored.tangents) setTangents(restored.tangents);
          if (restored.features) setFeatures(restored.features);
          if (restored.intersectionSelection) setIntersectionSelection(restored.intersectionSelection);
          if (restored.dimCm) setDimCm(restored.dimCm);
          if (restored.isFixedSize !== undefined) setIsFixedSize(restored.isFixedSize);
          if (restored.showExactValues !== undefined) setShowExactValues(restored.showExactValues);
          if (restored.windowSettings) setWindowSettings(restored.windowSettings);
          if (restored.bgImage !== undefined) setBgImage(restored.bgImage);
      }
  });

  const handleResetDefaultSettings = () => {
      setConfig({
          ...CARTESIAN_CONFIG,
          axisLabels: ["$x$", "$y$"],
          offsetXAxisNumY: 3
      });
      setFunctions(INITIAL_FUNCS);
      setPoints([]);
      setVerticalLines([]);
      setIntegrals([]);
      setTangents([]);
      setFeatures([]);
      setIntersectionSelection([]);
      setDimCm({ width: 12, height: 12 });
      setIsFixedSize(true);
      setShowExactValues(false);
      setWindowSettings({
          xMin: "-4", xMax: "4", yMin: "-4", yMax: "4",
          xStep: "1", yStep: "1", xSubdivisions: 2, ySubdivisions: 2
      });
      setBgImage(null);
      setTimeout(() => forceSnapshot(), 50);
  };

  return {
      config, setConfig,
      functions, setFunctions,
      points, setPoints,
      verticalLines, setVerticalLines,
      integrals, setIntegrals,
      tangents, setTangents,
      features, setFeatures,
      intersectionSelection, setIntersectionSelection,
      dimCm, setDimCm,
      isFixedSize, setIsFixedSize,
      showExactValues, setShowExactValues,
      windowSettings, setWindowSettings,
      bgImage, setBgImage,
      globalScope,
      
      // History & Persistence
      undo, redo, canUndo, canRedo, exportToFile, importFromFile, forceSnapshot, handleResetDefaultSettings,

      // Actions
      handleLoadPreset,
      addFunction, updateFunction, removeFunction, updateFunctionDomain, toggleDomainInclusive,
      addTangent, updateTangent, removeTangent, decoupleTangent,
      addIntegral, updateIntegral, removeIntegral,
      addVerticalLine, updateVerticalLine, removeVerticalLine,
      addPoint, updatePoint, removePoint,
      updateFeatures,
      handleSettingChange,
      togglePiX, togglePiY,
      toggleIntersectionSelection
  };
};
