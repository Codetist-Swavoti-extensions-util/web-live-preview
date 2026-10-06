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
      preview: {
        open(url: string): Promise<unknown>;
        navigate(url: string): Promise<unknown>;
        reload(): Promise<unknown>;
        close(): Promise<unknown>;
        captureScreenshot(): Promise<string>;
        inlineUrl(url: string): Promise<string>;
      };
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

export default function WebLivePreview() {
  const [url, setUrl] = useState('');
  const [inlineUrl, setInlineUrl] = useState('');
  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [error, setError] = useState('');
  const [agentConnected, setAgentConnected] = useState(false);
  const [colors, setColors] = useState(DEFAULT_COLORS);
  const historyRef = useRef({ entries: [] as string[], index: -1 });
  const [history, setHistory] = useState(historyRef.current);
  const [frameKey, setFrameKey] = useState(0);

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
      setStatus(next.status === 'closed' ? 'idle' : next.status);
      if (next.url) {
        setUrl(next.url);
        recordRoute(next.url);
      }
      setError(next.error || '');
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
      const nextUrl = await window.ideAPI.preview.inlineUrl(url);
      setInlineUrl(nextUrl);
      recordRoute(nextUrl);
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
      const validatedUrl = await window.ideAPI.preview.inlineUrl(nextUrl);
      setInlineUrl(validatedUrl);
      historyRef.current = { ...historyRef.current, index };
      setHistory(historyRef.current);
      setUrl(validatedUrl);
    } catch (caught) {
      setStatus('error');
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const goBack = () => navigateHistory(history.index - 1);
  const goForward = () => navigateHistory(history.index + 1);

  const reload = async () => {
    setError('');
    if (inlineUrl) {
      setStatus('loading');
      setFrameKey(previous => previous + 1);
      return;
    }
    setStatus('loading');
    try {
      await window.ideAPI.preview.reload();
    } catch (caught) {
      setStatus('error');
      setError(caught instanceof Error ? caught.message : String(caught));
    }
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
      {inlineUrl && (
        <iframe
          key={frameKey}
          className="live-preview__frame"
          src={inlineUrl}
          title="Local app preview"
          sandbox="allow-scripts allow-forms allow-popups allow-modals"
          onLoad={() => setStatus('ready')}
        />
      )}
    </main>
  );
}
