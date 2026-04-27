# Repository Guidelines

## Project Structure & Module Organization
This repository is a small browser-only tool. The main app lives in [`index.html`](index.html), which contains the UI, styling, and JavaScript in one file. [`README.md`](README.md) provides a short user-facing overview. There are no build outputs, source subfolders, or test directories yet.

## Build, Test, and Development Commands
There is no build system in this repo. Open [`index.html`](index.html) directly in a browser to run the app. For quick validation, refresh the page after edits and test the main flow:
- load a `.md` or `.txt` file
- click a section to request an explanation
- send a follow-up question in the chat box

## Coding Style & Naming Conventions
Use plain JavaScript, HTML, and CSS with the existing style of the file:
- 2-space indentation
- `camelCase` for variables and functions, e.g. `afsnitCache`, `sendFollowup`
- keep Danish UI labels consistent with the current interface
- prefer short, direct helper functions over large abstractions

## Testing Guidelines
There is no automated test suite yet. Verify changes manually in the browser, especially:
- file upload and section parsing
- section selection and scrolling
- OpenAI request handling and error states
- follow-up chat behavior

If you add tests later, document how to run them in this file and keep test names descriptive, such as `renderChat` or `parseSections`.

## Commit & Pull Request Guidelines
No Git history is available in this checkout, so there is no repository-specific commit pattern to mirror. Use clear imperative commit messages such as `Fix section parsing` or `Improve chat error handling`. Pull requests should explain what changed, why it changed, and include screenshots or short screen recordings for UI updates when relevant.

## Security & Configuration Tips
The OpenAI API key is entered client-side and sent from the browser. Do not commit real keys or hardcode secrets in the HTML. Keep any future configuration explicit and local to the user’s environment.
