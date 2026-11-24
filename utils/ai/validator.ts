import * as math from 'mathjs';
import { preprocessMathExpression } from '../mathAnalysis';
import { resolveToolSpec, AIToolSpec } from './toolRegistry';

export interface ValidationIssue {
  severity: 'error' | 'warning';
  path: string;
  message: string;
}

export interface PayloadValidationResult {
  valid: boolean;
  toolSlug: string | null;
  issues: ValidationIssue[];
}

function suggestClosestKey(key: string, allowed: string[]): string | null {
  const lower = key.toLowerCase();
  const aliasHints: Record<string, string> = {
    fill: 'color',
    stroke: 'color',
    colour: 'color',
    expr: 'expression',
    fn: 'expression',
    formula: 'expression',
    from: 'start',
    to: 'end',
    xmin: 'xRange',
    xmax: 'xRange',
    ymin: 'yRange',
    ymax: 'yRange',
    title: 'chartTitle',
    boxes: 'boxPlots'
  };
  if (aliasHints[lower] && allowed.includes(aliasHints[lower])) {
    return aliasHints[lower];
  }
  const match = allowed.find(
    (k) => k.toLowerCase() === lower || k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase())
  );
  return match || null;
}

function validateAgainstSchema(
  value: any,
  schema: Record<string, any> | undefined,
  path: string,
  issues: ValidationIssue[]
) {
  if (!schema || value === undefined || value === null) return;

  if (schema.type === 'object' && typeof value === 'object' && !Array.isArray(value)) {
    const props: Record<string, any> | undefined = schema.properties;
    if (props && schema.additionalProperties === false) {
      const allowed = Object.keys(props);
      for (const k of Object.keys(value)) {
        if (!Object.prototype.hasOwnProperty.call(props, k)) {
          const hint = suggestClosestKey(k, allowed);
          issues.push({
            severity: 'warning',
            path: path ? `${path}.${k}` : k,
            message: `Ignored unknown field "${k}"${path ? ` in ${path}` : ''}${hint ? ` (did you mean "${hint}"?)` : ''}.`
          });
        }
      }
    }
    if (Array.isArray(schema.required)) {
      for (const req of schema.required) {
        if (value[req] === undefined || value[req] === null || value[req] === '') {
          issues.push({
            severity: 'error',
            path: path ? `${path}.${req}` : req,
            message: `Missing required field "${req}"${path ? ` in ${path}` : ''}.`
          });
        }
      }
    }
    if (props) {
      for (const [k, propSchema] of Object.entries(props)) {
        if (value[k] !== undefined) {
          validateAgainstSchema(value[k], propSchema, path ? `${path}.${k}` : k, issues);
        }
      }
    }
  } else if (schema.type === 'array' && Array.isArray(value) && schema.items) {
    value.forEach((item, idx) => {
      validateAgainstSchema(item, schema.items, `${path}[${idx}]`, issues);
    });
  } else if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    issues.push({
      severity: 'warning',
      path,
      message: `Invalid value "${String(value)}" at ${path}. Expected one of: ${schema.enum.join(', ')}.`
    });
  }
}

function checkMathExpr(raw: unknown, path: string, issues: ValidationIssue[], allowEmpty = false) {
  if (raw === undefined || raw === null) return;
  const s = String(raw).trim();
  if (!s) {
    if (!allowEmpty) {
      issues.push({ severity: 'error', path, message: `Empty math expression at ${path}.` });
    }
    return;
  }
  try {
    const { plotExpression } = preprocessMathExpression(s);
    math.parse(plotExpression);
  } catch (err: any) {
    issues.push({
      severity: 'error',
      path,
      message: `Couldn't parse math expression "${s}" at ${path}: ${err?.message || 'syntax error'}.`
    });
  }
}

/**
 * Recursively adds `additionalProperties: false` to object schemas that define `properties`
 * (unless they explicitly permit arbitrary keys like regions or category value maps).
 */
export function makeStrictSchema(schema: Record<string, any>): Record<string, any> {
  if (!schema || typeof schema !== 'object') return schema;
  const copy: Record<string, any> = Array.isArray(schema) ? [...schema] : { ...schema };
  if (copy.type === 'object' && copy.properties && copy.additionalProperties === undefined) {
    copy.additionalProperties = false;
  }
  if (copy.properties && typeof copy.properties === 'object') {
    const nextProps: Record<string, any> = {};
    for (const [k, v] of Object.entries(copy.properties)) {
      nextProps[k] = makeStrictSchema(v as Record<string, any>);
    }
    copy.properties = nextProps;
  }
  if (copy.items && typeof copy.items === 'object') {
    copy.items = makeStrictSchema(copy.items);
  }
  return copy;
}

