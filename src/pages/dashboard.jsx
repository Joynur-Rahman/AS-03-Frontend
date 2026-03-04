import React from "react";
import { useEffect, useState } from "react";
import { getCurrentUser, logout } from "../api/auth";
import "./dashboard.css";
import hdfcLogo from "../assets/hdfcbanklogo.png";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

function Dashboard() {
  const [user, setUser] = useState(null);
  const [activeMenu, setActiveMenu] = useState("Overview");
  const [showDropdown, setShowDropdown] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);

  /* FETCH USER */
  useEffect(() => {
    getCurrentUser().then((data) => {
      const actualUser = data?.data ? data.data : data;
      setUser(actualUser);
    });
  }, []);

  /* SESSION TIMER */
  useEffect(() => {
    if (!user?.exp) return;

    const interval = setInterval(() => {
      const remaining = user.exp - Math.floor(Date.now() / 1000);
      setTimeLeft(remaining > 0 ? remaining : 0);
    }, 1000);

    return () => clearInterval(interval);
  }, [user]);

  if (!user) return <div className="center">Loading...</div>;

  const role =
    user?.roles?.[0]?.toLowerCase() ||
    user?.realm_access?.roles?.[0]?.toLowerCase() ||
    "employee";

  /* ROLE COLORS */
  const roleTheme = {
    employee: "#4e73df",
    manager: "#7b2ff7",
    admin: "#d4af37",
  };

  const themeColor = roleTheme[role] || "#4e73df";

  const chartData = [
    { month: "Jan", reality: 4200, target: 5200 },
    { month: "Feb", reality: 3800, target: 4700 },
    { month: "Mar", reality: 4600, target: 5400 },
    { month: "Apr", reality: 4000, target: 4800 },
    { month: "May", reality: 5200, target: 6000 },
    { month: "Jun", reality: 4900, target: 5800 },
  ];

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo">
          <img src={hdfcLogo} alt="HDFC" />
        </div>

        <div className="menu">
          {[
            "Overview",
            "Timeline",
            "Users",
            "Activity",
            "Messages",
            "Settings",
          ].map((item) => (
            <div
              key={item}
              className={`menu-item ${activeMenu === item ? "active" : ""}`}
              onClick={() => setActiveMenu(item)}
              style={
                activeMenu === item
                  ? { backgroundColor: themeColor }
                  : null
              }
            >
              {item}
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        <div className="content-wrapper">
          {/* Topbar */}
          <div
            className="topbar"
            style={{ backgroundColor: themeColor }}
          >
            <h1>{role.toUpperCase()} Dashboard</h1>

            <div className="profile">
                <div
                  className="profile-info"
                  data-testid="profile-button"
                  onClick={() => setShowDropdown(!showDropdown)}
                >
                <span>{user.name}</span>
                <img
                  src="https://i.pravatar.cc/40"
                  alt="avatar"
                  className="avatar"
                />
              </div>

              {showDropdown && (
                <div className="dropdown">
                  <div>👤 View Profile</div>
                  <div>✏ Edit Profile</div>
                  <div>🔔 Notifications</div>
                  <div>❓ Help & Support</div>
                  <hr />
                  <button className="logout" onClick={logout}>
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Welcome Section */}
          <div
            className="welcome-card"
            style={{ borderLeft: `6px solid ${themeColor}` }}
          >
            <div>
              <h2>Good Morning, {user.name} 👋</h2>
              <p>
                Welcome back to your{" "}
                <strong>{role.toUpperCase()}</strong> portal.
              </p>

              {timeLeft !== null && (
                <span className="session">
                  Session expires in {Math.floor(timeLeft / 60)}m{" "}
                  {timeLeft % 60}s
                </span>
              )}
            </div>

            <img
              src="https://cdn-icons-png.flaticon.com/512/2921/2921222.png"
              alt="illustration"
            />
          </div>

          {/* Info Cards */}
          <div className="card-row">
            <div className="glass-card">
              <h3 style={{ color: themeColor }}>Personal Info</h3>
              <p><b>Name:</b> {user.name}</p>
              <p><b>Email:</b> {user.email}</p>
              <p><b>Employee ID:</b> {user.employeeId}</p>
            </div>

            <div className="glass-card">
              <h3 style={{ color: themeColor }}>Access</h3>
              {role === "employee" && (
                <>
                  <p>Customer Support Access</p>
                  <p>Service Request Handling</p>
                  <p>KYC Document Upload</p>
                </>
              )}
              {role === "manager" && (
                <>
                  <p>Team Management</p>
                  <p>Employee Monitoring</p>
                  <p>Performance Review</p>
                </>
              )}
              {role === "admin" && (
                <>
                  <p>Teams Overview</p>
                  <p>Managers</p>
                  <p>Company Analytics</p>
                </>
              )}
            </div>

            <div className="glass-card">
              <h3 style={{ color: themeColor }}>Status</h3>
              <p>🟢 Active</p>
              <p>🔒 Protected</p>
            </div>
          </div>

          {/* Chart */}
          <div className="chart-card">
            <h3 style={{ color: themeColor }}>Target vs Reality</h3>

            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="reality"
                  fill={themeColor}
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="target"
                  fill="#ccc"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;