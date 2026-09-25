// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@solidjs/testing-library";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ChecklistView from "../../src/components/ChecklistView";
import { __resetTasksCache, setCachedTasks, type TaskRow } from "../../src/lib/tasks-store";

/**
 * Re-ordering the checklist within a lead-time bucket, through
 * `@shared/sortable`: focus stays on the moved task's grip, the move is
 * announced in that bucket, and a failed save withdraws the announcement.
 */

const authFetch = vi.fn();
vi.mock("@shared/rp-auth/solid", () => ({ useAuth: () => ({ authFetch }) }));

const row = (over: Partial<TaskRow>): TaskRow => ({
  id: "tsk_1",
  weddingId: "wed_1",
  title: "Book venue",
  notes: null,
  timeframeBucket: "12m",
  dueAt: null,
  status: "open",
  sortOrder: 0,
  createdAt: 1,
  completedAt: null,
  ...over,
});

const TASKS = [
  row({ id: "a", title: "Book venue", timeframeBucket: "12m", sortOrder: 0 }),
  row({ id: "b", title: "Draft guest list", timeframeBucket: "12m", sortOrder: 1 }),
  row({ id: "c", title: "Send save-the-dates", timeframeBucket: "6m", sortOrder: 0 }),
  row({ id: "d", title: "Book the band", timeframeBucket: "6m", sortOrder: 1 }),
  row({ id: "e", title: "Order the cake", timeframeBucket: "6m", sortOrder: 2 }),
];

function section(heading: string) {
  return within(screen.getByRole("heading", { name: heading }).closest("section")!);
}

function order(bucket: string): string[] {
  const list = screen.getByTestId(`tasks-${bucket}`);
  return [...list.querySelectorAll(":scope > li")].map(
    (li) => li.querySelector("input[type=checkbox]")?.getAttribute("aria-label") ?? "",
  );
}

function grip(title: string): HTMLButtonElement {
  return screen.getByRole("button", {
    name: new RegExp(`^Reorder ${title},`),
  }) as HTMLButtonElement;
}

beforeEach(() => {
  __resetTasksCache();
  authFetch.mockReset();
  setCachedTasks("wed_1", TASKS);
});

afterEach(() => {
  cleanup();
});

describe("checklist — reorder", () => {
  it("moves a task by keyboard, keeps focus on it and announces it in its own bucket", async () => {
    authFetch.mockResolvedValue(new Response("{}", { status: 200 }));
    render(() => <ChecklistView weddingId="wed_1" canEdit={true} />);
    await screen.findByText("Order the cake");

    grip("Send save-the-dates").focus();
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });

    expect(order("6m")).toEqual(["Book the band", "Order the cake", "Send save-the-dates"]);
    expect(document.activeElement).toBe(grip("Send save-the-dates"));
    expect(section("6 months out").getByRole("status")).toHaveTextContent(
      "Send save-the-dates moved to position 3 of 3.",
    );
    // The other bucket heard nothing.
    expect(section("12+ months out").getByRole("status")).toHaveTextContent("");
    expect(order("12m")).toEqual(["Book venue", "Draft guest list"]);

    await waitFor(() => expect(authFetch).toHaveBeenCalledTimes(2));
    expect(JSON.parse(authFetch.mock.calls[1]![1].body)).toEqual({
      timeframeBucket: "6m",
      orderedIds: ["d", "e", "c"],
    });
  });

  it("moves a task with the screen-reader buttons", async () => {
    authFetch.mockResolvedValue(new Response("{}", { status: 200 }));
    render(() => <ChecklistView weddingId="wed_1" canEdit={true} />);
    await screen.findByText("Order the cake");

    fireEvent.click(screen.getByRole("button", { name: "Move Order the cake up" }));

    expect(order("6m")).toEqual(["Send save-the-dates", "Order the cake", "Book the band"]);
    expect(section("6 months out").getByRole("status")).toHaveTextContent(
      "Order the cake moved to position 2 of 3.",
    );
  });

  it("keeps a ticked task's row as it was when a neighbour moves", async () => {
    authFetch.mockResolvedValue(new Response("{}", { status: 200 }));
    render(() => <ChecklistView weddingId="wed_1" canEdit={true} />);
    await screen.findByText("Order the cake");

    const untouched = screen.getByRole("checkbox", { name: "Book venue" });
    fireEvent.keyDown(grip("Book the band"), { key: "ArrowUp" });

    // A move in one bucket does not rebuild another bucket's rows.
    expect(screen.getByRole("checkbox", { name: "Book venue" })).toBe(untouched);
  });

  it("withdraws the announcement when the save fails and the old order comes back", async () => {
    authFetch.mockResolvedValueOnce(new Response("fail", { status: 500 })).mockResolvedValueOnce(
      new Response(JSON.stringify({ tasks: TASKS }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    render(() => <ChecklistView weddingId="wed_1" canEdit={true} />);
    await screen.findByText("Order the cake");

    fireEvent.keyDown(grip("Send save-the-dates"), { key: "ArrowDown" });

    expect(await screen.findByRole("alert")).toHaveTextContent(/Couldn't save the new order/);
    await waitFor(() =>
      expect(order("6m")).toEqual(["Send save-the-dates", "Book the band", "Order the cake"]),
    );
    expect(section("6 months out").getByRole("status")).toHaveTextContent("");
  });

  it("offers a viewer no reorder controls", async () => {
    render(() => <ChecklistView weddingId="wed_1" canEdit={false} />);
    await screen.findByText("Order the cake");
    expect(screen.queryByRole("button", { name: /^Reorder / })).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
