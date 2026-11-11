import { describe, expect, it } from "vitest";
import {
	TODO_STATE_HINT,
	TODO_STATE_MAX_LINES,
	appendToLastMessage,
	injectTodoState,
	renderTodoStateBlock,
	type Task,
} from "../todo.js";

function task(id: number, subject: string, rest: Partial<Task> = {}): Task {
	return { id, subject, status: "pending", ...rest };
}

type Msg = {
	role: string;
	content?: string | readonly { type: string; text?: string }[] | null;
	extra?: string;
};

describe("renderTodoStateBlock", () => {
	it("returns undefined when every task is finished", () => {
		expect(renderTodoStateBlock([])).toBeUndefined();
		expect(
			renderTodoStateBlock([
				task(1, "Done", { status: "completed" }),
				task(2, "Gone", { status: "deleted" }),
			]),
		).toBeUndefined();
	});

	it("lists in_progress before pending and skips completed/deleted", () => {
		const block = renderTodoStateBlock([
			task(1, "Write docs"),
			task(2, "Add retry", { status: "in_progress", activeForm: "adding retry" }),
			task(3, "Shipped", { status: "completed" }),
			task(4, "Dropped", { status: "deleted" }),
		]);

		expect(block).toContain("<todo_state>");
		expect(block).toContain("</todo_state>");
		// in_progress first
		expect(block?.indexOf("#2")).toBeLessThan(block!.indexOf("#1"));
		expect(block).toContain("[in_progress] #2 Add retry (adding retry)");
		expect(block).toContain("[pending] #1 Write docs");
		expect(block).not.toContain("#3");
		expect(block?.endsWith(TODO_STATE_HINT + "\n</todo_state>")).toBe(true);
	});

	it("omits activeForm when it just echoes the subject", () => {
		const echoed = renderTodoStateBlock([
			task(1, "Add retry", { status: "in_progress", activeForm: "  add RETRY " }),
		]);
		expect(echoed).toContain("[in_progress] #1 Add retry\n");

		const distinct = renderTodoStateBlock([
			task(2, "Write docs", { status: "in_progress", activeForm: "writing docs" }),
		]);
		expect(distinct).toContain("[in_progress] #2 Write docs (writing docs)");
	});

	it("renders blockedBy references", () => {		const block = renderTodoStateBlock([
			task(1, "Uploader", { status: "in_progress" }),
			task(2, "Ship it", { blockedBy: [1] }),
		]);
		expect(block).toContain("blocked by #1");
	});

	it("caps the rendered lines and reports the remainder", () => {
		const many = Array.from({ length: TODO_STATE_MAX_LINES + 5 }, (_, i) => task(i + 1, `Task ${i + 1}`));
		const block = renderTodoStateBlock(many);

		expect(block).toContain("… 5 more");
		expect(block?.match(/\[pending\]/g)).toHaveLength(TODO_STATE_MAX_LINES);
	});
});

describe("appendToLastMessage", () => {
	it("appends to a user message with string content", () => {
		const messages: Msg[] = [
			{ role: "user", content: "first" },
			{ role: "user", content: "hello", extra: "keep me" },
		];

		const result = appendToLastMessage(messages, "<todo_state>x</todo_state>");

		expect(result).toHaveLength(2);
		expect(result?.[1]).toMatchObject({ role: "user", extra: "keep me" });
		expect(result?.[1].content).toEqual([
			{ type: "text", text: "hello" },
			{ type: "text", text: "<todo_state>x</todo_state>" },
		]);
	});

	it("appends inside the tool result mid-run, leaving the message count alone", () => {
		const messages: Msg[] = [
			{ role: "system", content: "prompt" },
			{ role: "user", content: "do it" },
			{ role: "assistant", content: [] },
			{ role: "toolResult", content: [{ type: "text", text: "ok" }] },
		];

		const result = appendToLastMessage(messages, "STATE");

		expect(result).toHaveLength(messages.length);
		expect(result?.at(-1)?.role).toBe("toolResult");
		expect(result?.at(-1)?.content).toEqual([
			{ type: "text", text: "ok" },
			{ type: "text", text: "STATE" },
		]);
	});

	it("does not mutate the input messages", () => {
		const last: Msg = { role: "user", content: "hello" };
		const messages: Msg[] = [last];

		appendToLastMessage(messages, "STATE");

		expect(last.content).toBe("hello");
		expect(messages).toHaveLength(1);
	});

	it("returns undefined for empty transcripts, assistant tails, or empty text", () => {
		expect(appendToLastMessage([], "STATE")).toBeUndefined();
		expect(appendToLastMessage([{ role: "assistant", content: [] }], "STATE")).toBeUndefined();
		expect(appendToLastMessage([{ role: "user", content: "hi" }], "")).toBeUndefined();
	});

	it("handles an empty string body without leaving an empty block", () => {
		const result = appendToLastMessage([{ role: "user", content: "" }], "STATE");
		expect(result?.[0].content).toEqual([{ type: "text", text: "STATE" }]);
	});
});

describe("injectTodoState", () => {
	it("returns undefined when there is nothing active", () => {
		const messages: Msg[] = [{ role: "user", content: "hi" }];
		expect(injectTodoState(messages, [])).toBeUndefined();
		expect(injectTodoState(messages, [task(1, "Done", { status: "completed" })])).toBeUndefined();
	});

	it("attaches the block to the last message once", () => {
		const messages: Msg[] = [{ role: "user", content: "hi" }];
		const result = injectTodoState(messages, [task(1, "Add retry", { status: "in_progress" })]);

		expect(result).toHaveLength(1);
		const content = result?.[0].content as { type: string; text: string }[];		expect(content).toHaveLength(2);
		expect(content.filter((block) => block.text.includes("<todo_state>"))).toHaveLength(1);
	});
});
