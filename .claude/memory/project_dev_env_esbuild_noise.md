---
name: project_dev_env_esbuild_noise
description: "The vite.config \"Could not resolve\" error at dev startup is benign sandbox noise, not a real failure"
metadata: 
  node_type: memory
  type: project
  originSessionId: 38a7f6f0-10fe-4efb-9157-f70728d3996f
---

At `npm run dev` startup, Vite logs `failed to load config from .../client/vite.config.ts` / `Could not resolve ".../client/vite.config.ts"`. This is NOT a real failure — the dev server still starts, serves, and the game renders in the browser.

Root cause: in this sandbox, esbuild's bundler cannot stat files on the `/Users` workspace mount (plain `transform` works; `bundle` — which Vite uses to load its config — fails; the same file bundles fine under `/tmp`).

**Why:** I burned time investigating this as if it blocked rendering; it does not.
**How to apply:** Ignore this specific error. Don't rabbit-hole. It's documented in README.md under "Known noise". If the app genuinely isn't serving, use `npm run doctor` (see [[project_runtime_verification]]) instead of chasing the esbuild log.
