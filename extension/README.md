# Agentic Builder — Chrome Extension Skeleton

This is the starting point for the conversational AI Chrome extension.

## How to load (unpacked)

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this `extension/` folder

## Current Status

- Basic UI shell (chat + diagram placeholder + action buttons)
- Manifest V3 ready
- Background service worker present
- Voice + GitHub + Vercel buttons are stubs (see open issues)

## Next Steps (linked to Issues)

1. Wire Grok API for the funnel (Issue #1)
2. Add React Flow (Issue #2)
3. Implement GitHub OAuth + commit (Issue #3)
4. Implement Vercel deploy (Issue #4)
5. Harden token storage (Issue #5)

## Recommended Upgrade Path

When ready for production React + React Flow:

```bash
npm create vite@latest . -- --template react
npm install @xyflow/react
```

Then migrate the popup into a proper React app and update the build output path in `manifest.json`.
