# Sina Patente

A personal web app for studying the Italian Patente B theory exam, with English and Persian (فارسی) translations. It works offline once loaded and installs on the iPhone home screen.

**Open it:** https://sinaseyedi96-121.github.io/Sina-Patente/ — in Safari tap Share → Add to Home Screen.

## What's inside

- **Practice**: mock exam (30 questions, 20 minutes, max 3 mistakes), Quick 20, Mistakes, Saved, and practice by chapter. Tap anywhere on a question to see it in English and Persian. Move to the previous or next question at any time, answered or not. Each question links straight to its theory.
- **Pick up where you left off**: close the app in the middle of a practice or an exam and it reopens on the same question. The exam clock pauses while the app is closed. Other pages (a chapter, a theory topic) reopen too.
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
- `data/tr/fa/ch01.json` … `ch25.json`: Persian for every question (`{ "q": { "id": "متن فارسی" } }`).
- Pictures for a theory topic are taken automatically from the questions linked to it. Topics without pictures can also have illustrations drawn for the app in `images/th/<theory id>.jpg` (more than one: `<id>-2.jpg`), listed in `data/theory_images.json`. All of chapter 1 has them.

## Updating the app

When you change `app.js`, `style.css`, `index.html` or the data files, bump `VERSION` in `sw.js` (for example `sina-patente-v3`) so the phone downloads the new version. Edited translation files show up on the second launch after pushing, even without a version bump.

## Sources

Questions, images and Italian theory come from [avalla/quiz-patente-ab](https://github.com/avalla/quiz-patente-ab) (MIT licence), checked against [Ed0ardo/QuizPatenteB](https://github.com/Ed0ardo/QuizPatenteB) and [Privitorta/QuizPatenteA-B](https://github.com/Privitorta/QuizPatenteA-B). These are community copies of the official Ministry pool, not official files. English and Persian translations were written by Claude, and the theory illustrations were generated with OpenAI's image model. Before the real exam, also practise on the Ministry's own simulator.

