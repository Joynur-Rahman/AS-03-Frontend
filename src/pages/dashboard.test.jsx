/* eslint-disable no-undef */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Dashboard from "./dashboard.jsx";

/* -------------------- MOCK RECHARTS -------------------- */
jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  BarChart: ({ children }) => <div>{children}</div>,
  Bar: () => <div>Bar</div>,
  XAxis: () => <div>XAxis</div>,
  YAxis: () => <div>YAxis</div>,
  Tooltip: () => <div>Tooltip</div>,
  Legend: () => <div>Legend</div>,
}));

/* -------------------- MOCK IMAGE -------------------- */
jest.mock("../assets/hdfcbanklogo.png", () => "logo");

/* -------------------- MOCK AUTH MODULE -------------------- */
jest.mock("../api/auth", () => ({
  getCurrentUser: jest.fn(),
  logout: jest.fn(),
}));

import { getCurrentUser, logout } from "../api/auth";

describe("Dashboard Component", () => {
  const mockUser = {
    name: "Nabajyoti Das",
    email: "nabajyoti@gmail.com",
    employeeId: "EMP-1023",
    roles: ["employee"],
    exp: Math.floor(Date.now() / 1000) + 300,
  };

  beforeEach(() => {
    getCurrentUser.mockResolvedValue(mockUser);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("shows loading initially", () => {
    render(<Dashboard />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test("renders user name after API call", async () => {
    render(<Dashboard />);
    expect(
      await screen.findByText(/Good Morning, Nabajyoti Das/i)
    ).toBeInTheDocument();
  });

  test("displays correct role in title", async () => {
    render(<Dashboard />);
    expect(
      await screen.findByText(/EMPLOYEE Dashboard/i)
    ).toBeInTheDocument();
  });

  test("renders personal information", async () => {
    render(<Dashboard />);

    expect(
      await screen.findByText(/nabajyoti@gmail.com/i)
    ).toBeInTheDocument();

    expect(
      await screen.findByText(/EMP-1023/i)
    ).toBeInTheDocument();
  });

  test("menu click activates item", async () => {
    render(<Dashboard />);
    const timeline = await screen.findByText("Timeline");

    fireEvent.click(timeline);
    expect(timeline).toHaveClass("active");
  });

  test("dropdown opens on profile click", async () => {
    render(<Dashboard />);

    const profileButton = await screen.findByTestId("profile-button");
    fireEvent.click(profileButton);

    expect(
      screen.getByText(/View Profile/i)
    ).toBeInTheDocument();
  });

  test("logout function is called", async () => {
    render(<Dashboard />);

    const profileButton = await screen.findByTestId("profile-button");
    fireEvent.click(profileButton);

    const logoutBtn = screen.getByRole("button", { name: /logout/i });
    fireEvent.click(logoutBtn);

    expect(logout).toHaveBeenCalled();
  });

  test("renders chart section", async () => {
    render(<Dashboard />);
    expect(
      await screen.findByText(/Target vs Reality/i)
    ).toBeInTheDocument();
  });
});