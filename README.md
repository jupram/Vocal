# Vocal

Vocal is a web app for practicing leadership communication out loud. It lets you pick a workplace scenario, record a spoken response, transcribe it with an open-source ASR model in the browser, edit the transcript, and then analyze how strong the message sounds in a leadership context.

## What It Does

- Presents leadership communication scenarios such as missed deadlines, hard feedback, and strategy changes.
- Records the user's spoken answer in the browser.
- Transcribes speech with Whisper Tiny via `@huggingface/transformers`.
- Lets the user edit the transcript before analysis to correct ASR mistakes.
- Scores the response for executive presence, clarity, ownership, and empathy.
- Suggests stronger phrase replacements and produces a rewritten leadership-style version.

## Product Flow

1. Choose a scenario.
2. Record a response.
3. Review and edit the transcript.
4. Click `Analyze` to open the feedback page.
5. Use `Try again` to return to practice and record another version.

## Tech Stack

- React 19
- TypeScript
- Vite
- `@huggingface/transformers`
- In-browser Whisper Tiny speech recognition

## Local Development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Run linting:

```bash
npm run lint
```

On this Windows setup, PowerShell may block `npm.ps1`. If that happens, use:

```powershell
npm.cmd run dev
```

## Notes

- The first transcription run is slower because the Whisper model and WASM runtime are downloaded into the browser cache.
- The transcript is intentionally editable before analysis because speech recognition errors can distort the coaching output.
- The app currently runs fully client-side and does not require a backend.

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).
