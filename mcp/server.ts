#!/usr/bin/env tsx
import fs from 'node:fs/promises';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { AI_TOOLS, resolveToolSpec } from '../utils/ai/toolRegistry';
import { encodeDeepLinkUrl } from '../utils/ai/urlState';
import { makeStrictSchema } from '../utils/ai/validator';
import { renderToolHeadlessSVG } from '../utils/ai/headlessRenderer';
import { renderSvgToPngBuffer } from './pngRender';

const DEFAULT_BASE_URL =
  process.env.GRAPH_MAKER_BASE_URL || 'https://thebubble333.github.io/GraphMaker02/';

const server = new McpServer({
  name: 'graph-maker-suite',
  version: '1.0.0'
});

const toolSlugEnum = AI_TOOLS.map((t) => t.slug);

function validateOutputPath(outputPath: string, expectedExt: '.svg' | '.png'): string {
  const resolved = path.resolve(outputPath);
  if (!resolved.toLowerCase().endsWith(expectedExt)) {
    throw new Error(`outputPath must end with "${expectedExt}".`);
  }
  return resolved;
}

// 1. List all 18 mathematical tools
server.tool(
  'list_math_tools',
  'List all 18 mathematical graphing, statistical, and discrete diagram tools available in Graph Maker Suite.',
  {
    category: z
      .enum(['all', 'cartesian', 'statistics', 'diagrams'])
      .optional()
      .describe('Optional category filter')
  },
  async ({ category }) => {
    const filtered =
      category && category !== 'all'
        ? AI_TOOLS.filter((t) => t.category === category)
        : AI_TOOLS;

    const summary = filtered.map((t) => ({
      slug: t.slug,
      name: t.name,
      category: t.category,
      description: t.description,
      defaultDimensionsCm: { width: t.defaultWidthCm, height: t.defaultHeightCm }
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summary, null, 2)
        }
      ]
    };
  }
);

// 2. Get detailed JSON schema and copy-paste example for a specific tool
server.tool(
  'get_tool_schema',
  'Get the exact JSON payload schema and working example for any Graph Maker Suite tool.',
  {
    tool: z
      .string()
      .describe(`Tool slug or name. Valid slugs: ${toolSlugEnum.join(', ')}`)
  },
  async ({ tool }) => {
    const spec = resolveToolSpec(tool);
    if (!spec) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Unknown tool "${tool}". Available slugs: ${toolSlugEnum.join(', ')}`
          }
        ]
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              slug: spec.slug,
              name: spec.name,
              category: spec.category,
              description: spec.description,
              schema: makeStrictSchema(spec.schema as Record<string, any>),
              example: spec.example
            },
            null,
            2
          )
        }
      ]
    };
  }
);

// 3. Generate clickable, pre-populated editable GitHub Pages deep-link URL
server.tool(
  'generate_graph_url',
  'Create an editable GitHub Pages URL that opens Graph Maker Suite directly to the specified tool pre-populated with your math data and styling.',
  {
    tool: z.string().describe(`Tool slug e.g. ${toolSlugEnum.slice(0, 6).join(', ')}, etc.`),
    payload: z
      .record(z.any())
      .optional()
      .describe('Tool-specific JSON configuration (call get_tool_schema for exact fields).'),
    baseUrl: z
      .string()
      .url()
      .optional()
      .describe('Optional override for the hosted GitHub Pages URL')
  },
  async ({ tool, payload, baseUrl }) => {
    const spec = resolveToolSpec(tool);
    if (!spec) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Unknown tool "${tool}". Valid slugs: ${toolSlugEnum.join(', ')}` }]
      };
    }

    const url = encodeDeepLinkUrl(baseUrl || DEFAULT_BASE_URL, spec.slug, payload || {});
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ tool: spec.slug, editableUrl: url }, null, 2)
        }
      ]
    };
  }
);

