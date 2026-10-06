import React, { useEffect, useMemo, useState } from 'react';
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
  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [error, setError] = useState('');
  const [screenshot, setScreenshot] = useState('');
  const [colors, setColors] = useState(DEFAULT_COLORS);
  const [agentLive, setAgentLive] = useState(false);

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
      setAgentLive(next.source === 'agent');
      setStatus(next.status === 'closed' ? 'idle' : next.status);
      if (next.url) setUrl(next.url);
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
      await window.ideAPI.preview.open(url);
      setAgentLive(false);
    } catch (caught) {
      setStatus('error');
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const reload = async () => {
    setError('');
    setStatus('loading');
    try {
      await window.ideAPI.preview.reload();
    } catch (caught) {
      setStatus('error');
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const captureScreenshot = async () => {
    setError('');
    try {
      setScreenshot(await window.ideAPI.preview.captureScreenshot());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const closePreview = async () => {
    setError('');
    try {
      await window.ideAPI.preview.close();
      setStatus('idle');
      setAgentLive(false);
      setScreenshot('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  return (
    <main className={`live-preview ${agentLive ? 'agent-live' : ''}`} style={style}>
      <header className="live-preview__header">
        <div className="live-preview__brand">
          <span className="live-preview__mark">◉</span>
          <div>
            <strong>Web Live Preview</strong>
            <small>Local Chromium runtime</small>
          </div>
        </div>
        <span className={`live-preview__agent ${agentLive ? 'is-live' : ''}`}>
          <span />
          {agentLive ? 'AGENT LIVE' : 'READY'}
        </span>
      </header>

      <form className="live-preview__toolbar" onSubmit={navigate}>
        <span className={`live-preview__status ${status}`} title={error || status} />
        <input
          aria-label="Local app URL"
          value={url}
          onChange={event => setUrl(event.target.value)}
          placeholder="http://localhost:5173"
          spellCheck={false}
        />
        <button type="submit" title="Open URL">Go</button>
        <button type="button" onClick={reload} disabled={status === 'idle'} title="Reload">↻</button>
        <button type="button" onClick={captureScreenshot} disabled={status !== 'ready'} title="Capture screenshot">▣</button>
        <button type="button" onClick={closePreview} disabled={status === 'idle'} title="Close preview">×</button>
      </form>

      <section className="live-preview__empty">
        <div className="live-preview__card">
          <span className={`live-preview__large-status ${status}`} />
          <h1>{status === 'ready' ? 'Preview is running' : status === 'loading' ? 'Loading your app' : 'Preview a local app'}</h1>
          <p>{status === 'ready'
            ? 'Your app is open in the inline Chromium pane beside this extension.'
            : status === 'loading'
              ? 'Waiting for Chromium to finish loading.'
              : 'Start a development server and enter its localhost URL above.'}</p>
          {status === 'loading' && <div className="live-preview__progress"><span /></div>}
          {error && <p className="live-preview__error" role="alert">{error}</p>}
          {screenshot && (
            <div className="live-preview__screenshot">
              <img src={screenshot} alt="Captured preview" />
              <button type="button" onClick={() => setScreenshot('')}>Dismiss screenshot</button>
              <small>Screenshot is ready for the AI agent.</small>
            </div>
          )}
        </div>
      </section>

      <footer className="live-preview__footer">
        <span>Sandboxed Chromium</span>
        <span>localhost · 127.0.0.1 · ::1</span>
      </footer>
    </main>
  );
}
