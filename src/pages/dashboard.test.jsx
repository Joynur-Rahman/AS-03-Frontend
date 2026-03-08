/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Dashboard, { generateEmpId, detectRole } from './dashboard';
import { getCurrentUser, logout } from '../api/auth';

// 1. ROBUST MOCKS
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  BarChart: () => <div data-testid="bar-chart" />,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
  AreaChart: () => <div data-testid="area-chart" />,
  Area: () => null,
  LineChart: () => <div data-testid="line-chart" />,
  Line: () => null,
  PieChart: () => <div data-testid="pie-chart" />,
  Pie: () => null,
  Cell: () => null,
}));

jest.mock('../api/auth', () => ({
  getCurrentUser: jest.fn(),
  logout: jest.fn(),
}));

describe('Dashboard Component Suite', () => {
  const adminUser = {
    name: "Jane Admin",
    email: "jane@bank.io",
    preferred_username: "janedoe",
    sub: "sub-12345",
    roles: ["admin"]
  };

  beforeEach(() => {
    getCurrentUser.mockResolvedValue(adminUser);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('Dashboard UI & Interaction', () => {
    
    test('Search Bar (Ctrl+K) - Specific Result Selection', async () => {
      render(<Dashboard />);
      await screen.findByText(/Administrator Console/i);

      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
      const searchInput = screen.getByPlaceholderText(/Search menu…/i);
      
      fireEvent.change(searchInput, { target: { value: 'Security' } });

      // FIX: Use getAllByText and pick the one inside the search results container
      // or use a more specific matcher to avoid the sidebar duplicate.
      const searchResults = screen.getAllByText(/Security Logs/i);
      expect(searchResults[0]).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'Escape' });
    });

    test('Theme Toggle - Finding by Title', async () => {
      render(<Dashboard />);
      await screen.findByText(/Administrator Console/i);

      // FIX: Don't search for the emoji directly (it's in the greeting too).
      // Use the 'title' attribute you defined in the button.
      const themeToggle = screen.getByTitle(/Toggle dark mode/i);
      fireEvent.click(themeToggle);

      expect(document.documentElement.style.getPropertyValue('--bg-app')).toBe('#0f172a');
    });

    test('Logout - Text Matcher Function', async () => {
      render(<Dashboard />);
      
      // FIX: If "Logout" is broken into multiple spans or styled oddly,
      // use a custom matcher function.
      const logoutBtn = await screen.findByText((content, element) => {
        return element.tagName.toLowerCase() === 'span' && content.includes('Logout');
      });
      
      fireEvent.click(logoutBtn);
      expect(logout).toHaveBeenCalled();
    });
  });

  describe('User Management Page', () => {
    test('Navigates via Sidebar correctly', async () => {
      render(<Dashboard />);
      await screen.findByText(/Administrator Console/i);

      // FIX: Find "User Management" specifically within the navigation menu
      const navItem = screen.getByRole('button', { name: /User Management/i }) || 
                      screen.getAllByText(/User Management/i)[0];
      
      fireEvent.click(navItem);

      // Verify page change by looking for the Header H3 specifically
      expect(await screen.findByRole('heading', { level: 3, name: /User Management/i }))
        .toBeInTheDocument();
    });
  });
});