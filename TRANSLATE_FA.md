# Persian translations for the questions

Persian question translations live in `data/tr/fa/`, one file per chapter (`ch01.json` … `ch25.json`):

```json
{ "q": { "97739": "وسایل و تجهیزاتی که با برق کار می‌کنند ..." } }
```

The app loads whatever files exist; a chapter without a file shows "not ready yet" under the English.
`ch24.json` is done. To add the rest with Claude Code, open this repo and ask:

> For each chapter from 1 to 25 that has no file in `data/tr/fa/`, translate every question of that
> chapter (from `data/questions.json`, rows where the 2nd field is the chapter number) into Persian.
> Translate from the Italian (6th field) and use the English in `data/tr/chNN.json` only as a check.
> Keep the exact meaning, including false statements: never correct or soften a statement, because the
> answer depends on it. Keep words like sempre, mai, solo, esclusivamente as همیشه, هرگز, فقط, منحصراً.
> Write `data/tr/fa/chNN.json` in the format above with every question id of the chapter,
> then verify the ids match, and commit one chapter at a time.
