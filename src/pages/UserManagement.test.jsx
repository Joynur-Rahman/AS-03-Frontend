/* eslint-disable no-undef */
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import UserManagement from "./Usermanagement";

// ─── Mock global fetch & alert ────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
  global.alert = jest.fn();
});

// ─── Sample data ──────────────────────────────────────────────────────────────
const mockUsers = [
  { id: "u1", firstName: "Alice", lastName: "Smith", email: "alice@bank.io", enabled: true  },
  { id: "u2", firstName: "Bob",   lastName: "Jones", email: "bob@bank.io",   enabled: true  },
  { id: "u3", firstName: "Carol", lastName: "White", email: "carol@bank.io", enabled: false },
  { id: "u4", firstName: "David", lastName: "Brown", email: "david@bank.io", enabled: true  },
  { id: "u5", firstName: "Eva",   lastName: "Green", email: "eva@bank.io",   enabled: true  },
  { id: "u6", firstName: "Frank", lastName: "Black", email: "frank@bank.io", enabled: false },
];

/** Resolve GET /admin/users with given user list */
function mockUsersLoad(users = mockUsers) {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data: users }),
  });
}

/** Render and wait until the loading spinner disappears */
async function renderUM(users = mockUsers) {
  mockUsersLoad(users);
  render(<UserManagement />);
  await waitFor(() =>
    expect(screen.queryByText(/Loading users/i)).not.toBeInTheDocument()
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. INITIAL LOAD
// ─────────────────────────────────────────────────────────────────────────────
describe("Initial load", () => {
  it("TC-01: shows loading spinner while fetch is pending", async () => {
    let resolve;
    global.fetch.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    render(<UserManagement />);
    expect(screen.getByText(/Loading users/i)).toBeInTheDocument();
    await resolve({ ok: true, json: async () => ({ data: [] }) });
  });

  it("TC-02: renders user table after users load", async () => {
    await renderUM();
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("alice@bank.io")).toBeInTheDocument();
  });

  it("TC-03: calls GET /admin/users on mount", async () => {
    await renderUM();
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost/admin/users",
      expect.objectContaining({ credentials: "include" })
    );
  });

  it("TC-04: shows alert when user load returns non-ok response", async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 500 });
    render(<UserManagement />);
    await waitFor(() =>
      expect(global.alert).toHaveBeenCalledWith(
        expect.stringMatching(/Failed to load users/i)
      )
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. USER TABLE RENDERING
// ─────────────────────────────────────────────────────────────────────────────
describe("User table rendering", () => {
  it("TC-05: renders table column headers — User, Status, Actions", async () => {
    await renderUM();
    expect(screen.getByText("User")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
  });

  it("TC-06: shows Active chip for enabled users", async () => {
    await renderUM();
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
  });

  it("TC-07: shows Inactive chip for disabled users", async () => {
    await renderUM();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("TC-08: renders avatar initials from user name (Alice Smith → AL)", async () => {
    await renderUM();
    expect(screen.getByText("AL")).toBeInTheDocument();
  });

  it("TC-09: shows 'U' avatar when user has no name", async () => {
    mockUsersLoad([{ id: "x1", firstName: "", email: "x@b.io", enabled: true }]);
    render(<UserManagement />);
    await waitFor(() => screen.getByText("U"));
    expect(screen.getByText("U")).toBeInTheDocument();
  });

  it("TC-10: renders Roles (🛡️) and Delete (🗑️) buttons per row", async () => {
    await renderUM();
    expect(screen.getAllByTitle("Roles").length).toBeGreaterThan(0);
    expect(screen.getAllByTitle("Delete").length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. SEARCH & FILTER
// ─────────────────────────────────────────────────────────────────────────────
describe("Search and filter", () => {
  it("TC-11: filters users by name", async () => {
    await renderUM();
    fireEvent.change(screen.getByPlaceholderText(/Search users/i), {
      target: { value: "alice" },
    });
    expect(screen.getByText("alice@bank.io")).toBeInTheDocument();
    expect(screen.queryByText("bob@bank.io")).not.toBeInTheDocument();
  });

  it("TC-12: filters users by email", async () => {
    await renderUM();
    fireEvent.change(screen.getByPlaceholderText(/Search users/i), {
      target: { value: "carol@bank.io" },
    });
    expect(screen.getByText("carol@bank.io")).toBeInTheDocument();
    expect(screen.queryByText("alice@bank.io")).not.toBeInTheDocument();
  });

  it("TC-13: filters users by status text", async () => {
    await renderUM();
    fireEvent.change(screen.getByPlaceholderText(/Search users/i), {
      target: { value: "inactive" },
    });
    expect(screen.getByText("carol@bank.io")).toBeInTheDocument();
    expect(screen.queryByText("alice@bank.io")).not.toBeInTheDocument();
  });

  it("TC-14: shows 'No users found' when no results match", async () => {
    await renderUM();
    fireEvent.change(screen.getByPlaceholderText(/Search users/i), {
      target: { value: "xyznotexist" },
    });
    expect(
      screen.getByText(/No users found matching your search/i)
    ).toBeInTheDocument();
  });

  it("TC-15: resets to page 1 when search query changes", async () => {
    await renderUM();
    fireEvent.click(screen.getByText("Next"));
    fireEvent.change(screen.getByPlaceholderText(/Search users/i), {
      target: { value: "alice" },
    });
    expect(screen.getByText(/Page/)).toHaveTextContent("1");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. PAGINATION
// ─────────────────────────────────────────────────────────────────────────────
describe("Pagination", () => {
  it("TC-16: shows only first 5 users on page 1 (PAGE_SIZE = 5)", async () => {
    await renderUM();
    expect(screen.getByText("alice@bank.io")).toBeInTheDocument();
    expect(screen.queryByText("frank@bank.io")).not.toBeInTheDocument();
  });

  it("TC-17: Next button navigates to page 2", async () => {
    await renderUM();
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("frank@bank.io")).toBeInTheDocument();
  });

  it("TC-18: Prev button navigates back to page 1", async () => {
    await renderUM();
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Prev"));
    expect(screen.getByText("alice@bank.io")).toBeInTheDocument();
  });

  it("TC-19: Prev button is disabled on first page", async () => {
    await renderUM();
    expect(screen.getByText("Prev")).toBeDisabled();
  });

  it("TC-20: Next button is disabled on last page", async () => {
    await renderUM();
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("Next")).toBeDisabled();
  });

  it("TC-21: shows correct page indicator text", async () => {
    await renderUM();
    expect(screen.getByText(/Page/)).toHaveTextContent("Page 1 of 2");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. ADD USER MODAL
// ─────────────────────────────────────────────────────────────────────────────
describe("Add User modal", () => {
  it("TC-22: opens Add New User modal on '+ Add User' click", async () => {
    await renderUM();
    fireEvent.click(screen.getByText("+ Add User"));
    expect(screen.getByText("Add New User")).toBeInTheDocument();
  });

  it("TC-23: closes modal on Cancel click", async () => {
    await renderUM();
    fireEvent.click(screen.getByText("+ Add User"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Add New User")).not.toBeInTheDocument();
  });

  it("TC-24: closes modal on overlay click", async () => {
    await renderUM();
    fireEvent.click(screen.getByText("+ Add User"));
    fireEvent.click(document.querySelector(".modal-overlay"));
    await waitFor(() =>
      expect(screen.queryByText("Add New User")).not.toBeInTheDocument()
    );
  });

  it("TC-25: shows 'Email is required' error when email is empty", async () => {
    await renderUM();
    fireEvent.click(screen.getByText("+ Add User"));
    fireEvent.click(screen.getByText("Create User"));
    expect(screen.getByText("Email is required.")).toBeInTheDocument();
  });

  it("TC-26: shows 'Invalid email address' error for bad format", async () => {
    await renderUM();
    fireEvent.click(screen.getByText("+ Add User"));
    fireEvent.change(screen.getByPlaceholderText("Email Address"), {
      target: { value: "not-an-email" },
    });
    fireEvent.click(screen.getByText("Create User"));
    expect(screen.getByText("Invalid email address.")).toBeInTheDocument();
  });

  it("TC-27: submits valid user and closes modal on success", async () => {
    await renderUM();
    fireEvent.click(screen.getByText("+ Add User"));
    fireEvent.change(screen.getByPlaceholderText("Email Address"), {
      target: { value: "newuser@bank.io" },
    });
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ([{ status: "created" }]) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: mockUsers }) });
    fireEvent.click(screen.getByText("Create User"));
    await waitFor(() =>
      expect(screen.queryByText("Add New User")).not.toBeInTheDocument()
    );
  });

  it("TC-28: calls POST /admin/bulk-users with correct payload", async () => {
    await renderUM();
    fireEvent.click(screen.getByText("+ Add User"));
    fireEvent.change(screen.getByPlaceholderText("Email Address"), {
      target: { value: "test@bank.io" },
    });
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ([{ status: "created" }]) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: mockUsers }) });
    fireEvent.click(screen.getByText("Create User"));
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost/admin/bulk-users",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("test@bank.io"),
        })
      )
    );
  });

  it("TC-29: shows error when API returns a failed entry", async () => {
    await renderUM();
    fireEvent.click(screen.getByText("+ Add User"));
    fireEvent.change(screen.getByPlaceholderText("Email Address"), {
      target: { value: "bad@bank.io" },
    });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([{ status: "failed", error: "User already exists" }]),
    });
    fireEvent.click(screen.getByText("Create User"));
    await screen.findByText(/User already exists/i);
  });

  it("TC-30: shows form error when API returns non-ok response", async () => {
    await renderUM();
    fireEvent.click(screen.getByText("+ Add User"));
    fireEvent.change(screen.getByPlaceholderText("Email Address"), {
      target: { value: "err@bank.io" },
    });
    global.fetch.mockResolvedValueOnce({
      ok: false, status: 500, text: async () => "Server Error",
    });
    fireEvent.click(screen.getByText("Create User"));
    await screen.findByText(/Add user failed/i);
  });

  it("TC-31: role dropdown defaults to 'User'", async () => {
    await renderUM();
    fireEvent.click(screen.getByText("+ Add User"));
    const modal = document.querySelector(".modal-card");
    expect(within(modal).getByRole("combobox").value).toBe("User");
  });

  it("TC-32: role dropdown contains Manager and User options", async () => {
    await renderUM();
    fireEvent.click(screen.getByText("+ Add User"));
    const modal = document.querySelector(".modal-card");
    const opts = Array.from(within(modal).getByRole("combobox").options).map(o => o.text);
    expect(opts).toContain("Manager");
    expect(opts).toContain("User");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. DELETE USER MODAL
// ─────────────────────────────────────────────────────────────────────────────
describe("Delete User modal", () => {
  it("TC-33: opens delete confirmation modal on 🗑️ click", async () => {
    await renderUM();
    fireEvent.click(screen.getAllByTitle("Delete")[0]);
    expect(
      screen.getByText(/Are you sure you want to permanently delete/i)
    ).toBeInTheDocument();
  });

  it("TC-34: shows the user's email in the confirmation message", async () => {
    await renderUM();
    fireEvent.click(screen.getAllByTitle("Delete")[0]);
    const modal = document.querySelector(".modal-card");
    expect(within(modal).getByText("alice@bank.io")).toBeInTheDocument();
  });

  it("TC-35: closes modal on Cancel click", async () => {
    await renderUM();
    fireEvent.click(screen.getAllByTitle("Delete")[0]);
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText(/permanently delete/i)).not.toBeInTheDocument();
  });

  it("TC-36: calls DELETE /admin/users/:id and closes modal on confirm", async () => {
    await renderUM();
    fireEvent.click(screen.getAllByTitle("Delete")[0]);
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: mockUsers.slice(1) }) });
    // Scope to modal footer — "Delete User" also appears in the modal <h3> header
    const footer36 = document.querySelector(".modal-card .um-modal-footer");
    fireEvent.click(within(footer36).getByText("Delete User"));
    await waitFor(() =>
      expect(screen.queryByText(/permanently delete/i)).not.toBeInTheDocument()
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost/admin/users/u1",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("TC-37: shows alert when delete API call fails", async () => {
    await renderUM();
    fireEvent.click(screen.getAllByTitle("Delete")[0]);
    global.fetch.mockResolvedValueOnce({
      ok: false, status: 500, text: async () => "Server Error",
    });
    // Scope to modal footer — "Delete User" also appears in the modal <h3> header
    const footer37 = document.querySelector(".modal-card .um-modal-footer");
    fireEvent.click(within(footer37).getByText("Delete User"));
    await waitFor(() =>
      expect(global.alert).toHaveBeenCalledWith(
        expect.stringMatching(/Delete failed/i)
      )
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. ROLE MANAGER MODAL
// ─────────────────────────────────────────────────────────────────────────────
describe("Role Manager modal", () => {
  /**
   * Open the roles modal for the first user (Alice).
   * Returns a helper to query ONLY the chips section (.um-section first child)
   * to avoid "multiple elements" errors — "Manager" appears in both the
   * role chip AND the dropdown <option>.
   */
  async function openRolesModal(roles = [{ name: "manager" }]) {
    await renderUM();
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: roles }),
    });
    fireEvent.click(screen.getAllByTitle("Roles")[0]);
    await screen.findByText("🛡️ Manage Roles");
  }

  /** Returns the chips container (first .um-section inside the modal) */
  function chipsSection() {
    return document.querySelectorAll(".modal-card .um-section")[0];
  }

  it("TC-38: opens Role Manager modal on 🛡️ click", async () => {
    await openRolesModal();
    expect(screen.getByText("🛡️ Manage Roles")).toBeInTheDocument();
  });

  it("TC-39: shows user name and email in the modal summary", async () => {
    await openRolesModal();
    const modal = document.querySelector(".modal-card");
    expect(within(modal).getByText("Alice Smith")).toBeInTheDocument();
    expect(within(modal).getByText("alice@bank.io")).toBeInTheDocument();
  });

  it("TC-40: displays currently assigned roles as chips", async () => {
    await openRolesModal([{ name: "manager" }]);
    // Wait for chips to render, then scope to chips section to avoid
    // matching the dropdown <option>Manager</option> as well
    await waitFor(() =>
      expect(within(chipsSection()).queryAllByText("Manager").length).toBeGreaterThan(0)
    );
    expect(within(chipsSection()).getAllByText("Manager").length).toBeGreaterThan(0);
  });

  it("TC-41: shows 'No roles assigned' when user has no roles", async () => {
    await openRolesModal([]);
    await screen.findByText(/No roles assigned/i);
  });

  it("TC-42: closes modal on Done button click", async () => {
    await openRolesModal();
    fireEvent.click(screen.getByText("Done"));
    expect(screen.queryByText("🛡️ Manage Roles")).not.toBeInTheDocument();
  });

  it("TC-43: closes modal on × button click", async () => {
    await openRolesModal();
    const modal = document.querySelector(".modal-card");
    fireEvent.click(within(modal).getByText("×"));
    expect(screen.queryByText("🛡️ Manage Roles")).not.toBeInTheDocument();
  });

  it("TC-44: calls POST /roles to assign a new role", async () => {
    await openRolesModal([{ name: "manager" }]);
    await waitFor(() =>
      expect(within(chipsSection()).queryAllByText("Manager").length).toBeGreaterThan(0)
    );
    const modal = document.querySelector(".modal-card");
    fireEvent.change(within(modal).getByRole("combobox"), {
      target: { value: "User" },
    });
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ name: "manager" }, { name: "user" }] }) });
    fireEvent.click(screen.getByText("+ Assign"));
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/roles?role_name=user"),
        expect.objectContaining({ method: "POST" })
      )
    );
  });

  it("TC-45: shows error when assigning an already-assigned role", async () => {
    await openRolesModal([{ name: "manager" }]);
    await waitFor(() =>
      expect(within(chipsSection()).queryAllByText("Manager").length).toBeGreaterThan(0)
    );
    // Dropdown defaults to Manager — try assigning it again
    fireEvent.click(screen.getByText("+ Assign"));
    await screen.findByText(/already listed/i);
  });

  it("TC-46: calls DELETE /roles to remove an existing role", async () => {
    await openRolesModal([{ name: "manager" }]);
    await waitFor(() =>
      expect(within(chipsSection()).queryAllByText("Manager").length).toBeGreaterThan(0)
    );
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });
    fireEvent.click(screen.getByTitle("Remove Manager role"));
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/roles?role_name=manager"),
        expect.objectContaining({ method: "DELETE" })
      )
    );
  });

  it("TC-47: calls PUT /roles to replace an existing role", async () => {
    await openRolesModal([{ name: "manager" }]);
    await waitFor(() =>
      expect(within(chipsSection()).queryAllByText("Manager").length).toBeGreaterThan(0)
    );
    const modal = document.querySelector(".modal-card");
    fireEvent.change(within(modal).getByRole("combobox"), {
      target: { value: "User" },
    });
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ name: "user" }] }) });
    fireEvent.click(screen.getByText("Manager → User"));
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("old_role=manager&new_role=user"),
        expect.objectContaining({ method: "PUT" })
      )
    );
  });

  it("TC-48: shows error when replacing with the same role", async () => {
    await openRolesModal([{ name: "manager" }]);
    await waitFor(() =>
      expect(within(chipsSection()).queryAllByText("Manager").length).toBeGreaterThan(0)
    );
    // Dropdown is already on Manager — click replace with same role
    fireEvent.click(screen.getByText("Manager → Manager"));
    await screen.findByText(/Pick a different role/i);
  });

  it("TC-49: shows error when roles fetch returns non-ok response", async () => {
    await renderUM();
    global.fetch.mockResolvedValueOnce({ ok: false, status: 500 });
    fireEvent.click(screen.getAllByTitle("Roles")[0]);
    await screen.findByText(/Could not load current roles/i);
  });

  it("TC-50: shows success flash message after assigning a role", async () => {
    await openRolesModal([{ name: "manager" }]);
    await waitFor(() =>
      expect(within(chipsSection()).queryAllByText("Manager").length).toBeGreaterThan(0)
    );
    const modal = document.querySelector(".modal-card");
    fireEvent.change(within(modal).getByRole("combobox"), {
      target: { value: "User" },
    });
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ name: "user" }] }) });
    fireEvent.click(screen.getByText("+ Assign"));
    await screen.findByText(/User assigned/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. CSV IMPORT
// ─────────────────────────────────────────────────────────────────────────────
describe("CSV Import", () => {
  it("TC-51: renders the Import CSV button", async () => {
    await renderUM();
    expect(screen.getByText(/Import CSV/i)).toBeInTheDocument();
  });

  it("TC-52: shows alert when CSV has no valid rows", async () => {
    await renderUM();
    const file = new File(["name,email,role\n"], "empty.csv", { type: "text/csv" });
    const input = document.querySelector("input[type='file']");
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    await waitFor(() =>
      expect(global.alert).toHaveBeenCalledWith(
        expect.stringMatching(/No valid users found/i)
      )
    );
  });

  it("TC-53: calls POST /admin/bulk-users with CSV data and shows success alert", async () => {
    await renderUM();
    const csv = "name,email,role\nTest User,testcsv@bank.io,user\n";
    const file = new File([csv], "users.csv", { type: "text/csv" });
    const input = document.querySelector("input[type='file']");
    Object.defineProperty(input, "files", { value: [file] });
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ([{ status: "created" }]) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: mockUsers }) });
    fireEvent.change(input);
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost/admin/bulk-users",
        expect.objectContaining({ method: "POST" })
      )
    );
    await waitFor(() =>
      expect(global.alert).toHaveBeenCalledWith(
        expect.stringMatching(/Import complete/i)
      )
    );
  });

  it("TC-54: shows alert when CSV import API fails", async () => {
    await renderUM();
    const csv = "name,email,role\nTest,fail@bank.io,user\n";
    const file = new File([csv], "users.csv", { type: "text/csv" });
    const input = document.querySelector("input[type='file']");
    Object.defineProperty(input, "files", { value: [file] });
    global.fetch.mockResolvedValueOnce({
      ok: false, status: 500, text: async () => "Server Error",
    });
    fireEvent.change(input);
    await waitFor(() =>
      expect(global.alert).toHaveBeenCalledWith(
        expect.stringMatching(/Import failed/i)
      )
    );
  });
});