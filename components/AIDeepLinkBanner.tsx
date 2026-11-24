import React, { useState, useEffect } from 'react';
import { AlertTriangle, Copy, Check, X } from 'lucide-react';
import {
  AIDeepLinkDiagnostics,
  AI_DIAGNOSTICS_EVENT,
  getAIDeepLinkDiagnostics
} from '../utils/ai/urlState';

/**
 * Invisible unless a user opened a deep-link URL (?tool=...&config=...) that
 * contains parse errors, unknown fields, or invalid math expressions.
 * Normal visitors and valid deep links see zero UI footprint.
 */
export const AIDeepLinkBanner: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState<AIDeepLinkDiagnostics | null>(() =>
    getAIDeepLinkDiagnostics()
  );
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onUpdate = () => {
      setDiagnostics(getAIDeepLinkDiagnostics());
      setDismissed(false);
    };
    window.addEventListener(AI_DIAGNOSTICS_EVENT, onUpdate);
    return () => window.removeEventListener(AI_DIAGNOSTICS_EVENT, onUpdate);
  }, []);

  if (dismissed || !diagnostics || diagnostics.issues.length === 0) {
    return null;
  }

  const buildReportForAI = () => {
    const lines = [
      'GraphMaker Suite — Deep-Link Diagnostic Report',
      `Tool: ${diagnostics.toolParam || diagnostics.resolvedSlug || 'unknown'}`,
      `URL: ${diagnostics.url}`,
      '',
      'Warnings / Errors:',
      ...diagnostics.issues.map((iss) => `- [${iss.severity.toUpperCase()}] ${iss.message}`),
      ''
    ];
    if (diagnostics.parsedPayload) {
      lines.push('Received Payload:', '```json', JSON.stringify(diagnostics.parsedPayload, null, 2), '```');
      if (diagnostics.parsedPayload.config) {
        lines.push('', 'Axis / Window Config:', '```json', JSON.stringify(diagnostics.parsedPayload.config, null, 2), '```');
      }
    } else if (diagnostics.rawConfigParam) {
      lines.push('Raw config parameter (failed to parse):', '```text', diagnostics.rawConfigParam, '```');
    }
    lines.push(
      '',
      `Please fix these issues using the strict schema at ${window.location.origin}${window.location.pathname.replace(/\/?$/, '/')}ai/${diagnostics.resolvedSlug || 'function-grapher'}.json and regenerate the link.`
    );
    return lines.join('\n');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildReportForAI());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for restricted clipboard contexts
      const ta = document.createElement('textarea');
      ta.value = buildReportForAI();
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      role="alert"
      className="fixed bottom-4 right-4 z-50 max-w-md rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950 shadow-lg"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-amber-900">
            Deep-link payload had {diagnostics.issues.length}{' '}
            {diagnostics.issues.length === 1 ? 'issue' : 'issues'}
          </div>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-amber-900/90">
            {diagnostics.issues.slice(0, 5).map((iss, idx) => (
              <li key={idx} className="break-words">
                {iss.message}
              </li>
            ))}
            {diagnostics.issues.length > 5 && (
              <li>...and {diagnostics.issues.length - 5} more (included in report)</li>
            )}
          </ul>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded bg-amber-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-amber-800"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied report!' : 'Copy report for AI'}
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="rounded px-2 py-1 text-[11px] text-amber-800 hover:bg-amber-100"
            >
              Dismiss
            </button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close warning"
          onClick={() => setDismissed(true)}
          className="text-amber-700 hover:text-amber-950"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
