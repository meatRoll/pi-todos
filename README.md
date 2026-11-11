# pi-todos

Pi extension that registers the `todo` tool, `/todos` slash command, and a
persistent TodoOverlay widget above the editor. Replaces Claude Code's
TaskCreate/TaskUpdate tool family.

> This project is a fork of [`juicesharp/rpiv-todo`](https://github.com/juicesharp/rpiv-todo),
> originally extracted from the [`rpiv-pi`](https://github.com/juicesharp/rpiv-pi)
> ecosystem. It has been renamed to `pi-todos` and is maintained independently.

![Todo overlay widget above the Pi editor](https://raw.githubusercontent.com/meatRoll/pi-todos/main/docs/overlay.jpg)

## Installation

    pi install npm:pi-todos

Then restart your Pi session.

## Tool

- **`todo`** — create / update / list / get / delete / clear tasks. 4-state
  machine (pending → in_progress → completed, plus deleted tombstone).
  Only one task may be `in_progress` at a time. Supports `blockedBy` dependency
  tracking with cycle detection. Tasks persist via branch replay — survive
  session compact and `/reload`.

- **`/todos`** — print the current todo list grouped by status.

## Status re-injection

The task list is re-injected into the model's context before every provider
request, as a `<todo_state>` block appended to the **last** message:

```
<todo_state>
[in_progress] #1 Add retry to uploader (adding retry)
[pending] #2 Update docs
If a step above is already finished, call `todo` update before you claim it is done.
</todo_state>
```

Without this the list only lives in the TUI overlay, so the model silently
drifts out of sync over a long conversation. Only `pending` / `in_progress`
tasks are listed (capped at 10 lines), so the block disappears once everything
is done.

Why it is implemented this way (measured against `deepseek-v4.1-flash`, ~9.7k
context, 5 turns):

| Injection point | Prefix cache hit |
|---|---|
| system prompt `sections` patch | **0–6.6%** |
| appended custom message | 98.3–99.5% |
| appended to last message (this) | 97.2–99.5% |

`sections` patches reach the wire as system messages. Providers without
`supportsMidConvoSystemMessages` — the default, including `openai-completions`
— collapse those into the leading prompt, so the prompt head changes and prefix
caching dies from token 0. Appending to the tail only changes the tail.

Appending to the last message rather than adding a new one also keeps the
message count identical (no fabricated user turn): on a user turn the block
rides inside that user message, mid-run it rides inside the tool result, which
models read as environment output rather than user speech. Everything is
request-scoped: nothing is persisted, and `todo` state is still reconstructed
from the transcript.

## Commands

- **`/todos`** — print the current todo list grouped by status.

## Overlay

The aboveEditor widget auto-renders whenever any non-deleted tasks exist.
12-line collapse threshold; completed tasks drop first on overflow, pending
tasks truncate last. Auto-hides when the list is empty.

## Development

```sh
npm ci
npm run typecheck
npm test
```

`.github/workflows/checks.yml` runs the same two commands on every push to
`main` and on pull requests, on Linux / macOS / Windows.

## Releasing

Releases are cut from a tag, never from a branch. Bump `package.json`, add a
matching `## vX.Y.Z` section to `CHANGELOG.md`, then:

```sh
git commit -am "release: vX.Y.Z"
git tag -a vX.Y.Z -m "vX.Y.Z"
git push --follow-tags
```

`.github/workflows/release.yml` then re-runs the checks, verifies the tag matches
`package.json`, packs the installable tarball, and creates the GitHub release
with notes taken from the `CHANGELOG.md` section — so the release cannot drift
from the changelog. Add an `NPM_TOKEN` repository secret to also publish to npm.

## License

MIT
