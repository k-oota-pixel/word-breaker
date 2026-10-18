# WORD BREAKER

Independent GitHub Pages game for the Monstudy learning projects.

- Live site: https://k-oota-pixel.github.io/word-breaker/
- Main learning portal: https://k-oota-pixel.github.io/english-playroom/
- Release: ver.1.3

The app is a static site and needs no build step. Its Firebase connection uses the existing `eiken-retry` project and continues to save coins and course records under `users/{uid}/apps/english-playroom`, so records remain visible in the main portal dashboard. Authentication is shared on `k-oota-pixel.github.io`.

## Vocabulary

`monstudy_vocab_master.json` includes the six courses (2,475 course entries). The game normalizes Japanese input and accepts a registered answer or keyword without using an external dictionary or AI service.

## Play and records

- Two lives, one score per word, 17 seconds per answer, endless shuffled course play.
- Each course keeps its own best score and combo. Signed-in runs also award shared coins.
- Previous question answers remain visible, and the current word's model answer appears after either a correct answer or a timeout.
- World records are served by the existing `task-quest.onrender.com` API.

## Development

Run `npm test` for unit tests. Run `npm run test:browser` for browser tests (Playwright required). GitHub Actions runs the word-breaker browser regression workflow. The Pages workflow publishes the repository root from `main`.

Browser tests use mocks and do not verify production Firebase rules or sign-in. Firebase Authentication must allow the GitHub Pages host.
