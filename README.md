# AI Act Explorer

Interactive tool for exploring the EU AI Act using AI explanations.

## What changed

The app now runs as a small web app with:

- a browser frontend in `index.html`, `app.js`, and `styles.css`
- a local Node server in `server.js`
- OpenAI requests routed through the backend instead of the browser

## Features

- Upload `.md` or `.txt` legal documents
- Click sections to get explanations
- Follow-up Q&A per section
- Chat history stored per section
- Responsive 3-column layout

## Run it

1. Set `OPENAI_API_KEY` in your environment
2. Start the app with:

```bash
npm start
```

3. Open the URL printed in the terminal, usually `http://127.0.0.1:3000`

You can also set `PORT` if you want a different port, and `OPENAI_MODEL` if you want to override the default model. If the preferred port is busy, the server now tries the next few ports and prints the exact one it picked.

On Windows, you can also double-click `launch.cmd` or run:

```powershell
.\launch.ps1
```

That launcher picks a free port, waits for `/healthz`, and opens the browser automatically.

## Notes

- The browser no longer needs an API key field.
- The app still uses `marked` from a CDN for Markdown rendering.
- `GET /healthz` returns a simple JSON health check.
