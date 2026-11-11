/**
 * pi-todos — Pi extension
 *
 * Registers the `todo` tool, `/todos` slash command, the `context` hook that
 * re-injects task state into every provider request, and the lifecycle hooks
 * that manage branch-replay state reconstruction and the TodoOverlay widget.
 *
 * Forked from juicesharp/rpiv-todo (originally part of rpiv-pi).
 * Tool name "todo" and slash command "/todos" are retained for compatibility;
 * the widget key is owned by this fork.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
    TOOL_NAME,
    injectTodoState,
    registerTodoTool,
    registerTodosCommand,
    reconstructTodoState,
} from "./todo.js";
import { TodoOverlay } from "./todo-overlay.js";

export default function (pi: ExtensionAPI) {
    // Todo overlay widget — constructed lazily at the first session_start with UI.
    let todoOverlay: TodoOverlay | undefined;

    registerTodoTool(pi);
    registerTodosCommand(pi);

    pi.on("session_start", async (_event, ctx) => {
        reconstructTodoState(ctx);
        if (ctx.hasUI) {
            todoOverlay ??= new TodoOverlay();
            todoOverlay.setUICtx(ctx.ui);
            todoOverlay.update();
        }
    });

    pi.on("session_compact", async (_event, ctx) => {
        reconstructTodoState(ctx);
        todoOverlay?.update();
    });

    pi.on("session_tree", async (_event, ctx) => {
        reconstructTodoState(ctx);
        todoOverlay?.update();
    });

    pi.on("session_shutdown", async () => {
        todoOverlay?.dispose();
        todoOverlay = undefined;
    });

    // Keeps the task list inside the model's context. Without this the list only
    // exists in the TUI overlay, so the model silently drifts out of sync across
    // turns. Runs before every provider request and appends to the last message
    // rather than adding one, so prefix caching survives (see todo.ts).
    pi.on("context", async (event) => {
        const messages = injectTodoState(event.messages) as typeof event.messages | undefined;
        if (!messages) return;
        return { messages: [...messages] };
    });

    // Reads getTodos() at render time; do NOT call reconstructTodoState here
    // (branch is stale — message_end runs after tool_execution_end).
    pi.on("tool_execution_end", async (event) => {
        if (event.toolName !== TOOL_NAME || event.isError) return;
        todoOverlay?.update();
    });
}
