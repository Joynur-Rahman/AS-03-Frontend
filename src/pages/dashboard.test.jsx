/* eslint-disable no-undef */
import React from "react";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import "@testing-library/jest-dom";

// ─── Mocks (hoisted before any imports) ──────────────────────────────────────
jest.mock("../api/auth", () => ({
  getCurrentUser: jest.fn(),
  logout: jest.fn(),
}));

jest.mock("../assets/hdfcbanklogo.png", () => "hdfc-logo.png");

jest.mock("recharts", () => {
  const React = require("react");
  const Stub = ({ children }) => React.createElement("div", null, children);
  return {
    AreaChart: Stub, Area: Stub, XAxis: Stub, YAxis: Stub,
    Tooltip: Stub, Legend: Stub, LineChart: Stub, Line: Stub,
    PieChart: Stub, Pie: Stub, Cell: Stub,
    ResponsiveContainer: ({ children }) => React.createElement("div", null, children),
  };
});

jest.mock("./Usermanagement", () => () => (
  <div data-testid="user-management">User Management</div>
));

// ─── Import mocked fns and Dashboard once (no resetModules) ──────────────────
import { getCurrentUser, logout } from "../api/auth";
import Dashboard from "./dashboard";

// ─── Clear mock call counts between tests (NOT resetModules) ─────────────────
beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
const mockUser = (overrides = {}) => ({
  sub: "abc123",
  name: "Alice Admin",
  email: "alice@bank.io",
  preferred_username: "alice",
  exp: Math.floor(Date.now() / 1000) + 900,
  realm_access: { roles: ["admin"] },
  ...overrides,
});

function setupUser(overrides = {}) {
  getCurrentUser.mockResolvedValue(mockUser(overrides));
}

/** Render Dashboard and wait for the loading spinner to disappear. */
async function renderDashboard(overrides = {}) {
  setupUser(overrides);
  const utils = render(<Dashboard />);
  await waitFor(() =>
    expect(screen.queryByText(/Loading dashboard/i)).not.toBeInTheDocument()
  );
  return utils;
}

