# Patente B quiz

A personal web app for studying the Italian Patente B theory exam. Works offline once loaded and can be added to an iPhone home screen.

## Put it online

1. Push the contents of this folder to a GitHub repo (the folder contents go at the repo root).
2. In the repo, open Settings, then Pages, and set the source to the `main` branch, root folder.
3. Open the Pages link in Safari on your iPhone, tap Share, then Add to Home Screen.

## Adding translations

Translations live in `data/tr/`, one file per chapter: `ch01.json` to `ch25.json`. Drop a new file in and push; the app picks it up on its next launch, with no other changes needed. Format:

```json
{
  "q": { "94374": "The sign shown indicates a bus stop" },
  "t": { "402": { "en": ["Lay-by", "English text..."], "fa": ["عنوان", "متن فارسی..."] } }
}
```

`q` maps a question id to its English text. `t` maps a theory id to `[title, text]` in English and Persian. Separate paragraphs in the text with a blank line.

## Updating the app

When you change `app.js`, `style.css`, `index.html` or the data files, bump `VERSION` in `sw.js` (for example `patente-v2`) so the phone downloads the new version. Translation files don't need a version bump.

## Sources

Questions, images and theory come from [avalla/quiz-patente-ab](https://github.com/avalla/quiz-patente-ab) (MIT licence), checked against [Ed0ardo/QuizPatenteB](https://github.com/Ed0ardo/QuizPatenteB) and [Privitorta/QuizPatenteA-B](https://github.com/Privitorta/QuizPatenteA-B). These are community copies of the official Ministry pool, not official files. Before the real exam, also practise on the Ministry's own simulator.
