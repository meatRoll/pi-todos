# Changelog

## v1.0.0

First stable release. The tool, slash command, and overlay are unchanged in
behaviour; the headline change is that the task list now reaches the model.

### Added

- **Status re-injection.** A `<todo_state>` block is appended to the last
  message before every provider request, so the model can no longer drift out of
  sync with the list across a long conversation. Only `pending` / `in_progress`
  tasks are listed (max 10 lines), and the block disappears once everything is
  done. Nothing is persisted; `todo` state is still reconstructed from the
  transcript.
- A system-prompt guideline declaring that `<todo_state>` blocks are environment
  state, not user input.
- `tests/todo-state.test.ts` covering the renderer, the append helper, and the
  injection entry point.

### Why the block is appended and not injected as a system section

`sections` patches reach the wire as system messages. For providers without
`supportsMidConvoSystemMessages` — the default, including `openai-completions` —
pi collapses those into the leading prompt, so the prompt head changes and prefix
caching dies from token 0. Measured on `deepseek-v4.1-flash` with a ~9.7k context
over 5 turns:

| Injection point | Prefix cache hit |
| --- | --- |
| system prompt `sections` patch | 0–6.6% |
| appended custom message | 98.3–99.5% |
| appended to the last message (shipped) | 97.2–99.5% |

Appending to the last message instead of adding one also keeps the message count
identical: on a user turn the block rides inside that user message, mid-run it
rides inside the tool result, which models read as environment output rather
than user speech.

### Changed

- Version scheme moves to major-version releases (1.0.0).
- `README.md` documents the injection and the measurement above.