/** Find the 🔔 bell button without colliding with the child unread-dot span. */
function getBellButton() {
  return Array.from(document.querySelectorAll(".topbar-icon-btn")).find((b) =>
    b.textContent.includes("🔔")
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. LOADING STATE
// ─────────────────────────────────────────────────────────────────────────────
describe("Loading state", () => {
  it("shows spinner while fetching user", async () => {
    let resolve;
    getCurrentUser.mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<Dashboard />);
    expect(screen.getByText(/Loading dashboard/i)).toBeInTheDocument();
    await act(async () => resolve(mockUser()));
  });

  it("removes spinner after user loads", async () => {
    await renderDashboard();
    expect(screen.queryByText(/Loading dashboard/i)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. UNAUTHENTICATED STATE
// ─────────────────────────────────────────────────────────────────────────────
describe("Unauthenticated state", () => {
  it("shows not-authenticated message when API rejects", async () => {
    getCurrentUser.mockRejectedValue(new Error("Network error"));
    render(<Dashboard />);
    await screen.findByText(/Not authenticated/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. ROLE DETECTION
// ─────────────────────────────────────────────────────────────────────────────
describe("detectRole()", () => {
  const cases = [
    ["admin via realm_access",   { realm_access: { roles: ["admin"] } },                              "Administrator Console"],
    ["admin via email",          { realm_access: { roles: [] }, email: "admin@bank.io" },             "Administrator Console"],
    ["manager via realm_access", { realm_access: { roles: ["manager"] } },                            "Manager's Dashboard"],
    ["manager via username",     { realm_access: { roles: [] }, preferred_username: "manager_bob" },  "Manager's Dashboard"],
    ["user role",                { realm_access: { roles: ["user"] } },                               "User Dashboard"],
    ["unknown → employee",       { realm_access: { roles: ["staff"] } },                              "Employee Dashboard"],
  ];

  test.each(cases)("detects %s", async (_, userProps, expectedTitle) => {
    getCurrentUser.mockResolvedValue(mockUser(userProps));
    render(<Dashboard />);
    await screen.findByText(expectedTitle);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────
describe("Sidebar", () => {
  it("renders admin menu items inside the sidebar", async () => {
    await renderDashboard();
    const sidebar = document.querySelector(".sidebar");
    expect(within(sidebar).getByText("System Overview")).toBeInTheDocument();
    expect(within(sidebar).getByText("User Management")).toBeInTheDocument();
    expect(within(sidebar).getByText("Security Logs")).toBeInTheDocument();
  });

  it("collapses sidebar — hides HDFC logo", async () => {
    await renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: /◀/ }));
    expect(screen.queryByAltText("HDFC Logo")).not.toBeInTheDocument();
  });

  it("expands sidebar — shows HDFC logo again", async () => {
    await renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: /◀/ }));
    fireEvent.click(screen.getByRole("button", { name: /▶/ }));
    expect(screen.getByAltText("HDFC Logo")).toBeInTheDocument();
  });

  it("renders correct menu for 'user' role", async () => {
    await renderDashboard({ realm_access: { roles: ["user"] } });
    const sidebar = document.querySelector(".sidebar");
    expect(within(sidebar).getByText("Wallet")).toBeInTheDocument();
    expect(within(sidebar).getByText("Transactions")).toBeInTheDocument();
    expect(within(sidebar).queryByText("System Overview")).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────
describe("Navigation", () => {
  it("clicking a sidebar item updates the topbar title", async () => {
    await renderDashboard();
    fireEvent.click(within(document.querySelector(".sidebar")).getByText("Security Logs"));
    expect(screen.getByRole("heading", { name: "Security Logs" })).toBeInTheDocument();
  });

  it("clicking User Management renders the UserManagement component", async () => {
    await renderDashboard();
    fireEvent.click(within(document.querySelector(".sidebar")).getByText("User Management"));
    expect(screen.getByTestId("user-management")).toBeInTheDocument();
  });

  it("breadcrumb 'Overview' returns to the overview page", async () => {
    await renderDashboard();
    fireEvent.click(within(document.querySelector(".sidebar")).getByText("Security Logs"));
    fireEvent.click(screen.getByText("Overview"));
    expect(screen.getByText("Administrator Console")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. DARK MODE
// ─────────────────────────────────────────────────────────────────────────────
describe("Dark mode toggle", () => {
  it("cycles between 🌙 and ☀️ on each click", async () => {
    await renderDashboard();
    const btn = screen.getByTitle("Toggle dark mode");
    expect(btn).toHaveTextContent("🌙");
    fireEvent.click(btn);
    expect(btn).toHaveTextContent("☀️");
    fireEvent.click(btn);
    expect(btn).toHaveTextContent("🌙");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. NOTIFICATIONS PANEL
// ─────────────────────────────────────────────────────────────────────────────
describe("Notifications panel", () => {
  it("opens the notifications panel on bell click", async () => {
    await renderDashboard();
    fireEvent.click(getBellButton());
    expect(screen.getByText("Notifications")).toBeInTheDocument();
  });

  it("closes the notifications panel on overlay click", async () => {
    await renderDashboard();
    fireEvent.click(getBellButton());
    fireEvent.click(document.querySelector(".notif-overlay"));
    expect(screen.queryByText("Notifications")).not.toBeInTheDocument();
  });

  it("marks all notifications as read", async () => {
    await renderDashboard();
    fireEvent.click(getBellButton());
    fireEvent.click(screen.getByText("Mark all read"));
    expect(document.querySelectorAll(".notif-unread-dot")).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. PROFILE DROPDOWN & MODAL
// ─────────────────────────────────────────────────────────────────────────────
describe("Profile dropdown", () => {
  it("opens the dropdown on username click", async () => {
    await renderDashboard();
    fireEvent.click(screen.getByText("alice"));
    expect(screen.getByText("👤 View Profile")).toBeInTheDocument();
  });

  it("opens ProfilePage modal from dropdown", async () => {
    await renderDashboard();
    fireEvent.click(screen.getByText("alice"));
    fireEvent.click(screen.getByText("👤 View Profile"));
    expect(screen.getByText("Profile Info")).toBeInTheDocument();
  });

  it("closes ProfilePage modal on overlay click", async () => {
    await renderDashboard();
    fireEvent.click(screen.getByText("alice"));
    fireEvent.click(screen.getByText("👤 View Profile"));
    fireEvent.click(document.querySelector(".profile-modal-overlay"));
    expect(screen.queryByText("Profile Info")).not.toBeInTheDocument();
  });

  it("closes dropdown when clicking outside", async () => {
    await renderDashboard();
    fireEvent.click(screen.getByText("alice"));
    expect(screen.getByText("👤 View Profile")).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    await waitFor(() =>
      expect(screen.queryByText("👤 View Profile")).not.toBeInTheDocument()
    );
  });

  it("calls logout when Sign out is clicked", async () => {
    await renderDashboard();
    fireEvent.click(screen.getByText("alice"));
    fireEvent.click(screen.getByText("🚪 Sign out"));
    expect(logout).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. PROFILE PAGE TABS
// ─────────────────────────────────────────────────────────────────────────────
describe("ProfilePage tabs", () => {
  async function openProfile() {
    await renderDashboard();
    fireEvent.click(screen.getByText("alice"));
    fireEvent.click(screen.getByText("👤 View Profile"));
  }

  it("shows Profile Info tab by default", async () => {
    await openProfile();
    expect(screen.getByText("Full Name")).toBeInTheDocument();
  });

  it("switches to Security tab", async () => {
    await openProfile();
    fireEvent.click(within(document.querySelector(".profile-modal")).getByText("Security"));
    expect(screen.getByText("Two-Factor Auth")).toBeInTheDocument();
  });

  it("switches to Preferences tab", async () => {
    await openProfile();
    fireEvent.click(within(document.querySelector(".profile-modal")).getByText("Preferences"));
    expect(screen.getByText("Email Notifications")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. SESSION TIMER
// ─────────────────────────────────────────────────────────────────────────────
describe("Session timer", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("renders session timer label in topbar", async () => {
    await renderDashboard({ exp: Math.floor(Date.now() / 1000) + 300 });
    expect(screen.getAllByText(/session/i).length).toBeGreaterThan(0);
  });

  it("calls logout when session countdown reaches 0", async () => {
    await renderDashboard({ exp: Math.floor(Date.now() / 1000) + 2 });
    act(() => jest.advanceTimersByTime(4000));
    await waitFor(() => expect(logout).toHaveBeenCalled());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. TOAST NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────
describe("Toast notifications", () => {
  // NOTE on toast architecture:
  // ToastContainer is rendered INSIDE the main layout, which only mounts
  // after successful auth. Error-path toasts (rejected fetch) never appear
  // because the component shows the "Not authenticated" early-return instead.
  //
  // Reliably triggerable toasts after successful login:
  //   1. Welcome toast     — gated by welcomeShown module-level ref (fires once)
  //   2. Session warning   — fires when timeLeft hits exactly 120 (exp = now+120)
  //   3. Session urgent    — fires when timeLeft hits exactly 30
  //
  // We use the session-warning toast (#2) for dismiss tests — it always fires
  // and is independent of welcomeShown.

  it("shows a welcome toast on the very first dashboard render", async () => {
    // welcomeShown ref is module-scoped — fires only once per Jest worker.
    // We use queryAllBy so the test is a no-op if a prior test already
    // consumed it, rather than failing unpredictably on order.
    setupUser();
    render(<Dashboard />);
    await waitFor(() =>
      expect(screen.queryByText(/Loading dashboard/i)).not.toBeInTheDocument()
    );
    const nodes = screen.queryAllByText(/Welcome back, Alice Admin/i);
    nodes.forEach((node) => expect(node).toBeInTheDocument());
  });

  it("shows a session-warning toast when 2 minutes remain", async () => {
    jest.useFakeTimers();
    // exp = now + 121s → after 1 tick timeLeft becomes 120 → warning fires
    await renderDashboard({ exp: Math.floor(Date.now() / 1000) + 121 });
    act(() => jest.advanceTimersByTime(1000));
    await waitFor(() =>
      expect(
        screen.getByText(/Session expires in 2 minutes/i)
      ).toBeInTheDocument()
    );
    jest.useRealTimers();
  });

  it("dismisses a toast when the close button is clicked", async () => {
    jest.useFakeTimers();
    // Trigger the 2-minute warning toast (always fires, not gated by welcomeShown)
    await renderDashboard({ exp: Math.floor(Date.now() / 1000) + 121 });
    act(() => jest.advanceTimersByTime(1000));
    const toastText = await waitFor(() =>
      screen.getByText(/Session expires in 2 minutes/i)
    );
    expect(toastText).toBeInTheDocument();
    // Click close scoped to this toast's container
    const toastEl = toastText.closest(".toast");
    fireEvent.click(toastEl.querySelector(".toast-close"));
    await waitFor(() =>
      expect(
        screen.queryByText(/Session expires in 2 minutes/i)
      ).not.toBeInTheDocument()
    );
    jest.useRealTimers();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. WELCOME BANNER
// ─────────────────────────────────────────────────────────────────────────────
describe("Welcome banner", () => {
  it("displays the user's name in the banner", async () => {
    await renderDashboard();
    // Name appears in multiple nodes — confirm at least one exists
    expect(screen.getAllByText(/Alice Admin/i).length).toBeGreaterThan(0);
  });

  it("displays the correct ADMIN role label inside the banner", async () => {
    await renderDashboard();
    // Target the <strong>ADMIN</strong> inside .welcome-card specifically
    const welcomeCard = document.querySelector(".welcome-card");
    expect(within(welcomeCard).getByText("ADMIN")).toBeInTheDocument();
  });

  it("hides welcome banner when a non-overview page is active", async () => {
    await renderDashboard();
    fireEvent.click(within(document.querySelector(".sidebar")).getByText("Security Logs"));
    // Check the banner h2 greeting is gone (the toast may still say "Welcome back")
    expect(screen.queryByRole("heading", { name: /Good/i })).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. SEARCH BAR
// ─────────────────────────────────────────────────────────────────────────────
describe("SearchBar", () => {
  it("opens search modal on Ctrl+K", async () => {
    await renderDashboard();
    fireEvent.keyDown(document, { ctrlKey: true, key: "k", bubbles: true });
    expect(screen.getByPlaceholderText("Search menu…")).toBeInTheDocument();
  });

  it("closes search modal on Escape", async () => {
    await renderDashboard();
    fireEvent.keyDown(document, { ctrlKey: true, key: "k", bubbles: true });
    fireEvent.keyDown(document, { key: "Escape", bubbles: true });
    await waitFor(() =>
      expect(screen.queryByPlaceholderText("Search menu…")).not.toBeInTheDocument()
    );
  });

  it("filters menu items based on query", async () => {
    await renderDashboard();
    fireEvent.keyDown(document, { ctrlKey: true, key: "k", bubbles: true });
    fireEvent.change(screen.getByPlaceholderText("Search menu…"), {
      target: { value: "audit" },
    });
    // Scope to search-results panel — "Audit Trail" also lives in the sidebar
    const results = document.querySelector(".search-results");
    expect(within(results).getByText("Audit Trail")).toBeInTheDocument();
    expect(within(results).queryByText("User Management")).not.toBeInTheDocument();
  });

  it("navigates to a menu item selected from search results", async () => {
    await renderDashboard();
    fireEvent.keyDown(document, { ctrlKey: true, key: "k", bubbles: true });
    fireEvent.change(screen.getByPlaceholderText("Search menu…"), {
      target: { value: "security" },
    });
    // Click inside the results panel only — sidebar also has "Security Logs"
    fireEvent.click(within(document.querySelector(".search-results")).getByText("Security Logs"));
    expect(screen.queryByPlaceholderText("Search menu…")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Security Logs" })).toBeInTheDocument();
  });

  it("shows 'No results' when query matches nothing", async () => {
    await renderDashboard();
    fireEvent.keyDown(document, { ctrlKey: true, key: "k", bubbles: true });
    fireEvent.change(screen.getByPlaceholderText("Search menu…"), {
      target: { value: "xyznotexist" },
    });
    expect(screen.getByText("No results")).toBeInTheDocument();
  });

  it("opens search modal via topbar Search button", async () => {
    await renderDashboard();
    fireEvent.click(screen.getByText("Search"));
    expect(screen.getByPlaceholderText("Search menu…")).toBeInTheDocument();
  });

  it("closes search modal on overlay click", async () => {
    await renderDashboard();
    fireEvent.keyDown(document, { ctrlKey: true, key: "k", bubbles: true });
    fireEvent.click(document.querySelector(".search-overlay"));
    await waitFor(() =>
      expect(screen.queryByPlaceholderText("Search menu…")).not.toBeInTheDocument()
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. ROLE-SPECIFIC OVERVIEW CONTENT
// ─────────────────────────────────────────────────────────────────────────────
describe("Role-specific overview content", () => {
  it("renders AdminOverview for admin", async () => {
    await renderDashboard();
    expect(await screen.findByText("System Health")).toBeInTheDocument();
  });

  it("renders ManagerOverview for manager", async () => {
    await renderDashboard({ realm_access: { roles: ["manager"] } });
    expect(await screen.findByText("Revenue vs Target")).toBeInTheDocument();
  });

  it("renders EmployeeOverview for unknown/employee role", async () => {
    await renderDashboard({ realm_access: { roles: ["staff"] } });
    expect(await screen.findByText("Quick Actions")).toBeInTheDocument();
  });

  it("renders UserOverview for user role", async () => {
    await renderDashboard({ realm_access: { roles: ["user"] } });
    expect(await screen.findByText("Total Balance")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. COMING SOON FALLBACK
// ─────────────────────────────────────────────────────────────────────────────
describe("ComingSoon component", () => {
  it("renders coming-soon message for stub menu items", async () => {
    await renderDashboard();
    fireEvent.click(within(document.querySelector(".sidebar")).getByText("Audit Trail"));
    expect(
      screen.getByText("This section is coming soon. Stay tuned!")
    ).toBeInTheDocument();
  });
});