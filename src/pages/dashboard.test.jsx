/* eslint-disable no-undef */
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { vi } from "vitest";
import Dashboard from "./dashboard";
import * as authApi from "../api/auth";

// Mock recharts (prevents SVG errors in test)
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  BarChart: ({ children }) => <div>{children}</div>,
  Bar: () => <div>Bar</div>,
  XAxis: () => <div>XAxis</div>,
  YAxis: () => <div>YAxis</div>,
  Tooltip: () => <div>Tooltip</div>,
  Legend: () => <div>Legend</div>,
}));

describe("Dashboard Component", () => {
  const mockUser = {
    name: "Nabajyoti Das",
    email: "nabajyoti@gmail.com",
    employeeId: "EMP-1023",
    roles: ["employee"],
    exp: Math.floor(Date.now() / 1000) + 300,
  };

  beforeEach(() => {
    vi.spyOn(authApi, "getCurrentUser").mockResolvedValue(mockUser);
    vi.spyOn(authApi, "logout").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("shows loading initially", () => {
    render(<Dashboard />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test("renders user name after API call", async () => {
    render(<Dashboard />);
    await screen.findByText(/Good Morning, Nabajyoti Das/i);
  });

  test("displays correct role in title", async () => {
    render(<Dashboard />);
    await screen.findByText(/EMPLOYEE Dashboard/i);
  });

  test("renders personal information", async () => {
    render(<Dashboard />);
    expect(await screen.findByText(/nabajyoti@gmail.com/i)).toBeInTheDocument();
    expect(await screen.findByText(/EMP-1023/i)).toBeInTheDocument();
  });

  test("menu click activates item", async () => {
    render(<Dashboard />);
    const timeline = await screen.findByText("Timeline");

    fireEvent.click(timeline);
    expect(timeline).toHaveClass("active");
  });

  test("dropdown opens on profile click", async () => {
    render(<Dashboard />);

    await screen.findByTestId("profile-button");

    fireEvent.click(screen.getByTestId("profile-button"));

    expect(screen.getByText(/View Profile/i)).toBeInTheDocument();
  });

  test("logout function is called", async () => {
    render(<Dashboard />);

    await screen.findByTestId("profile-button");

    fireEvent.click(screen.getByTestId("profile-button"));
    fireEvent.click(screen.getByRole("button", { name: /logout/i }));

    expect(authApi.logout).toHaveBeenCalled();
  });

  test("renders chart section", async () => {
    render(<Dashboard />);
    await screen.findByText(/Target vs Reality/i);
  });
});