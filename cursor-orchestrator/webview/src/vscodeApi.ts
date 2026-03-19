/**
 * Singleton wrapper for acquireVsCodeApi().
 * Must be called at most once per webview lifetime; subsequent calls throw.
 * All panels must import getVsCodeApi() from here instead of calling acquireVsCodeApi() directly.
 */
declare global {
  interface Window {
    acquireVsCodeApi?: () => { postMessage: (msg: unknown) => void };
  }
}

let _api: { postMessage: (msg: unknown) => void } | null = null;

export function getVsCodeApi(): { postMessage: (msg: unknown) => void } | null {
  if (_api) return _api;
  try {
    if (window.acquireVsCodeApi) {
      _api = window.acquireVsCodeApi();
    }
  } catch {
    // Already acquired in this session — return cached instance (should not happen if singleton is used everywhere)
  }
  return _api;
}
