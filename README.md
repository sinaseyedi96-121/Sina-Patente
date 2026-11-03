# Sina Patente

A personal web app for studying the Italian Patente B theory exam, with English and Persian (فارسی) translations. It works offline once loaded and installs on the iPhone home screen.

**Open it:** https://sinaseyedi96-121.github.io/Sina-Patente/ — in Safari tap Share → Add to Home Screen.

## What's inside

- **Practice**: mock exam (30 questions, 20 minutes, max 3 mistakes), Quick 20, Mistakes, Saved, and practice by chapter. Tap anywhere on a question to see it in English. Each question links straight to its theory.
- **Theory**: 458 topics in Italian, English and Persian, with the related signs and pictures, plus search in all three languages. Each topic has a "Practice questions on this topic" button.
- **Progress**: stats, day streak, mock-exam history, chapter mastery, settings (auto-show English, theory language) and backup/restore.

## Files

- `data/questions.json`, `data/theory.json`: the Italian question pool and theory.
- `data/tr/ch01.json` … `ch25.json`: translations, one file per chapter:
  ```json
  {
    "q": { "94374": "The sign shown indicates a bus stop" },
    "t": { "402": { "en": ["Lay-by", "English text…"], "fa": ["عنوان", "متن فارسی…"] } }
  }
  ```
  `q` maps a question id to its English text; `t` maps a theory id to `[title, text]` in English and Persian. Separate paragraphs with a blank line.
- Pictures for a theory topic are taken automatically from the questions linked to it.

## Updating the app

When you change `app.js`, `style.css`, `index.html` or the data files, bump `VERSION` in `sw.js` (for example `sina-patente-v3`) so the phone downloads the new version. Edited translation files show up on the second launch after pushing, even without a version bump.

## Sources

Questions, images and Italian theory come from [avalla/quiz-patente-ab](https://github.com/avalla/quiz-patente-ab) (MIT licence), checked against [Ed0ardo/QuizPatenteB](https://github.com/Ed0ardo/QuizPatenteB) and [Privitorta/QuizPatenteA-B](https://github.com/Privitorta/QuizPatenteA-B). These are community copies of the official Ministry pool, not official files. English and Persian translations were written by Claude. Before the real exam, also practise on the Ministry's own simulator.
