import { Page } from '../../types';
import { AI_TOOLS, resolveToolByPage, resolveToolSpec } from './toolRegistry';
import { dispatchAIHydration, encodeDeepLinkUrl } from './urlState';
import { sanitizeSvgMarkup, extractSvgDimensions } from './svgSanitizer';
import { generateGraphImage } from '../imageExport';

export interface GraphMakerAIBridge {
  version: string;
  getTools: () => Array<{
    slug: string;
    name: string;
    category: string;
    description: string;
    svgId: string;
    schema: Record<string, unknown>;
    example: Record<string, unknown>;
  }>;
  getCurrentTool: () => { slug: string; name: string; page: Page; svgId: string } | null;
  openTool: (toolIdentifier: string, payload?: Record<string, any>) => { ok: boolean; slug?: string; error?: string };
  getShareUrl: (toolIdentifier: string, payload?: Record<string, any>, baseUrl?: string) => string;
  exportSVG: (options?: { widthCm?: number; heightCm?: number }) => string | null;
  exportPNG: (options?: { widthCm?: number; dpi?: number }) => Promise<{
    dataUrl: string;
    widthCm: number;
    heightCm: number;
    dpi: number;
  } | null>;
}

declare global {
  interface Window {
    GraphMakerAI?: GraphMakerAIBridge;
  }
}

/**
 * Registers the invisible `window.GraphMakerAI` controller for browser agents and automation tools.
 * Renders zero DOM elements and does not alter any visible UI.
 */
export function registerBrowserAIBridge(opts: {
  getCurrentPage: () => Page;
  navigateToPage: (page: Page) => void;
}) {
  if (typeof window === 'undefined') return;

  const getActiveSpec = () => resolveToolByPage(opts.getCurrentPage()) || null;

  const bridge: GraphMakerAIBridge = {
    version: '1.0.0',

    getTools() {
      return AI_TOOLS.map((t) => ({
        slug: t.slug,
        name: t.name,
        category: t.category,
        description: t.description,
        svgId: t.svgId,
        schema: t.schema,
        example: t.example
      }));
    },

    getCurrentTool() {
      const spec = getActiveSpec();
      if (!spec) return null;
      return {
        slug: spec.slug,
        name: spec.name,
        page: spec.page,
        svgId: spec.svgId
      };
    },

    openTool(toolIdentifier: string, payload?: Record<string, any>) {
      const spec = resolveToolSpec(toolIdentifier);
      if (!spec) {
        return { ok: false, error: `Unknown tool "${toolIdentifier}". Call GraphMakerAI.getTools() to see valid slugs.` };
      }
      if (payload && typeof payload === 'object') {
        dispatchAIHydration(spec.slug, payload);
      }
      opts.navigateToPage(spec.page);
      return { ok: true, slug: spec.slug };
    },

    getShareUrl(toolIdentifier: string, payload?: Record<string, any>, baseUrl?: string) {
      const resolvedBase = baseUrl || `${window.location.origin}${window.location.pathname}`;
      return encodeDeepLinkUrl(resolvedBase, toolIdentifier, payload);
    },

    exportSVG(options = {}) {
      const spec = getActiveSpec();
      const svgEl =
        (spec && document.getElementById(spec.svgId)) ||
        document.querySelector('main svg[id]');
      if (!svgEl) return null;

      const serializer = new XMLSerializer();
      const raw = serializer.serializeToString(svgEl);
      return sanitizeSvgMarkup(raw, {
        widthCm: options.widthCm,
        heightCm: options.heightCm
      });
    },

    async exportPNG(options = {}) {
      const spec = getActiveSpec();
      const svgEl =
        ((spec && document.getElementById(spec.svgId)) ||
          document.querySelector('main svg[id]')) as SVGSVGElement | null;
      if (!svgEl || !svgEl.id) return null;

      const dims = extractSvgDimensions(new XMLSerializer().serializeToString(svgEl));
      const widthCm = options.widthCm || spec?.defaultWidthCm || 14;
      const dpi = options.dpi || 300;

      const result = await generateGraphImage(
        svgEl.id,
        dims.width,
        dims.height,
        widthCm,
        false,
        20,
        dpi
      );
      if (!result) return null;

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(result.blob);
      });

      return {
        dataUrl,
        widthCm: result.widthCm,
        heightCm: result.heightCm,
        dpi
      };
    }
  };

  window.GraphMakerAI = bridge;
}
