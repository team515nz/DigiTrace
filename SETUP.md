# DigiTrace - Local Development Setup

## ⚠️ Important: CORS Restrictions with file:// Protocol

The DigiTrace app has CORS restrictions when opened directly as a `file://` URL. To run the app properly, you need to use a **local web server**.

## Quick Start Options

### Option 1: Python (Easiest)

```bash
cd /Users/eransakal/dev/DigiTrace-main
python3 -m http.server 8000
```

Then open: `http://localhost:8000`

### Option 2: Node.js / npm

If you have Node.js installed:

```bash
cd /Users/eransakal/dev/DigiTrace-main
npm install -g http-server
http-server
```

### Option 3: Live Server (VS Code Extension)

1. Install the "Live Server" extension in VS Code
2. Right-click on `index.html` → "Open with Live Server"

## Troubleshooting

### Still Getting CORS Errors?
- Make sure you're accessing via `http://localhost:PORT` (not `file://`)
- Refresh the page (Cmd+Shift+R to clear cache)
- Check the browser console for detailed error messages

### "Cannot read properties of undefined" Error?
- Wait a moment for all scripts to load
- Check that all required files are present in the directory:
  - `scene.js`, `models.js`, `loaders.js`, `ui.js`, etc.
  - All CSS files

### Firebase Analytics Warning?
- This is expected when running locally with `file://` protocol
- It does not affect app functionality

## Features

- Upload 3D models (OBJ, STL, GLB, GLTF)
- Align models with multiple reference points  
- Analyze stratigraphic layers with clipping controls
- Export aligned models in various formats

## Help

Press the **?** button in the top-right corner for in-app help documentation.
