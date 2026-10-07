# Web Live Preview

An installable Codetist extension for previewing local development servers in an
inline Chromium view. It uses Codetist's sandboxed `window.ideAPI.preview` API
for navigation, loading state, and screenshots.

## Use

1. Keep this development source in `~/web-live-preview`. In the Codetist
   Plugins view, install **Web Live Preview** locally. The IDE copies it to
   `~/.codetist/.extensions/web-live-preview`, independent of the open
   workspace.
2. Start a development server for your app.
3. The extension opens after installation; later, open it from the Installed
   section of the Plugins view.
4. Enter a loopback URL such as `http://localhost:5173` and press Enter.
5. Use the reload button, or capture a screenshot to share the preview with the
   Codetist AI agent.

Only localhost/loopback URLs are allowed by the preview API.

The AI agent has built-in `browser_preview` actions for open, navigate, reload,
screenshot, and close. For AI-controlled preview, install the extension and
keep its webview open. Agent activity is shown in the extension as `AGENT LIVE`.

## Publish

Publish this folder's contents as the `web-live-preview` repository in the
Codetist extensions registry. The manifest webview entry is `webview/index.tsx`.
