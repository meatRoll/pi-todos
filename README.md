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
  Supports `blockedBy` dependency tracking with cycle detection. Tasks persist
  via branch replay — survive session compact and `/reload`.

## Commands

- **`/todos`** — print the current todo list grouped by status.

## Overlay

The aboveEditor widget auto-renders whenever any non-deleted tasks exist.
12-line collapse threshold; completed tasks drop first on overflow, pending
tasks truncate last. Auto-hides when the list is empty.

## License

MIT
