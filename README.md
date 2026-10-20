# WORD BREAKER

Independent GitHub Pages game for the Monstudy learning projects.

- Live site: https://k-oota-pixel.github.io/word-breaker/
- Main learning portal: https://k-oota-pixel.github.io/english-playroom/
- Release: ver.1.6

The app is a static site and needs no build step. Its Firebase connection uses the existing `eiken-retry` project and continues to save coins and course records under `users/{uid}/apps/english-playroom`, so records remain visible in the main portal dashboard. Authentication is shared on `k-oota-pixel.github.io`.

## Vocabulary

`monstudy_vocab_master.json` includes the six courses (2,477 course entries). The game normalizes Japanese input and accepts a registered answer or keyword without using an external dictionary or AI service.

Version 1.5 reviews all six courses and adds everyday paraphrases and spellings in
`word-breaker-aliases.js`, keyed by English word. `cleanEntries` merges these into
keywords consistently in every course and the practice fixture. Model answers
remain unchanged. `colorful` was absent from the master and is now included in
junior2 and basic; it accepts カラフル, 色鮮やかな and 色とりどりの.
Other examples include give → あげる／くれる, receive → もらう,
father → お父さん, sleep → 寝る and repair → 直す.

Aliases are explicit, not shared globally by Japanese meaning. There is no
substring, edit-distance or automatic synonym expansion. Tests cover every alias
in every applicable course, negated/unrelated extensions of all registered
meanings, and confusable pairs such as give/receive, lend/borrow and useful/useless.
Negative definitions such as useless → 役立たない remain valid.
Versioned module and master-data URLs refresh the vocabulary on release.

## Version 1.6

When the last life is lost, the result screen keeps the final word, all model
answers, and the last submitted answer (or 未回答) visible until the learner
chooses to retry or change course. This review is also available on mobile and
in the demo. Manually ending a later run does not show a stale review.

## Play and records

- Two lives, one score per word, 17 seconds per answer, endless shuffled course play.
- Each course keeps its own best score and combo. Signed-in runs also award shared coins.
- Previous question answers remain visible, and the current word's model answer appears after either a correct answer or a timeout.
- World records are served by the existing `task-quest.onrender.com` API.

## Development

Run `npm test` for unit tests. Run `npm run test:browser` for browser tests (Playwright required). GitHub Actions runs the word-breaker browser regression workflow. The Pages workflow publishes the repository root from `main`.

Browser tests use mocks and do not verify production Firebase rules or sign-in. Firebase Authentication must allow the GitHub Pages host.
