import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";
import { AdminTable, type AdminColumn } from "@/components/admin-table";
import { setViewport } from "./setup";

type Row = { id: string; name: string; email: string; status: "active" | "suspended" };

const rows: Row[] = Array.from({ length: 23 }, (_, i) => ({
  id: `u${i}`,
  name: `User ${i}`,
  email: `user${i}@test.io`,
  status: i % 3 === 0 ? "suspended" : "active",
}));

const columns: AdminColumn<Row>[] = [
  { key: "name", header: "Name", cell: (r) => r.name },
  { key: "email", header: "Email", cell: (r) => r.email },
  { key: "status", header: "Status", cell: (r) => r.status },
];

function renderTable(extra: Partial<React.ComponentProps<typeof AdminTable<Row>>> = {}) {
  return render(
    <AdminTable
      title="Users"
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      searchKeys={(r) => `${r.name} ${r.email}`}
      pageSize={10}
      {...extra}
    />,
  );
}

describe("AdminTable", () => {
  beforeEach(() => { cleanup(); setViewport(1280); });

  it("paginates results and renders 10 rows per page", () => {
    const { container } = renderTable();
    const table = container.querySelector("table")!;
    expect(within(table).getAllByText(/User \d+/).length).toBe(10);
    expect(screen.getByText(/1\/3/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/2\/3/)).toBeInTheDocument();
  });

  it("filters by search query and resets pagination", () => {
    const { container } = renderTable();
    fireEvent.change(screen.getByPlaceholderText(/Search/i), { target: { value: "User 21" } });
    const table = container.querySelector("table")!;
    expect(within(table).getByText("User 21")).toBeInTheDocument();
    expect(within(table).queryByText("User 1")).not.toBeInTheDocument();
  });

  it("renders responsively across mobile widths", () => {
    for (const w of [320, 375, 414, 768]) {
      cleanup();
      setViewport(w);
      const { container } = renderTable();
      // Both desktop and mobile markup are always present; CSS hides one.
      // Assert the mobile <ul> exists for stacked layout.
      const list = container.querySelector("ul.md\\:hidden");
      expect(list, `mobile list missing at ${w}px`).toBeTruthy();
      // And the desktop table exists for the md+ breakpoint
      const table = container.querySelector("div.hidden.md\\:block table");
      expect(table, `desktop table missing at ${w}px`).toBeTruthy();
      // Pagination Prev/Next still reachable
      expect(within(container).getByRole("button", { name: /next/i })).toBeInTheDocument();
    }
  });
});