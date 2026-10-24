import { describe, expect, it } from "vitest";
import { applyTaskMutation, detectCycle, type Task } from "../todo.js";

type State = { tasks: Task[]; nextId: number };
const emptyState = (): State => ({ tasks: [], nextId: 1 });

function apply(
  state: State,
  action: Parameters<typeof applyTaskMutation>[1],
  params: Parameters<typeof applyTaskMutation>[2],
): State {
  const result = applyTaskMutation(state, action, params);
  expect(result.details.error).toBeUndefined();
  return result.state;
}

describe("todo reducer", () => {
  it("creates tasks with monotonically increasing ids", () => {
    let state = emptyState();
    state = apply(state, "create", { subject: "First task" });
    state = apply(state, "create", { subject: "Second task" });

    expect(state.tasks.map((task) => task.id)).toEqual([1, 2]);
    expect(state.nextId).toBe(3);
    expect(state.tasks[0].status).toBe("pending");
  });

  it("rejects an empty subject", () => {
    const result = applyTaskMutation(emptyState(), "create", { subject: "  " });

    expect(result.state).toEqual(emptyState());
    expect(result.details.error).toBe("subject required for create");
  });

  it("enforces legal status transitions", () => {
    let state = apply(emptyState(), "create", { subject: "Implement feature" });
    state = apply(state, "update", { id: 1, status: "in_progress" });
    state = apply(state, "update", { id: 1, status: "completed" });

    const result = applyTaskMutation(state, "update", {
      id: 1,
      status: "in_progress",
    });
    expect(result.state).toEqual(state);
    expect(result.details.error).toBe("illegal transition completed → in_progress");
  });

  it("allows only one task to be in progress", () => {
    let state = apply(emptyState(), "create", { subject: "First task" });
    state = apply(state, "create", { subject: "Second task" });
    state = apply(state, "update", { id: 1, status: "in_progress" });

    const result = applyTaskMutation(state, "update", {
      id: 2,
      status: "in_progress",
    });

    expect(result.state).toEqual(state);
    expect(result.details.error).toBe(
      "only one task can be in_progress at a time: #1 First task is currently in_progress",
    );
  });

  it("permits moving the current task back to pending", () => {
    let state = apply(emptyState(), "create", { subject: "First task" });
    state = apply(state, "update", { id: 1, status: "in_progress" });

    state = apply(state, "update", { id: 1, status: "pending" });
    expect(state.tasks[0].status).toBe("pending");
  });

  it("rejects missing and deleted dependencies", () => {
    const missing = applyTaskMutation(emptyState(), "create", {
      subject: "Blocked task",
      blockedBy: [99],
    });
    expect(missing.details.error).toBe("blockedBy: #99 not found");

    let state = apply(emptyState(), "create", { subject: "Dependency" });
    state = apply(state, "delete", { id: 1 });
    const deleted = applyTaskMutation(state, "create", {
      subject: "Blocked task",
      blockedBy: [1],
    });
    expect(deleted.details.error).toBe("blockedBy: #1 is deleted");
  });

  it("rejects self-dependencies and dependency cycles", () => {
    let state = apply(emptyState(), "create", { subject: "A" });
    state = apply(state, "create", { subject: "B", blockedBy: [1] });

    const self = applyTaskMutation(state, "update", {
      id: 1,
      addBlockedBy: [1],
    });
    expect(self.details.error).toBe("cannot block #1 on itself");

    const cycle = applyTaskMutation(state, "update", {
      id: 1,
      addBlockedBy: [2],
    });
    expect(cycle.details.error).toBe(
      "addBlockedBy would create a cycle in the blockedBy graph",
    );
    expect(detectCycle(state.tasks, 1, [2])).toBe(true);
  });

  it("merges and removes metadata and dependencies", () => {
    let state = apply(emptyState(), "create", {
      subject: "Task",
      metadata: { area: "api", keep: true },
    });
    state = apply(state, "create", { subject: "Dependency" });
    state = apply(state, "update", {
      id: 1,
      addBlockedBy: [2],
      metadata: { area: "ui", keep: null, priority: "high" },
    });
    expect(state.tasks[0].blockedBy).toEqual([2]);
    expect(state.tasks[0].metadata).toEqual({ area: "ui", priority: "high" });

    state = apply(state, "update", { id: 1, removeBlockedBy: [2] });
    expect(state.tasks[0].blockedBy).toBeUndefined();
  });

  it("lists and gets dependency information", () => {
    let state = apply(emptyState(), "create", { subject: "Dependency" });
    state = apply(state, "create", { subject: "Blocked", blockedBy: [1] });

    const list = applyTaskMutation(state, "list", {});
    expect(list.content[0].text).toContain("[pending] #2 Blocked ⛓ #1");

    const get = applyTaskMutation(state, "get", { id: 1 });
    expect(get.content[0].text).toContain("blocks: #2");
  });

  it("deletes as a tombstone and clear resets state", () => {
    let state = apply(emptyState(), "create", { subject: "Task" });
    state = apply(state, "delete", { id: 1 });
    expect(state.tasks[0].status).toBe("deleted");

    state = apply(state, "clear", {});
    expect(state).toEqual(emptyState());
  });
});
