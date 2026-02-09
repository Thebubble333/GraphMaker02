
import { useState, useEffect, useCallback } from 'react';
import { GraphConfig, FunctionDef, PointDef, VerticalLineDef, FeaturePoint, IntegralDef, TangentDef } from '../types';
import { CARTESIAN_CONFIG } from '../config/graphDefaults';
import { analyzeFunction, analyzeGraphIntersection, calculateTangentEquation, findSnapPoint } from '../utils/mathAnalysis';
import { formatCoordinate } from '../utils/mathFormatting';
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
      domain: [null, null], domainInclusive: [true, true],
      isCollapsed: false
  }
];

export const useFunctionGrapherState = () => {
  // --- STATE ---
  const [config, setConfig] = useState<GraphConfig>({
      ...CARTESIAN_CONFIG,
      // Function Grapher Specific Overrides (if any)
      axisLabels: ["$x$", "$y$"]
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
          const val = math.evaluate(String(input));
          return typeof val === 'number' && isFinite(val) ? val : 0;
      } catch { return 0; }
  }, []);

  // --- EFFECTS ---

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
    const xMin = parseMath(windowSettings.xMin);
    const xMax = parseMath(windowSettings.xMax);
    const yMin = parseMath(windowSettings.yMin);
    const yMax = parseMath(windowSettings.yMax);
    
    let xStep = Math.abs(parseMath(windowSettings.xStep));
    if (xStep < 1e-9) xStep = 1;
    let yStep = Math.abs(parseMath(windowSettings.yStep));
    if (yStep < 1e-9) yStep = 1;
    
    const xSub = Math.max(1, Math.round(Number(windowSettings.xSubdivisions) || 1));
    const ySub = Math.max(1, Math.round(Number(windowSettings.ySubdivisions) || 1));

    setConfig(prev => ({
      ...prev,
      xRange: [xMin, xMax],
      yRange: [yMin, yMax],
      majorStep: [xStep, yStep],
      subdivisions: [xSub, ySub]
    }));
  }, [windowSettings, parseMath]);

  // 2. Analyze Functions (Features & Intersections)
  useEffect(() => {
      let newFeatures: FeaturePoint[] = [];
      
      functions.forEach(f => {
          const feats = analyzeFunction(f, config.xRange, config.yRange, showExactValues);
          newFeatures = [...newFeatures, ...feats];
      });

      if (intersectionSelection.length === 2) {
          const f1 = functions.find(f => f.id === intersectionSelection[0]);
          const f2 = functions.find(f => f.id === intersectionSelection[1]);
          if (f1 && f2) {
              const intersects = analyzeGraphIntersection(f1, f2, config.xRange, showExactValues);
              newFeatures = [...newFeatures, ...intersects];
          }
      }

      setFeatures(prev => {
          return newFeatures.map(nf => {
              const existing = prev.find(p => p.id === nf.id);
              let finalLabel = nf.label;
              let useExact = undefined;

              if (existing) {
                  useExact = existing.useExactLabel;
                  if (useExact !== undefined && useExact !== showExactValues) {
                      finalLabel = formatCoordinate(nf.x, nf.y, useExact);
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
              return { ...nf, visible: false, showLabel: false };
          });
      });
  }, [functions, config.xRange, config.yRange, showExactValues, intersectionSelection]); 

  // --- ACTIONS ---

  const handleLoadPreset = useCallback((key: string) => {
      const newFuncs: FunctionDef[] = [];
      let newWin = { ...windowSettings };
      let newConfig = { ...config };
      
      const createFunc = (expr: string, color: string): FunctionDef => ({
         id: Date.now().toString() + Math.random(), expression: expr, color, strokeWidth: 2.0, 
         visible: true, lineType: 'solid', domain: [null, null], domainInclusive: [true, true]
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
  const addFunction = () => {
    setFunctions([...functions, { 
      id: Date.now().toString(), expression: '', color: '#000000', 
      strokeWidth: 2.0, visible: true, domain: [null, null], domainInclusive: [true, true], isCollapsed: false
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
                      const eqn = calculateTangentEquation(newExpr, t.x, t.mode);
                      if (eqn) derivedUpdates[t.derivedFunctionId] = eqn;
                  }
              });

              const finalFunctions = nextFunctions.map(f => {
                  if (derivedUpdates[f.id]) {
                      return { ...f, expression: derivedUpdates[f.id] };
                  }
                  return f;
              });
              setFunctions(finalFunctions);
              return;
          }
      }
      
      if (updates.visible !== undefined) {
          const parentTangent = tangents.find(t => t.derivedFunctionId === id);
          if (parentTangent) {
              setTangents(prev => prev.map(t => t.id === parentTangent.id ? { ...t, visible: updates.visible! } : t));
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
  const addTangent = () => {
      const defaultFunc = functions[0];
      if (!defaultFunc) return;

      const derivedId = Date.now().toString() + "_derived";
      const x = 1;
      const mode = 'tangent';
      const eqn = calculateTangentEquation(defaultFunc.expression, x, mode);

      setFunctions(prev => [...prev, {
          id: derivedId,
          expression: eqn || '',
          color: '#000000',
          strokeWidth: 2,
          visible: true,
          lineType: 'solid',
          domain: [null, null],
          domainInclusive: [false, false],
          isCollapsed: true,
          locked: true
      }]);

      setTangents([...tangents, {
          id: Date.now().toString(),
          functionId: defaultFunc.id,
          derivedFunctionId: derivedId,
          x: x,
          mode: mode,
          color: '#000000',
          visible: true,
          showPoint: true,
          lineType: 'solid',
          strokeWidth: 2
      }]);
  };

  const updateTangent = (id: string, updates: Partial<TangentDef>) => {
      setTangents(prev => prev.map(t => {
          if (t.id !== id) return t;
          const next = { ...t, ...updates };
          
          if (next.derivedFunctionId) {
              const sourceFunc = functions.find(f => f.id === next.functionId);
              if (sourceFunc) {
                  const funcUpdates: Partial<FunctionDef> = {};
                  
                  if (updates.x !== undefined || updates.mode !== undefined || updates.functionId !== undefined) {
                      const newEqn = calculateTangentEquation(sourceFunc.expression, next.x, next.mode);
                      if (newEqn) funcUpdates.expression = newEqn;
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
          return next;
      }));
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
  const addVerticalLine = () => setVerticalLines([...verticalLines, { id: Date.now().toString(), x: 2, color: '#000000', lineType: 'dashed', strokeWidth: 1.5, visible: true }]);
  const updateVerticalLine = (id: string, u: Partial<VerticalLineDef>) => setVerticalLines(l => l.map(x => x.id === id ? { ...x, ...u } : x));
  const removeVerticalLine = (id: string) => setVerticalLines(l => l.filter(x => x.id !== id));
  const addPoint = () => setPoints([...points, { id: Date.now().toString(), x: 0, y: 0, color: '#000000', size: 4, style: 'filled', label: '', visible: true }]);
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
      const defaultFunc = functions[0]?.id || '';
      setIntegrals([...integrals, {
          id: Date.now().toString(),
          functionId1: defaultFunc,
          start: '', end: '',
          color: '#808080',
          opacity: 0.3,
          visible: true
      }]);
  };
  const updateIntegral = (id: string, updates: Partial<IntegralDef>) => setIntegrals(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  const removeIntegral = (id: string) => setIntegrals(prev => prev.filter(i => i.id !== id));

  const updateFunctionDomain = (id: string, index: 0 | 1, valStr: string) => {
      setFunctions(funcs => funcs.map(f => {
          if (f.id !== id) return f;
          const newVal = valStr === '' ? null : parseFloat(valStr);
          const newDomain = [...f.domain] as [number|null, number|null];
          newDomain[index] = isNaN(newVal as number) ? null : newVal;
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
