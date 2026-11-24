import { Page } from '../../types';
import { resolveToolSpec, resolveToolByAppId, normalizeToolPayload } from './toolRegistry';

export interface ParsedAIRequest {
  slug: string;
  page: Page;
  appId: string;
  payload: Record<string, any> | null;
}

export const AI_HYDRATE_EVENT = 'graphmaker-ai-hydrate';

let pendingHydrations: Record<string, Record<string, any>> = {};
let activeDeepLinkUrlParsed = false;

function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(b64: string): string {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Decodes either plain JSON string or Base64URL-encoded JSON (with optional `b64:` prefix).
 */
export function decodeConfigParam(raw: string | null): Record<string, any> | null {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();

  // 1. Explicit b64: prefix
  if (trimmed.startsWith('b64:')) {
    try {
      const jsonStr = base64UrlDecode(trimmed.slice(4));
      const parsed = JSON.parse(jsonStr);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  // 2. Plain JSON (preferred for human/LLM readability)
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  // 3. Fallback: try raw Base64URL
  try {
    const jsonStr = base64UrlDecode(trimmed);
    const parsed = JSON.parse(jsonStr);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Encodes a GitHub Pages deep-link URL for any tool and configuration payload.
 */
export function encodeDeepLinkUrl(
  baseUrl: string,
  toolIdentifier: string,
  payload?: Record<string, any>
): string {
  const spec = resolveToolSpec(toolIdentifier);
  if (!spec) {
    throw new Error(`Unknown GraphMaker tool: "${toolIdentifier}"`);
  }

  const normalizedBase = baseUrl.replace(/\?.*$/, '').replace(/#.*$/, '');
  const params = new URLSearchParams();
  params.set('tool', spec.slug);

  if (payload && Object.keys(payload).length > 0) {
    const jsonStr = JSON.stringify(payload);
    if (jsonStr.length <= 1200) {
      params.set('config', jsonStr);
    } else {
      params.set('config', `b64:${base64UrlEncode(jsonStr)}`);
    }
  }

  return `${normalizedBase}?${params.toString()}`;
}

/**
 * Parses URL search/hash parameters in the browser to determine if an AI deep-link is active.
 */
export function parseCurrentUrlAIRequest(): ParsedAIRequest | null {
  if (typeof window === 'undefined') return null;

  let params = new URLSearchParams(window.location.search);
  let toolParam = params.get('tool') || params.get('page');
  let configParam = params.get('config') || params.get('data');

  // Also support hash query params (#?tool=... or #tool=...)
  if (!toolParam && window.location.hash) {
    const hashStr = window.location.hash.replace(/^#\??/, '');
    const hashParams = new URLSearchParams(hashStr);
    toolParam = hashParams.get('tool') || hashParams.get('page');
    configParam = hashParams.get('config') || hashParams.get('data');
  }

  if (!toolParam) return null;
  const spec = resolveToolSpec(toolParam);
  if (!spec) return null;

  const payload = decodeConfigParam(configParam);
  return {
    slug: spec.slug,
    page: spec.page,
    appId: spec.appId,
    payload
  };
}

/**
 * Seeds the hydration bus once on initial browser page load if URL parameters are present.
 */
export function initAIUrlHydration(): Page | null {
  if (activeDeepLinkUrlParsed) return null;
  activeDeepLinkUrlParsed = true;

  const parsed = parseCurrentUrlAIRequest();
  if (!parsed) return null;

  if (parsed.payload) {
    pendingHydrations[parsed.appId] = parsed.payload;
  }
  return parsed.page;
}

/**
 * Queues a payload for a tool and dispatches a live hydration event if that tool is already mounted.
 */
export function dispatchAIHydration(toolIdentifier: string, payload: Record<string, any>) {
  const spec = resolveToolSpec(toolIdentifier);
  if (!spec) return;

  pendingHydrations[spec.appId] = payload;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(AI_HYDRATE_EVENT, {
        detail: { appId: spec.appId, slug: spec.slug, payload }
      })
    );
  }
}

/**
 * Consumes any pending AI hydration payload for a given useHistory appId and merges it
 * onto the tool's base default state via Smart Default Merger.
 */
export function consumeAIHydration<T>(appId: string, baseState: T): T | null {
  const rawPayload = pendingHydrations[appId];
  if (!rawPayload) return null;

  delete pendingHydrations[appId];
  const spec = resolveToolByAppId(appId);
  if (!spec) return null;

  return normalizeToolPayload(spec.slug, rawPayload, baseState as Record<string, any>) as T;
}

/**
 * Merges a live event payload for a mounted tool without clearing unrelated pending tools.
 */
export function mergeLiveAIHydration<T>(appId: string, payload: Record<string, any>, baseState: T): T | null {
  const spec = resolveToolByAppId(appId);
  if (!spec) return null;
  return normalizeToolPayload(spec.slug, payload, baseState as Record<string, any>) as T;
}
