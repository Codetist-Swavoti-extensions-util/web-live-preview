import React, { useEffect, useMemo, useRef, useState } from 'react';
import './styles.css';

type PreviewStatus = 'idle' | 'loading' | 'ready' | 'error';

declare global {
  interface Window {
    ideAPI: {
      getActiveTheme(): Promise<{ colors?: Record<string, string> } | null>;
      on(event: 'previewState', callback: (payload: {
        status: 'loading' | 'ready' | 'error' | 'closed';
        source?: 'agent' | 'extension';
        url?: string;
        error?: string;
      }) => void): () => void;
    };
  }
}

const DEFAULT_COLORS = {
  background: '#111318',
  panel: '#191c23',
  foreground: '#e5e7eb',
  muted: '#9ca3af',
  border: '#343a46',
  accent: '#60a5fa',
  input: '#0b0d11',
};

function normalizePreviewUrl(input: string) {
  const value = input.trim();
  if (!value) throw new Error('Enter a local app URL to preview.');
  const parsed = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `http://${value}`);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Use an HTTP or HTTPS URL.');
  }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) {
    throw new Error('Preview URLs must use localhost or a loopback address.');
  }
  return parsed.href;
}

export default function WebLivePreview() {
  const [url, setUrl] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [error, setError] = useState('');
  const [agentConnected, setAgentConnected] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [colors, setColors] = useState(DEFAULT_COLORS);
  const historyRef = useRef({ entries: [] as string[], index: -1 });
  const [history, setHistory] = useState(historyRef.current);

  const recordRoute = (nextUrl: string) => {
    const current = historyRef.current;
    if (current.entries[current.index] === nextUrl) return;

    const existingIndex = current.entries.lastIndexOf(nextUrl);
    const next = existingIndex >= 0
      ? { entries: current.entries, index: existingIndex }
      : {
          entries: [...current.entries.slice(0, current.index + 1), nextUrl],
          index: current.index + 1,
        };
    historyRef.current = next;
    setHistory(next);
  };

  useEffect(() => {
    let mounted = true;
    window.ideAPI.getActiveTheme().then(theme => {
      if (!mounted || !theme?.colors) return;
      const themeColors = theme.colors;
      setColors({
        background: themeColors['editor.background'] || themeColors['sideBar.background'] || DEFAULT_COLORS.background,
        panel: themeColors['sideBar.background'] || DEFAULT_COLORS.panel,
        foreground: themeColors['editor.foreground'] || themeColors['sideBar.foreground'] || DEFAULT_COLORS.foreground,
        muted: themeColors['sideBar.foreground'] || DEFAULT_COLORS.muted,
        border: themeColors['sideBar.border'] || DEFAULT_COLORS.border,
        accent: themeColors['editor.selectionBackground'] || DEFAULT_COLORS.accent,
        input: themeColors['editor.background'] || DEFAULT_COLORS.input,
      });
    }).catch(caught => console.error('[web-live-preview] could not load IDE theme:', caught));

    const unsubscribe = window.ideAPI.on('previewState', next => {
      if (!mounted) return;
      setAgentConnected(next.source === 'agent' && next.status !== 'closed');
      if (next.status === 'closed') {
        setCurrentUrl('');
        setUrl('');
        setStatus('idle');
        setError('');
        return;
      }
      if (next.status === 'error') {
        setStatus('error');
        setError(next.error || 'The preview could not be loaded.');
      }
      if (next.url) {
        try {
          const nextUrl = normalizePreviewUrl(next.url);
          setUrl(nextUrl);
          setCurrentUrl(nextUrl);
          setStatus('loading');
          recordRoute(nextUrl);
        } catch (caught) {
          setStatus('error');
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      }
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const style = useMemo(() => ({
    '--preview-bg': colors.background,
    '--preview-panel': colors.panel,
    '--preview-fg': colors.foreground,
    '--preview-muted': colors.muted,
    '--preview-border': colors.border,
    '--preview-accent': colors.accent,
    '--preview-input': colors.input,
  }) as React.CSSProperties, [colors]);

  const navigate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setStatus('loading');
    try {
      const normalizedUrl = normalizePreviewUrl(url);
      setUrl(normalizedUrl);
      setCurrentUrl(normalizedUrl);
      recordRoute(normalizedUrl);
    } catch (caught) {
      setStatus('error');
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const navigateHistory = async (index: number) => {
    const nextUrl = history.entries[index];
    if (!nextUrl) return;
    setError('');
    setStatus('loading');
    try {
      setCurrentUrl(nextUrl);
      historyRef.current = { ...historyRef.current, index };
      setHistory(historyRef.current);
      setUrl(nextUrl);
    } catch (caught) {
      setStatus('error');
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const goBack = () => navigateHistory(history.index - 1);
  const goForward = () => navigateHistory(history.index + 1);

  const reload = async () => {
    if (!currentUrl) return;
    setError('');
    setStatus('loading');
    setReloadKey(value => value + 1);
  };

  return (
    <main className="live-preview" style={style}>
      <form className="live-preview__toolbar" onSubmit={navigate}>
        <button
          type="button"
          onClick={goBack}
          disabled={history.index <= 0}
          aria-label="Go back"
          title="Go back"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m10 3-5 5 5 5" /></svg>
        </button>
        <button
          type="button"
          onClick={goForward}
          disabled={history.index < 0 || history.index >= history.entries.length - 1}
          aria-label="Go forward"
          title="Go forward"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
        </button>
        <div className={`live-preview__location ${agentConnected ? 'is-agent-connected' : ''}`}>
          <input
            aria-label="Local app URL"
            value={url}
            onChange={event => setUrl(event.target.value)}
            placeholder="http://localhost:5173"
            spellCheck={false}
          />
          {status === 'loading' && (
            <span className="live-preview__progress" role="progressbar" aria-label="Loading preview">
              <span />
            </span>
          )}
          {agentConnected && (
            <span className="live-preview__agent-status" role="status" aria-live="polite">
              CONNECTED TO AGENT
            </span>
          )}
        </div>
        <button type="button" onClick={reload} disabled={status === 'idle'} aria-label="Reload" title="Reload">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.45-3.54L13 6M13 3v3h-3" /></svg>
        </button>
      </form>
      {error && <p className="live-preview__error" role="alert">{error}</p>}
      {currentUrl ? (
        <iframe
          key={`${currentUrl}:${reloadKey}`}
          className="live-preview__frame"
          src={currentUrl}
          title={`Web preview of ${currentUrl}`}
          onLoad={() => {
            setStatus('ready');
            setError('');
          }}
          onError={() => {
            setStatus('error');
            setError('The preview could not be loaded.');
          }}
        />
      ) : !error && (
        <div className="live-preview__empty">
          <span>Enter a local app URL to preview it here.</span>
        </div>
      )}
    </main>
  );
}