/**
 * Validates a raw AI payload for a tool, checking strict schema keys, required fields,
 * mathjs expression syntax, and cross-references (such as integral functionId1/functionId2).
 */
export function validateToolPayload(
  toolIdentifier: string,
  payload: Record<string, any> | null | undefined
): PayloadValidationResult {
  const spec: AIToolSpec | undefined = resolveToolSpec(toolIdentifier);
  if (!spec) {
    return {
      valid: false,
      toolSlug: null,
      issues: [
        {
          severity: 'error',
          path: 'tool',
          message: `Unknown tool slug "${toolIdentifier}". Check /llms.txt for valid tool slugs.`
        }
      ]
    };
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      valid: false,
      toolSlug: spec.slug,
      issues: [
        {
          severity: 'error',
          path: 'config',
          message: 'Payload must be a JSON object.'
        }
      ]
    };
  }

  const issues: ValidationIssue[] = [];
  const strictSchema = makeStrictSchema(spec.schema);
  validateAgainstSchema(payload, strictSchema, '', issues);

  // Tool-specific semantic & math expression checks
  if (spec.slug === 'function-grapher') {
    const funcs = Array.isArray(payload.functions) ? payload.functions : [];
    const funcIds = new Set<string>();
    funcs.forEach((f: any, idx: number) => {
      const id = String(f?.id || idx + 1);
      funcIds.add(id);
      if (f && typeof f === 'object') {
        checkMathExpr(f.expression, `functions[${idx}].expression`, issues, false);
        if (f.yExpression) checkMathExpr(f.yExpression, `functions[${idx}].yExpression`, issues, false);
        if (Array.isArray(f.domain)) {
          if (f.domain[0]) checkMathExpr(f.domain[0], `functions[${idx}].domain[0]`, issues, true);
          if (f.domain[1]) checkMathExpr(f.domain[1], `functions[${idx}].domain[1]`, issues, true);
        }
      }
    });

    if (Array.isArray(payload.points)) {
      payload.points.forEach((p: any, idx: number) => {
        if (typeof p?.x === 'string') checkMathExpr(p.x, `points[${idx}].x`, issues, false);
        if (typeof p?.y === 'string') checkMathExpr(p.y, `points[${idx}].y`, issues, false);
      });
    }

    if (Array.isArray(payload.verticalLines)) {
      payload.verticalLines.forEach((vl: any, idx: number) => {
        if (typeof vl?.x === 'string') checkMathExpr(vl.x, `verticalLines[${idx}].x`, issues, false);
      });
    }

    if (Array.isArray(payload.integrals)) {
      payload.integrals.forEach((ig: any, idx: number) => {
        if (ig?.start !== undefined && String(ig.start).trim() !== '') {
          checkMathExpr(ig.start, `integrals[${idx}].start`, issues, true);
        }
        if (ig?.end !== undefined && String(ig.end).trim() !== '') {
          checkMathExpr(ig.end, `integrals[${idx}].end`, issues, true);
        }
        const referencedIds = [
          ...(Array.isArray(ig?.functionIds) ? ig.functionIds : []),
          ...(ig?.functionId1 ? [ig.functionId1] : []),
          ...(ig?.functionId2 && ig.functionId2 !== 'axis-y' ? [ig.functionId2] : [])
        ];
        referencedIds.forEach((refId) => {
          if (funcIds.size > 0 && !funcIds.has(String(refId))) {
            issues.push({
              severity: 'warning',
              path: `integrals[${idx}]`,
              message: `Integral references function id "${refId}", which does not match any function id (${Array.from(funcIds).join(', ')}). Functions without an explicit "id" default to "1", "2", "3", ...`
            });
          }
        });
      });
    }
  } else if (spec.slug === 'inequality-grapher' && Array.isArray(payload.inequalities)) {
    payload.inequalities.forEach((inq: any, idx: number) => {
      if (inq?.type !== 'complex' && inq?.type !== 'linear') {
        checkMathExpr(inq?.expression, `inequalities[${idx}].expression`, issues, false);
      }
    });
  }

  return {
    valid: issues.length === 0,
    toolSlug: spec.slug,
    issues
  };
}
