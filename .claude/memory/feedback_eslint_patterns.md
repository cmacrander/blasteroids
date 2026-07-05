---
name: feedback-eslint-patterns
description: ESLint rules that commonly bite in this project — know them before writing code
metadata:
  node_type: memory
  type: feedback
  originSessionId: f88828d1-2a9d-4a73-b292-dee41f56f720
---

Anticipate these rules while writing code, not after.

**`@typescript-eslint/no-confusing-void-expression`**
Arrow function shorthand that returns a void expression is forbidden. Always use braces.

- Wrong: `() => cancelAnimationFrame(id)`
- Wrong: `() => console.log("x")`
- Right: `() => { cancelAnimationFrame(id); }`
- Right: `() => { console.log("x"); }`

**`@typescript-eslint/no-floating-promises`**
Promises must be awaited or explicitly voided.

- Wrong: `signInWithGoogle()`
- Right: `void signInWithGoogle()`
- Right: `await signInWithGoogle()`

**`@typescript-eslint/no-empty-function`**
Empty function bodies are forbidden, even as placeholders.

- Wrong: `() => {}`
- Wrong: `() => { /* TODO */ }`
- Right: `() => { console.log("placeholder"); }`

**`@typescript-eslint/restrict-template-expressions`**
Numbers (and other non-strings) cannot appear in template literals.

- Wrong: `` `port ${port}` ``
- Right: `` `port ${String(port)}` ``

**`@typescript-eslint/dot-notation`**
Use dot notation when the key is a known identifier.

- Wrong: `import.meta.env["VITE_FOO"]`
- Right: `import.meta.env.VITE_FOO`

**Why:** These rules fire repeatedly in this codebase. Writing code that already respects them avoids wasted fix-and-re-lint turns.

**How to apply:** Before writing any arrow function, template literal, or promise call, mentally check against this list.
