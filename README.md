# Web Live Preview

An installable Codetist extension for previewing local development servers in
an iframe embedded directly in the extension.

## Use

1. Keep this development source in `~/web-live-preview`. In the Codetist
   Plugins view, install **Web Live Preview** locally. The IDE copies it to
   `~/.codetist/.extensions/web-live-preview`, independent of the open
   workspace.
2. Start a development server for your app.
3. The extension opens after installation; later, open it from the Installed
   section of the Plugins view.
4. Enter a loopback URL such as `http://localhost:5173` and press Enter. The
   app loads inside the extension; it does not open a separate Chromium view.
5. Use the back, forward, and reload controls to navigate the entered URLs.

Only localhost and loopback URLs are allowed.

The extension reflects preview URLs and agent activity sent through Codetist's
`previewState` event.

## Publish

Publish this folder's contents as the `web-live-preview` repository in the
Codetist extensions registry. The manifest webview entry is `webview/index.tsx`.
