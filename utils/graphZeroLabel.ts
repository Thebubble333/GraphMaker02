import { GraphConfig } from '../types';

/**
 * Shared origin zero-label visibility rule used by both browser pages
 * and the headless CLI/MCP renderers so output always matches.
 *
 * When `autoZeroLabel` is true, hides the "0" label whenever the x-axis
 * crosses strictly inside the y-range (yMin < 0 && yMax > 0), and shows
 * it when the x-axis sits on an edge (yMin >= 0 or yMax <= 0).
 */
export function resolveAutoZeroLabel(
  config: Pick<GraphConfig, 'showZeroLabel' | 'autoZeroLabel'>,
  yMin: number,
  yMax: number
): boolean {
  if (config.autoZeroLabel) {
    return yMin >= 0 || yMax <= 0;
  }
  return config.showZeroLabel;
}