// 4. Render clean, MS-Word-safe SVG markup headlessly (optionally save to file)
server.tool(
  'render_graph_svg',
  'Render any Graph Maker Suite tool headlessly into publication-ready, MS-Word-compatible SVG markup, optionally saving to disk and returning an editable GitHub Pages URL.',
  {
    tool: z.string().describe('Tool slug (e.g. "function-grapher", "box-plots", "venn-diagrams", "network-grapher")'),
    payload: z.record(z.any()).optional().describe('Tool configuration payload'),
    widthCm: z.number().positive().max(40).optional().describe('Physical export width in centimeters'),
    heightCm: z.number().positive().max(40).optional().describe('Physical export height in centimeters'),
    outputPath: z.string().optional().describe('Optional local file path ending in .svg to save the output'),
    baseUrl: z.string().url().optional().describe('Optional GitHub Pages URL override')
  },
  async ({ tool, payload, widthCm, heightCm, outputPath, baseUrl }) => {
    try {
      const result = renderToolHeadlessSVG(tool, payload || {}, { widthCm, heightCm });
      const editableUrl = encodeDeepLinkUrl(baseUrl || DEFAULT_BASE_URL, result.toolSlug, payload || {});

      let savedPath: string | undefined;
      if (outputPath) {
        savedPath = validateOutputPath(outputPath, '.svg');
        await fs.mkdir(path.dirname(savedPath), { recursive: true });
        await fs.writeFile(savedPath, result.svg, 'utf8');
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                tool: result.toolSlug,
                widthCm: result.widthCm,
                heightCm: result.heightCm,
                savedPath,
                editableUrl,
                svg: result.svg
              },
              null,
              2
            )
          }
        ]
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to render SVG: ${err?.message || String(err)}` }]
      };
    }
  }
);

// 5. Render crisp 300-DPI PNG with physical centimeter metadata (returns inline image + editable URL + optional file write)
server.tool(
  'render_graph_png',
  'Render any Graph Maker Suite tool headlessly into a crisp 300-DPI PNG with embedded physical centimeter dimensions (for MS Word / print). Returns the rendered PNG image inline, an editable GitHub Pages link, and optionally saves to disk.',
  {
    tool: z.string().describe('Tool slug (e.g. "function-grapher", "box-plots", "tree-diagrams", "shape-builder")'),
    payload: z.record(z.any()).optional().describe('Tool configuration payload'),
    widthCm: z.number().positive().max(40).optional().describe('Physical export width in centimeters (default varies by tool, ~12-15cm)'),
    dpi: z.number().min(72).max(600).optional().describe('Target DPI (default 300)'),
    outputPath: z.string().optional().describe('Optional local file path ending in .png to save the image'),
    baseUrl: z.string().url().optional().describe('Optional GitHub Pages URL override')
  },
  async ({ tool, payload, widthCm, dpi, outputPath, baseUrl }) => {
    try {
      const svgResult = renderToolHeadlessSVG(tool, payload || {}, { widthCm });
      const pngResult = await renderSvgToPngBuffer(svgResult.svg, {
        widthCm: widthCm || svgResult.widthCm,
        dpi: dpi || 300
      });
      const editableUrl = encodeDeepLinkUrl(baseUrl || DEFAULT_BASE_URL, svgResult.toolSlug, payload || {});

      let savedPath: string | undefined;
      if (outputPath) {
        savedPath = validateOutputPath(outputPath, '.png');
        await fs.mkdir(path.dirname(savedPath), { recursive: true });
        await fs.writeFile(savedPath, pngResult.buffer);
      }

      return {
        content: [
          {
            type: 'image',
            data: pngResult.buffer.toString('base64'),
            mimeType: 'image/png'
          },
          {
            type: 'text',
            text: JSON.stringify(
              {
                tool: svgResult.toolSlug,
                widthPx: pngResult.widthPx,
                heightPx: pngResult.heightPx,
                widthCm: pngResult.widthCm,
                heightCm: pngResult.heightCm,
                dpi: pngResult.dpi,
                savedPath,
                editableUrl
              },
              null,
              2
            )
          }
        ]
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to render PNG: ${err?.message || String(err)}` }]
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Graph Maker MCP server failed to start:', err);
  process.exit(1);
});
