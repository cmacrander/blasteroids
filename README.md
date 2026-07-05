# Starting a session

Setting up the sandbox terminal:

```
sudo apt install vim
export EDITOR=vim
```

Claude should recognize SessionStart and SessionEnd hooks in `.claude/settings.json` that sync memories.

Publish ports through the sandbox:

```
sbx ports claude-blasteroids --publish 3000:3000
```

Kill all processes with `npm run kill` or start fresh, with tunable constants updated, with `npm run restart`.

To view server logs if claude has already started it

```
tail -f /tmp/dev.log
```

## Dev loop health check

If the dev loop misbehaves (e.g. a blank page or a 500 from matchmaking), run:

```
npm run doctor
```

It reports whether the Colyseus server (`:2567/health`) and Vite client (`:3000`)
are up, and if either is down it clears any stale `npm run dev` processes so a
fresh `npm run dev` starts clean.

## Known noise: vite config "Could not resolve" error

On startup Vite may log:

```
failed to load config from .../client/vite.config.ts
error: Could not resolve ".../client/vite.config.ts"
```

This is noise, not a real failure. In this sandbox, esbuild's bundler cannot stat
files on the `/Users` workspace mount (plain `transform` works, but `bundle` —
which Vite uses to load its config — does not; the same file bundles fine under
`/tmp`). Despite the log, the dev server still starts, serves the app, and the
game renders correctly. Ignore it.
