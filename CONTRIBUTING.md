# Working on indexboard

No `.env` file and no keys are needed. The app calls the hosted Supabase functions (their address is in the code), so you can run everything on your own machine.

```bash
cd app/frontend
npm ci
npm run dev        # http://localhost:5173, talks to the live backend
```

Before you push:

```bash
npx tsc --noEmit -p tsconfig.app.json   # types
npx eslint --quiet ./src                # lint
npx vite build                          # the same build CI runs
```

How to send a change (the repo has no branch protection, so this is a team rule):

1. `git switch -c my-change` and push the branch, never `main`.
2. Open a pull request. The `ci-cd` check must be green (it type-checks, lints and builds).
3. The owner merges. A merge to `main` publishes the build to https://bryan273.github.io/repro-suite/indexboard/ by itself.

Never commit keys, tokens or passwords. If you need one for an experiment, keep it in your shell, not in a file in the repo.
