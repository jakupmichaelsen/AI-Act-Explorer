# AI Act Explorer

Interactive tool for exploring the EU AI Act using AI explanations.

Live demo: https://ai-act-explorer.vercel.app/

## What changed

The app now runs as a small web app with:

- a browser frontend in `index.html`, `app.js`, and `styles.css`
- a local Node server in `server.js`
- Vercel-ready serverless routes in `api/`
- OpenAI requests routed through the backend instead of the browser
- an optional AI Act loader that tries the official EUR-Lex publication page
- a browser-stored OpenAI API key field for users who want to use their own key

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

## Deploy on Vercel

1. Import the GitHub repo into Vercel.
2. Deploy without a custom build step.

Vercel will serve `index.html` from the repo root and run the API routes in `api/`.
If you do not set `OPENAI_API_KEY` in Vercel, each user can enter their own key in the browser.

## AI Act Loader

- The app includes a `Load AI Act` button.
- On startup it also tries to load the official AI Act automatically.
- It prefers the checked-in `ai-act-official.md` snapshot first, then falls back to the live EUR-Lex source.
- If the official source is unavailable from the runtime environment, the app shows a message with the official EUR-Lex link and you can still upload a file manually.

## Notes

- The browser key field is stored in `localStorage` in that browser only.
- The app still uses `marked` from a CDN for Markdown rendering.
- `GET /healthz` returns a simple JSON health check.
