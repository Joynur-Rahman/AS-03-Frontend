/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { getCurrentUser, logout } from "../api/auth";
import hdfcLogo from "../assets/hdfcbanklogo.png";
import "./dashboard.css";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import UserManagement from "./Usermanagement";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost";

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function generateEmpId(sub = "") {
  const hash = sub.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return "EMP-" + String(1000 + (hash % 9000)).padStart(4, "0");
}

function detectRole(user) {
  const email    = user?.email?.toLowerCase() || "";
  const username = user?.preferred_username?.toLowerCase() || "";
  const roles = [
    ...(user?.roles || []),
    ...(user?.realm_access?.roles || []),
    ...(user?.resource_access
      ? Object.values(user.resource_access).flatMap((r) => r?.roles || [])
      : []),
  ].map((r) => r.toLowerCase());

  if (roles.some((r) => r.includes("admin"))                            || email.includes("admin")   || username.includes("admin"))   return "admin";
  if (roles.some((r) => r.includes("manager") || r.includes("manger")) || email.includes("manager") || username.includes("manager")) return "manager";
  if (roles.some((r) => r === "user"))                                                                                                 return "user";
  return "employee";
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIDEBAR CONFIG
// ═══════════════════════════════════════════════════════════════════════════════
const SIDEBAR_MENUS = {
  admin: [
    { label: "System Overview", icon: "⊞" },
    { label: "User Management", icon: "👥" },
    { label: "Security Logs",   icon: "🔐" },
    { label: "API Settings",    icon: "⚙️" },
    { label: "Audit Trail",     icon: "📊" },
    { label: "Configuration",   icon: "🛠️" },
    { label: "Account",         icon: "👤", route: "/account" },
    { label: "Admin Console",   icon: "🖥️", route: "/admin/console", adminOnly: true },
  ],
  manager: [
    { label: "Overview",  icon: "⊞" },
    { label: "Inbox",     icon: "📩" },
    { label: "Invoices",  icon: "📄" },
    { label: "Planning",  icon: "📈" },
    { label: "Settings",  icon: "⚙️" },
    { label: "Account",   icon: "👤", route: "/account" },
  ],
  employee: [
    { label: "Overview",  icon: "⊞" },
    { label: "Timeline",  icon: "🕐" },
    { label: "Activity",  icon: "⚡" },
    { label: "Messages",  icon: "💬" },
    { label: "Settings",  icon: "⚙️" },
  ],
  user: [
    { label: "Wallet",       icon: "⊞" },
    { label: "Transactions", icon: "🔄" },
    { label: "Cards",        icon: "💳" },
    { label: "Savings",      icon: "🏦" },
    { label: "Support",      icon: "💬" },
    { label: "Account",      icon: "👤", route: "/account" },
  ],
};

const ROLE_THEME = {
  admin:    "#365f7c",
  manager:  "#2f8cf7",
  employee: "#44568c",
  user:     "#3a64ed",
};

const PAGE_TITLE = {
  admin:    "Administrator Console",
  manager:  "Manager's Dashboard",
  employee: "Employee Dashboard",
  user:     "User Dashboard",
};

function applyTheme(dark) {
  const r = document.documentElement;
  if (dark) {
    r.style.setProperty("--bg-app",    "#0f172a");
    r.style.setProperty("--bg-card",   "#1e293b");
    r.style.setProperty("--bg-wrap",   "#0f172a");
    r.style.setProperty("--text-main", "#f1f5f9");
    r.style.setProperty("--text-sub",  "#94a3b8");
    r.style.setProperty("--border",    "#334155");
    r.style.setProperty("--hover-bg",  "#334155");
  } else {
    r.style.setProperty("--bg-app",    "#eef2fb");
    r.style.setProperty("--bg-card",   "#ffffff");
    r.style.setProperty("--bg-wrap",   "#f0f4ff");
    r.style.setProperty("--text-main", "#1e293b");
    r.style.setProperty("--text-sub",  "#64748b");
    r.style.setProperty("--border",    "#e5e7eb");
    r.style.setProperty("--hover-bg",  "#f1f5f9");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATED COUNTER
// ═══════════════════════════════════════════════════════════════════════════════
function useCountUp(target, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const numeric = parseFloat(String(target).replace(/[^0-9.]/g, ""));
    if (isNaN(numeric)) { setVal(target); return; }
    const steps = 40;
    const step  = numeric / steps;
    let cur = 0;
    const iv = setInterval(() => {
      cur += step;
      if (cur >= numeric) { setVal(numeric); clearInterval(iv); }
      else setVal(cur);
    }, duration / steps);
    return () => clearInterval(iv);
  }, [target, duration]);

  const prefix   = String(target).match(/^[^0-9]*/)?.[0]  || "";
  const suffix   = String(target).match(/[^0-9.]+$/)?.[0] || "";
  const decimals = String(target).includes(".") ? String(target).split(".")[1]?.length || 0 : 0;
  return prefix + val.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════════════════════════
function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((message, type = "info", duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((p) => [...p, { id, message, type }]);
    if (duration > 0) setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), duration);
    return id;
  }, []);
  const remove = useCallback((id) => setToasts((p) => p.filter((t) => t.id !== id)), []);
  return { toasts, add, remove };
}

function ToastContainer({ toasts, onRemove }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className="toast-icon">
            {t.type === "error" ? "🚨" : t.type === "warning" ? "⚠️" : t.type === "success" ? "✅" : "ℹ️"}
          </span>
          <span className="toast-text">{t.message}</span>
          <button className="toast-close" onClick={() => onRemove(t.id)}>×</button>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED MINI-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
function ProgressBar({ value, color }) {
  return (
    <div className="progress-track">
      <div className="progress-fill" style={{ width: `${value}%`, background: color }} />
    </div>
  );
}

function Sparkline({ data, color, width = 100, height = 32 }) {
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / (max - min || 1)) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={width} height={height} style={{ overflow: "visible", display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={`0,${height} ${pts} ${width},${height}`} fill={`${color}25`} stroke="none" />
    </svg>
  );
}

function KpiCard({ label, val, trend, up, themeColor, children }) {
  const animated = useCountUp(val);
  return (
    <div className="glass-card" style={{ "--card-color": themeColor }}>
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <span className={up ? "kpi-badge-up" : "kpi-badge-down"}>{trend}</span>
      </div>
      <div className="kpi-value">{animated}</div>
      {children}
    </div>
  );
}

function DonutRing({ segments, total, label }) {
  const r = 52, cx = 64, cy = 64, circ = 2 * Math.PI * r;
  const withOffsets = segments.reduce((acc, seg) => {
    const prevCum = acc.length > 0 ? acc[acc.length - 1].cumulative : 0;
    const frac = seg.value / total;
    return [...acc, { ...seg, frac, cumulative: prevCum + frac }];
  }, []);
  return (
    <svg width="128" height="128" viewBox="0 0 128 128">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth="18" />
      {withOffsets.map((seg, i) => {
        const dash   = seg.frac * circ;
        const offset = circ - (seg.cumulative - seg.frac) * circ;
        return (
          <circle key={seg.color + i} cx={cx} cy={cy} r={r} fill="none"
            stroke={seg.color} strokeWidth="18"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={offset}
            transform="rotate(-90 64 64)"
            style={{ transition: "stroke-dasharray 0.9s ease" }} />
        );
      })}
      <text x={cx} y={cy - 5}  textAnchor="middle" fontSize="18" fontWeight="800" fill="var(--text-main)">{total.toLocaleString()}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="var(--text-sub)">{label}</text>
    </svg>
  );
}

function ComingSoon({ item, themeColor }) {
  return (
    <div className="coming-soon">
      <div className="coming-soon-icon">{item?.icon || "📄"}</div>
      <div className="coming-soon-title">{item?.label}</div>
      <div className="coming-soon-desc">This section is coming soon. Stay tuned!</div>
      <div className="coming-soon-badge" style={{ background: themeColor }}>Coming Soon</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH BAR
// ═══════════════════════════════════════════════════════════════════════════════
function SearchBar({ role, onNavigate }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");
  const inputRef          = useRef(null);
  const allItems          = useMemo(() => SIDEBAR_MENUS[role] || [], [role]);
  const filtered          = useMemo(() =>
    query.trim() === ""
      ? allItems
      : allItems.filter((i) => i.label.toLowerCase().includes(query.toLowerCase())),
    [query, allItems]);

  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); setOpen(true); }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

  if (!open) return null;
  return (
    <div className="search-overlay" onClick={() => setOpen(false)}>
      <div className="search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="search-input-row">
          <span>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search menu…"
            className="search-input"
          />
          <kbd className="search-esc-kbd">ESC</kbd>
        </div>
        <div className="search-results">
          {filtered.length === 0
            ? <div className="search-empty">No results</div>
            : filtered.map((item) => (
              <div
                key={item.label}
                className="search-result-item"
                onClick={() => { onNavigate(item.label); setOpen(false); setQuery(""); }}
              >
                <span className="search-result-icon">{item.icon}</span>
                <span>{item.label}</span>
              </div>
            ))}
        </div>
        <div className="search-footer">
          <span>↵ select</span><span>ESC close</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
const SAMPLE_NOTIFICATIONS = [
  { id: 1, icon: "💰", title: "Salary Credited",        body: "₹85,000 credited to your account", time: "2 min ago",  unread: true,  color: "#10b981" },
  { id: 2, icon: "🔐", title: "Login from new device",  body: "Chrome · Mumbai · Mar 7 2026",      time: "15 min ago", unread: true,  color: "#f97316" },
  { id: 3, icon: "📄", title: "Invoice #INV-0041 Paid", body: "Acme Corp paid $4,200",             time: "1h ago",     unread: true,  color: "#6366f1" },
  { id: 4, icon: "⚠️", title: "Failed login attempt",   body: "3 failed attempts detected",        time: "3h ago",     unread: false, color: "#ef4444" },
  { id: 5, icon: "🔄", title: "Session refreshed",      body: "Your session was auto-renewed",     time: "5h ago",     unread: false, color: "#2f8cf7" },
  { id: 6, icon: "✅", title: "Profile updated",        body: "Your profile info was saved",       time: "Yesterday",  unread: false, color: "#10b981" },
];

function NotificationsPanel({ open, onClose, themeColor }) {
  const [notes, setNotes] = useState(SAMPLE_NOTIFICATIONS);
  const unread = notes.filter((n) => n.unread).length;
  if (!open) return null;
  return (
    <div className="notif-overlay" onClick={onClose}>
      <div className="notif-panel" onClick={(e) => e.stopPropagation()}>
        <div className="notif-header">
          <div className="notif-title">
            Notifications
            {unread > 0 && <span className="notif-badge">{unread}</span>}
          </div>
          <button
            className="notif-mark-read"
            style={{ color: themeColor }}
            onClick={() => setNotes((p) => p.map((n) => ({ ...n, unread: false })))}
          >
            Mark all read
          </button>
        </div>
        <div className="notif-list">
          {notes.map((n) => (
            <div
              key={n.id}
              className={`notif-item${n.unread ? " unread" : ""}`}
              onClick={() => setNotes((p) => p.map((x) => x.id === n.id ? { ...x, unread: false } : x))}
            >
              <div className="notif-item-icon" style={{ background: `${n.color}18` }}>{n.icon}</div>
              <div className="notif-item-body">
                <div className="notif-item-title-row">
                  <span className="notif-item-title">{n.title}</span>
                  {n.unread && <div className="notif-unread-dot" style={{ background: themeColor }} />}
                </div>
                <div className="notif-item-desc">{n.body}</div>
                <div className="notif-item-time">{n.time}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="notif-footer">
          <button style={{ color: themeColor }}>View all notifications →</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE PAGE MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function ProfilePage({ user, role, themeColor, onClose }) {

  const [tab, setTab] = useState("info");
  const tabs = [
    { id: "info",     label: "Profile Info" },
    { id: "security", label: "Security"     },
    { id: "prefs",    label: "Preferences"  },
  ];

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>

        <div className="profile-modal-banner" style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}bb)` }}>
          <button className="profile-modal-close" onClick={onClose}>×</button>
          <div className="profile-modal-user-row">
            <div className="profile-modal-avatar">
              {(user.name || "U").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="profile-modal-name">{user.name}</div>
              <div className="profile-modal-email">{user.email}</div>
              <span className="profile-modal-role">{role}</span>
            </div>
          </div>
        </div>

        <div className="profile-modal-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`profile-tab${tab === t.id ? " active" : ""}`}
              style={tab === t.id ? { color: themeColor, borderBottomColor: themeColor } : {}}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="profile-modal-body">
          {tab === "info" && (
            <div className="profile-info-list">
              {[
                ["Full Name", user.name || user.preferred_username || "—"],
                ["Username",  user.preferred_username],
                ["Email",     user.email],
                ["Role",      role.toUpperCase()],
              ].map(([label, val]) => (
                <div key={label} className="profile-info-row">
                  <span className="profile-info-label">{label}</span>
                  <span className="profile-info-value">{val || "—"}</span>
                </div>
              ))}
            </div>
          )}
          {tab === "security" && (
            <div className="profile-info-list">
              {[
                { label: "Two-Factor Auth",  val: "Enabled",         col: "#10b981" },
                { label: "Last Login",       val: "Today, 9:42 AM",  col: null },
                { label: "Login Device",     val: "Chrome / Mumbai", col: null },
                { label: "Session Timeout",  val: "15 minutes",      col: null },
                { label: "Password Changed", val: "14 days ago",     col: null },
              ].map(({ label, val, col }) => (
                <div key={label} className="profile-info-row">
                  <span className="profile-info-label">{label}</span>
                  <span className="profile-info-value" style={col ? { color: col } : {}}>{val}</span>
                </div>
              ))}
              <button className="change-password-btn">🔑 Change Password</button>
            </div>
          )}
          {tab === "prefs" && (
            <div className="profile-info-list">
              {[
                { label: "Email Notifications", checked: true  },
                { label: "SMS Alerts",          checked: false },
                { label: "Login Alerts",        checked: true  },
                { label: "Monthly Reports",     checked: true  },
              ].map(({ label, checked }) => (
                <div key={label} className="profile-pref-row">
                  <span className="profile-pref-label">{label}</span>
                  <div className="toggle-track" style={{ background: checked ? themeColor : "#e2e8f0" }}>
                    <div className={`toggle-thumb${checked ? " on" : " off"}`} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════
function AdminOverview({ user, themeColor }) {
  const chartData = [
    { period: "Mon", sessions: 380, failed: 23 }, { period: "Tue", sessions: 520, failed: 18 },
    { period: "Wed", sessions: 450, failed: 31 }, { period: "Thu", sessions: 680, failed: 12 },
    { period: "Fri", sessions: 720, failed: 9  }, { period: "Sat", sessions: 650, failed: 15 },
    { period: "Sun", sessions: 800, failed: 7  },
  ];
  const kpis = [
    { label: "Total Users",     val: "14,203", trend: "+8%",  up: true  },
    { label: "Active Sessions", val: "384",    trend: "+15%", up: true  },
    { label: "Failed Logins",   val: "23",     trend: "-41%", up: true  },
    { label: "Audit Events",    val: "1,204",  trend: "+2%",  up: false },
  ];
  const users = [
    { name: "Alice Chen", email: "alice@bank.io", role: "User",    status: "Active",    last: "2m ago",  av: "AC" },
    { name: "Bob Reyes",  email: "bob@bank.io",   role: "Manager", status: "Active",    last: "14m ago", av: "BR" },
    { name: "David Kim",  email: "david@bank.io", role: "User",    status: "Suspended", last: "2 days",  av: "DK" },
    { name: "Emeka Osei", email: "emeka@bank.io", role: "Analyst", status: "Active",    last: "1h ago",  av: "EO" },
  ];
  const auditLogs = [
    { icon: "🔑", ev: "Admin login",  actor: user?.preferred_username || "admin", time: "Just now",  col: "#10b981" },
    { icon: "🛡️", ev: "Role updated", actor: "system",                            time: "5 min ago", col: "#f97316" },
    { icon: "🚫", ev: "Failed login", actor: "unknown",                           time: "12 min",    col: "#ef4444" },
    { icon: "📤", ev: "Data export",  actor: "manager01",                         time: "1h ago",    col: "#6366f1" },
    { icon: "💾", ev: "Backup",       actor: "system",                            time: "3h ago",    col: "#10b981" },
  ];

  return (
    <>
      <div className="welcome-card" style={{ borderLeft: `6px solid ${themeColor}` }}>
        {[
          { label: "System Status",   val: "🟢 Operational" },
          { label: "Active Sessions", val: "384"             },
          { label: "DB Uptime",       val: "99.9%"           },
          { label: "Last Backup",     val: "3h ago"          },
          { label: "Pending Alerts",  val: "⚠️ 3 Critical"  },
        ].map(({ label, val }) => (
          <div key={label} className="status-strip-item">
            <span className="status-strip-label">{label}</span>
            <span className="status-strip-value">{val}</span>
          </div>
        ))}
      </div>

      <div className="card-row-4">
        {kpis.map((k) => <KpiCard key={k.label} {...k} themeColor={themeColor} />)}
      </div>

      <div className="grid-2-1">
        <div className="chart-card" style={{ "--chart-color": themeColor }}>
          <h3 style={{ color: themeColor }}>Sessions vs Failed Logins</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={themeColor} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={themeColor} stopOpacity={0}    />
                </linearGradient>
                <linearGradient id="gf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <XAxis dataKey="period" /><YAxis /><Tooltip /><Legend />
              <Area type="monotone" dataKey="sessions" stroke={themeColor} fill="url(#gs)" strokeWidth={2} />
              <Area type="monotone" dataKey="failed"   stroke="#ef4444"   fill="url(#gf)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card" style={{ "--card-color": themeColor }}>
          <h3 style={{ color: themeColor, marginBottom: 16 }}>System Health</h3>
          {[
            { label: "CPU Usage",   val: 34, color: themeColor },
            { label: "Memory",      val: 61, color: "#f97316"  },
            { label: "Disk",        val: 48, color: "#10b981"  },
            { label: "Network I/O", val: 72, color: "#6366f1"  },
          ].map((m) => (
            <div key={m.label} className="health-metric">
              <div className="health-metric-row">
                <span className="health-metric-label">{m.label}</span>
                <span className="health-metric-pct" style={{ color: m.color }}>{m.val}%</span>
              </div>
              <ProgressBar value={m.val} color={m.color} />
            </div>
          ))}
        </div>
      </div>

      <div className="grid-2-1">
        <div className="glass-card" style={{ "--card-color": themeColor }}>
          <div className="card-header-row">
            <h3 style={{ color: themeColor }}>Recent Users</h3>
            <button className="btn-primary" style={{ background: themeColor }}>+ Add User</button>
          </div>
          {users.map((u) => (
            <div key={u.email} className="user-list-row">
              <div className="user-list-avatar" style={{ background: themeColor }}>{u.av}</div>
              <div className="user-list-info">
                <div className="user-list-name">{u.name}</div>
                <div className="user-list-email">{u.email}</div>
              </div>
              <span className={`chip ${u.status === "Active" ? "chip-green" : "chip-red"}`}>{u.status}</span>
              <span className="user-list-last">{u.last}</span>
              <div className="user-list-actions">
                {["✏️", "🗑️"].map((ic) => (
                  <button key={ic} className="icon-action-btn">{ic}</button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="glass-card" style={{ "--card-color": themeColor }}>
          <h3 style={{ color: themeColor, marginBottom: 16 }}>Audit Log</h3>
          {auditLogs.map((e) => (
            <div key={e.ev} className="audit-row">
              <div className="audit-icon" style={{ background: `${e.col}18` }}>{e.icon}</div>
              <div className="audit-body">
                <div className="audit-ev">{e.ev}</div>
                <div className="audit-actor">by {e.actor}</div>
              </div>
              <div className="audit-time">{e.time}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MANAGER OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════
function ManagerOverview({ themeColor }) {
  const chartData = [
    { month: "Jan", revenue: 120, target: 150 }, { month: "Feb", revenue: 135, target: 150 },
    { month: "Mar", revenue: 118, target: 140 }, { month: "Apr", revenue: 145, target: 160 },
    { month: "May", revenue: 160, target: 170 }, { month: "Jun", revenue: 152, target: 165 },
    { month: "Jul", revenue: 170, target: 180 }, { month: "Aug", revenue: 165, target: 175 },
    { month: "Sep", revenue: 180, target: 190 }, { month: "Oct", revenue: 175, target: 185 },
    { month: "Nov", revenue: 195, target: 200 }, { month: "Dec", revenue: 210, target: 210 },
  ];
  const kpis = [
    { label: "Total Revenue",    val: "$284K", trend: "+12%", up: true  },
    { label: "Managed Accounts", val: "1,482", trend: "+4%",  up: true  },
    { label: "Invoices Sent",    val: "327",   trend: "-3%",  up: false },
    { label: "Open Tickets",     val: "14",    trend: "-22%", up: true  },
  ];
  const team = [
    { name: "Sarah Johnson", role: "Senior Analyst",   perf: 92, av: "SJ" },
    { name: "Mike Chen",     role: "Risk Manager",     perf: 85, av: "MC" },
    { name: "Priya Patel",   role: "Compliance Lead",  perf: 78, av: "PP" },
    { name: "James Lee",     role: "Client Relations", perf: 95, av: "JL" },
  ];
  const invoices = [
    { id: "#INV-0041", client: "Acme Corp",    amt: "$4,200", status: "Paid"    },
    { id: "#INV-0040", client: "Globex Ltd",   amt: "$1,800", status: "Pending" },
    { id: "#INV-0039", client: "Initech",      amt: "$9,500", status: "Paid"    },
    { id: "#INV-0038", client: "Umbrella Inc", amt: "$640",   status: "Overdue" },
  ];
  const topClients = [
    { name: "TechCorp Ltd", val: "$45k", sub: "12 Projects", col: "#6366f1" },
    { name: "Global Sols",  val: "$28k", sub: "5 Projects",  col: "#8b5cf6" },
    { name: "Designify",    val: "$12k", sub: "Retainer",    col: "#ec4899" },
  ];

  return (
    <>
      <div className="card-row-4">
        {kpis.map((k) => <KpiCard key={k.label} {...k} themeColor={themeColor} />)}
      </div>

      <div className="grid-2-1">
        <div className="chart-card" style={{ "--chart-color": themeColor }}>
          <h3 style={{ color: themeColor }}>Revenue vs Target</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData}>
              <XAxis dataKey="month" /><YAxis /><Tooltip /><Legend />
              <Line type="monotone" dataKey="revenue" stroke={themeColor} strokeWidth={3} dot={{ fill: themeColor, r: 4 }} />
              <Line type="monotone" dataKey="target"  stroke="#e2e8f0"   strokeWidth={2} strokeDasharray="6 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card" style={{ "--card-color": themeColor }}>
          <h3 style={{ color: themeColor, marginBottom: 16 }}>Spend Mix</h3>
          <div className="donut-row">
            <DonutRing total={6870} label="Total" segments={[
              { value: 1332, color: themeColor },
              { value: 2302, color: "#a78bfa"  },
              { value: 1899, color: "#38bdf8"  },
              { value: 1337, color: "#fb923c"  },
            ]} />
            <div className="donut-legend">
              {[["Online", "$1,332", themeColor], ["Entertain", "$2,302", "#a78bfa"],
                ["Services", "$1,899", "#38bdf8"], ["Shopping", "$1,337", "#fb923c"]].map(([l, v, c]) => (
                <div key={l} className="donut-legend-item">
                  <div className="donut-legend-dot" style={{ background: c }} />
                  <div>
                    <div className="donut-legend-label">{l}</div>
                    <div className="donut-legend-val">{v}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2-1">
        <div className="glass-card" style={{ "--card-color": themeColor }}>
          <h3 style={{ color: themeColor, marginBottom: 16 }}>Team Performance</h3>
          {team.map((m) => (
            <div key={m.name} className="team-row">
              <div className="team-avatar" style={{ background: themeColor }}>{m.av}</div>
              <div className="team-info">
                <div className="team-name-row">
                  <div>
                    <div className="team-name">{m.name}</div>
                    <div className="team-role-sub">{m.role}</div>
                  </div>
                  <span className="team-perf" style={{ color: themeColor }}>{m.perf}%</span>
                </div>
                <ProgressBar value={m.perf} color={themeColor} />
              </div>
            </div>
          ))}
        </div>

        <div className="glass-card" style={{ "--card-color": themeColor }}>
          <h3 style={{ color: themeColor, marginBottom: 16 }}>Top Clients</h3>
          {topClients.map((c, i) => (
            <div key={i} className="audit-row">
              <div className="audit-icon" style={{ background: c.col, color: "#fff", fontSize: "10px", fontWeight: 700 }}>
                {c.name.substring(0, 1)}
              </div>
              <div className="audit-body">
                <div className="audit-ev">{c.name}</div>
                <div className="audit-actor">{c.sub}</div>
              </div>
              <div style={{ fontWeight: "600", color: "var(--text-main)" }}>{c.val}</div>
            </div>
          ))}

          <h3 style={{ color: themeColor, margin: "16px 0 12px" }}>Recent Invoices</h3>
          {invoices.map((inv) => (
            <div key={inv.id} className="invoice-row">
              <div>
                <div className="invoice-id">{inv.id}</div>
                <div className="invoice-client">{inv.client}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="invoice-amount">{inv.amt}</div>
                <span className={`chip ${inv.status === "Paid" ? "chip-green" : inv.status === "Overdue" ? "chip-red" : "chip-yellow"}`}>
                  {inv.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════
function EmployeeOverview({ user, themeColor }) {
  const empId = user.employeeId || user.employee_id || generateEmpId(user.sub || "");
  const chartData = [
    { month: "Jan", reality: 4200, target: 5200 }, { month: "Feb", reality: 3800, target: 4700 },
    { month: "Mar", reality: 4600, target: 5400 }, { month: "Apr", reality: 4000, target: 4800 },
    { month: "May", reality: 5200, target: 6000 }, { month: "Jun", reality: 4900, target: 5800 },
  ];
  const kpis = [
    { label: "Savings",   val: "$12,400", trend: "+5.2%", up: true,  data: [1200,1250,1180,1300,1420,1500,1620,1700] },
    { label: "Spending",  val: "$1,890",  trend: "-2.1%", up: false, data: [340,380,290,420,380,340,410,380]         },
    { label: "Transfers", val: "$3,240",  trend: "+11%",  up: true,  data: [800,950,870,1100,1050,1200,1150,1300]    },
  ];
  const transactions = [
    { icon: "🛍️", name: "Amazon Shopping", amt: "-$89.99",  col: "#ef4444" },
    { icon: "💡", name: "Electric Bill",   amt: "-$124.00", col: "#ef4444" },
    { icon: "💰", name: "Salary Credit",   amt: "+$3,240",  col: "#10b981" },
    { icon: "🎵", name: "Spotify",         amt: "-$9.99",   col: "#ef4444" },
  ];

  return (
    <>
      <div className="card-row">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} themeColor={themeColor}>
            <Sparkline data={k.data} color={k.up ? themeColor : "#ef4444"} width={120} height={36} />
          </KpiCard>
        ))}
      </div>
      <div className="card-row">
        <div className="glass-card" style={{ "--card-color": themeColor }}>
          <h3 style={{ color: themeColor }}>Personal Info</h3>
          {[["Name", user.name], ["Email", user.email], ["Employee ID", empId], ["Username", user.preferred_username]].map(([l, v]) => (
            <p key={l} className="info-line"><b className="info-line-key">{l}:</b> {v}</p>
          ))}
        </div>
        <div className="glass-card" style={{ "--card-color": themeColor }}>
          <h3 style={{ color: themeColor }}>Recent Transactions</h3>
          {transactions.map((tx) => (
            <div key={tx.name} className="tx-simple-row">
              <span className="tx-simple-icon">{tx.icon}</span>
              <span className="tx-simple-name">{tx.name}</span>
              <span className="tx-simple-amt" style={{ color: tx.col }}>{tx.amt}</span>
            </div>
          ))}
        </div>
        <div className="glass-card" style={{ "--card-color": themeColor }}>
          <h3 style={{ color: themeColor }}>Quick Actions</h3>
          <div className="quick-actions-grid">
            {[["💸", "Send"], ["📥", "Receive"], ["🔄", "Exchange"], ["📋", "Statement"]].map(([ic, l]) => (
              <div key={l} className="quick-action-btn"
                onMouseEnter={(e) => e.currentTarget.style.background = `${themeColor}15`}
                onMouseLeave={(e) => e.currentTarget.style.background = "var(--hover-bg)"}
              >
                <span>{ic}</span>{l}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="chart-card" style={{ "--chart-color": themeColor }}>
        <h3 style={{ color: themeColor }}>Target vs Reality</h3>
        <ResponsiveContainer width="100%" height={270}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={themeColor} stopOpacity={0.2} />
                <stop offset="95%" stopColor={themeColor} stopOpacity={0}   />
              </linearGradient>
            </defs>
            <XAxis dataKey="month" /><YAxis /><Tooltip /><Legend />
            <Area type="monotone" dataKey="reality" stroke={themeColor} fill="url(#gr)" strokeWidth={2.5} />
            <Area type="monotone" dataKey="target"  stroke="#e2e8f0"   fill="none"      strokeWidth={2} strokeDasharray="6 4" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// USER OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════
function UserOverview({ user, themeColor }) {
  const spendData = [
    { name: "Food",     value: 340, color: "#f97316" },
    { name: "Shopping", value: 520, color: themeColor },
    { name: "Bills",    value: 280, color: "#ef4444"  },
    { name: "Subs",     value: 160, color: "#10b981"  },
    { name: "Travel",   value: 190, color: "#6366f1"  },
  ];
  const kpis = [
    { label: "Balance",  val: "$24,830", trend: "+3.2%", up: true,  data: [22000,22400,22100,23000,23500,24000,24200,24830] },
    { label: "Spending", val: "$1,890",  trend: "-2.1%", up: false, data: [340,380,290,420,380,340,410,380]                  },
    { label: "Savings",  val: "$12,400", trend: "+5.2%", up: true,  data: [1200,1250,1180,1300,1420,1500,1620,1700]          },
  ];
  const txns = [
    { icon: "🛍️", name: "Amazon Shopping", cat: "Shopping",     amt: "-$89.99",  col: "#ef4444", date: "Today"    },
    { icon: "💡", name: "Electric Bill",   cat: "Utilities",    amt: "-$124.00", col: "#ef4444", date: "Yesterday" },
    { icon: "💰", name: "Salary Credit",   cat: "Income",       amt: "+$3,240",  col: "#10b981", date: "Mar 1"    },
    { icon: "🎵", name: "Spotify",         cat: "Subscription", amt: "-$9.99",   col: "#ef4444", date: "Feb 28"   },
    { icon: "🍕", name: "Domino's Pizza",  cat: "Food",         amt: "-$24.50",  col: "#ef4444", date: "Feb 27"   },
  ];
  const upcomingBills = [
    { title: "Internet Fiber", due: "Due in 2 days", amt: "$45.00",  icon: "🌐", status: "Unpaid"   },
    { title: "Car Insurance",  due: "Due in 5 days", amt: "$120.00", icon: "🛡️", status: "Auto-pay" },
    { title: "Adobe Cloud",    due: "Mar 05",        amt: "$52.99",  icon: "☁️", status: "Pending"  },
    { title: "Gym Membership", due: "Mar 08",        amt: "$35.00",  icon: "🏋️", status: "Pending"  },
  ];

  return (
    <>
      <div className="glass-card" style={{ "--card-color": themeColor, background: `linear-gradient(135deg, ${themeColor}12, var(--bg-card))` }}>
        <div className="balance-hero">
          <div>
            <div className="balance-label">Total Balance</div>
            <div className="balance-amount">$24,830<span className="balance-cents">.50</span></div>
            <div className="balance-summary">
              <div className="balance-income">Income <span className="income-val">+$3,240</span></div>
              <div className="balance-expense">Expenses <span className="expense-val">-$1,890</span></div>
            </div>
          </div>
          <div className="virtual-card" style={{
            background: `linear-gradient(135deg, ${themeColor}, ${themeColor}bb)`,
            boxShadow: `0 12px 30px ${themeColor}40`,
          }}>
            <div className="virtual-card-number">•••• •••• •••• 4291</div>
            <div className="virtual-card-type">Visa Platinum</div>
            <div className="virtual-card-name">{user.name}</div>
          </div>
        </div>
      </div>

      <div className="card-row">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} themeColor={themeColor}>
            <Sparkline data={k.data} color={k.up ? themeColor : "#ef4444"} width={120} height={36} />
          </KpiCard>
        ))}
      </div>

      <div className="glass-card" style={{ "--card-color": themeColor, display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontWeight: 600, color: "var(--text-main)", marginRight: 8 }}>Quick Actions:</span>
        {[
          { label: "💸 Send Money",    bg: themeColor,   color: "#fff"  },
          { label: "➕ Top Up Wallet", bg: "transparent", color: "var(--text-main)", border: "1px solid var(--border)" },
          { label: "🔒 Freeze Card",   bg: "transparent", color: "var(--text-main)", border: "1px solid var(--border)" },
        ].map((btn) => (
          <button key={btn.label} style={{
            padding: "8px 16px", borderRadius: "8px", border: btn.border || "none",
            background: btn.bg, color: btn.color, fontWeight: 600,
            cursor: "pointer", fontSize: "13px",
          }}>
            {btn.label}
          </button>
        ))}
      </div>

      <div className="grid-3-2">
        <div className="glass-card" style={{ "--card-color": themeColor }}>
          <h3 style={{ color: themeColor, marginBottom: 14 }}>Recent Transactions</h3>
          {txns.map((tx) => (
            <div key={tx.name} className="tx-row">
              <div className="tx-icon" style={{ background: `${tx.col}12` }}>{tx.icon}</div>
              <div className="tx-body">
                <div className="tx-name">{tx.name}</div>
                <div className="tx-meta">{tx.cat} · {tx.date}</div>
              </div>
              <span className={`tx-amount ${tx.col === "#10b981" ? "tx-positive" : "tx-negative"}`}>{tx.amt}</span>
            </div>
          ))}
        </div>

        <div className="col-stack">
          <div className="glass-card" style={{ "--card-color": themeColor }}>
            <h3 style={{ color: themeColor, marginBottom: 12 }}>Spending Breakdown</h3>
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie data={spendData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                  {spendData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [`$${v}`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="spend-legend">
              {spendData.map((s) => (
                <div key={s.name} className="spend-legend-item">
                  <div className="spend-legend-dot" style={{ background: s.color }} />{s.name}
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card" style={{ "--card-color": themeColor }}>
            <div className="card-header-row" style={{ marginBottom: 10 }}>
              <h3 style={{ color: themeColor }}>Upcoming Bills</h3>
              <button style={{ fontSize: "11px", color: themeColor, background: "none", border: "none", cursor: "pointer" }}>View All</button>
            </div>
            {upcomingBills.map((b, i) => (
              <div key={i} className="audit-row">
                <div className="audit-icon" style={{ background: "#fff5e9", color: "#f97316" }}>{b.icon}</div>
                <div className="audit-body">
                  <div className="audit-ev">{b.title}</div>
                  <div className="audit-actor" style={{ color: b.status === "Unpaid" ? "#ef4444" : "var(--text-sub)" }}>{b.due}</div>
                </div>
                <div style={{ fontWeight: 600, color: "var(--text-main)", fontSize: "13px" }}>{b.amt}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function Dashboard() {
  const [user, setUser]                           = useState(null);
  const [isLoading, setIsLoading]                 = useState(true);
  const [activeMenu, setActiveMenu]               = useState(null);
  const [showDropdown, setShowDropdown]           = useState(false);
  const [showProfile, setShowProfile]             = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [sidebarOpen, setSidebarOpen]             = useState(true);
  const [dark, setDark]                           = useState(false);
  const [timeLeft, setTimeLeft]                   = useState(null);
  const profileRef                                = useRef(null);
  const welcomeShown                              = useRef(false);
  const { toasts, add: addToast, remove: removeToast } = useToast();

  useEffect(() => { applyTheme(dark); }, [dark]);

  // Load user when dashboard starts
useEffect(() => {
  getCurrentUser()
    .then((data) => {
      const u = data?.data ? data.data : data;
      setUser(u);

      if (u?.exp) {
        const rem = u.exp - Math.floor(Date.now() / 1000);
        setTimeLeft(rem > 0 ? rem : 0);
      }

      if (!welcomeShown.current) {
        welcomeShown.current = true;
        addToast(`Welcome back, ${u?.name || "User"}! 👋`, "success", 3500);
      }
    })
    .catch(() => addToast("Failed to load user data.", "error"))
    .finally(() => setIsLoading(false));
}, []);


// Session countdown timer
useEffect(() => {
  if (timeLeft === null || timeLeft <= 0) {
    if (timeLeft === 0) logout();
    return;
  }

  if (timeLeft === 120)
    addToast("⚠️ Session expires in 2 minutes!", "warning", 6000);

  if (timeLeft === 30)
    addToast("🚨 Session expiring in 30 seconds!", "error", 0);

  const iv = setInterval(() => {
    setTimeLeft((prev) => {
      if (prev <= 1) {
        clearInterval(iv);
        logout();
        return 0;
      }
      return prev - 1;
    });
  }, 1000);

  return () => clearInterval(iv);
}, [timeLeft]);


// Secure refresh function (CSRF protected)
const refreshSession = useCallback(() => {

  const csrfToken = document.cookie
    .split("; ")
    .find((row) => row.startsWith("csrf_token="))
    ?.split("=")[1];

  fetch(`${API_BASE}/refresh`, {
    method: "POST",
    credentials: "include",
    headers: {
      "X-CSRF-Token": csrfToken || "",
    },
  })
    .then((res) => {
      if (!res.ok) throw new Error();
      return res.json();
    })
    .then(() => getCurrentUser())
    .then((data) => {
      const u = data?.data || data;

      setUser(u);

      if (u?.exp) {
        const remaining = u.exp - Math.floor(Date.now() / 1000);
        setTimeLeft(remaining > 0 ? remaining : 0);
      }

      addToast("Session refreshed ✅", "success", 3000);
    })
    .catch(() => {
      addToast("Session refresh failed. Logging out…", "error", 2000);
      setTimeout(logout, 2000);
    });

}, []);


// Trigger refresh when 30 seconds left
useEffect(() => {
  if (timeLeft === 30) {
    refreshSession();
  }
}, [timeLeft, refreshSession]);


// Close profile dropdown when clicking outside
useEffect(() => {
  const handleClickOutside = (e) => {
    if (profileRef.current && !profileRef.current.contains(e.target)) {
      setShowDropdown(false);
    }
  };

  document.addEventListener("mousedown", handleClickOutside);
  return () => document.removeEventListener("mousedown", handleClickOutside);
}, []);


// Loading screen
if (isLoading) {
  return (
    <div className="loading-screen">
      <div className="spinner" />
      <p className="loading-text">Loading dashboard…</p>
    </div>
  );
}

  if (!user) {
    return (
      <div className="error-screen">
        <div className="error-card">
          <div className="error-card-icon">🔒</div>
          <h2>Not authenticated</h2>
          <p>Please log in via Keycloak to continue.</p>
        </div>
      </div>
    );
  }

  const role       = detectRole(user);
  const themeColor = ROLE_THEME[role] || "#4e73df";
  const menuItems  = SIDEBAR_MENUS[role] || [];
  const pageTitle  = PAGE_TITLE[role];

  const activeItem = activeMenu
    ? menuItems.find((m) => m.label === activeMenu) || menuItems[0]
    : menuItems[0];
  const isOverview = !activeMenu || activeItem?.label === menuItems[0]?.label;

  const initials = (user.preferred_username || user.name || "U")
    .split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "🌅 Good Morning" : h < 17 ? "☀️ Good Afternoon" : "🌙 Good Evening";
  })();

  const timerClass = timeLeft <= 30 ? "urgent" : timeLeft <= 120 ? "warning" : "ok";

  const renderContent = () => {
    if (activeItem?.route) {
      window.open(`${API_BASE}${activeItem.route}`, "_blank");
      return <ComingSoon item={activeItem} themeColor={themeColor} />;
    }
    if (activeItem?.label === "User Management") return <UserManagement />;
    if (!isOverview) return <ComingSoon item={activeItem} themeColor={themeColor} />;
    if (role === "admin")    return <AdminOverview    user={user} themeColor={themeColor} />;
    if (role === "manager")  return <ManagerOverview  themeColor={themeColor} />;
    if (role === "employee") return <EmployeeOverview user={user} themeColor={themeColor} />;
    if (role === "user")     return <UserOverview     user={user} themeColor={themeColor} />;
    return <div>Role not recognized</div>;
  };

  return (
    <div className="layout">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <SearchBar role={role} onNavigate={(label) => setActiveMenu(label)} />
      <NotificationsPanel open={showNotifications} onClose={() => setShowNotifications(false)} themeColor={themeColor} />
      {showProfile && (
        <ProfilePage user={user} role={role} themeColor={themeColor} onClose={() => setShowProfile(false)} />
      )}

      {/* ── SIDEBAR ─────────────────────────────────────────── */}
      <aside className="sidebar" style={{ width: sidebarOpen ? 250 : 72 }}>
        <div className={`sidebar-logo-row${!sidebarOpen ? " collapsed" : ""}`}>
          {sidebarOpen && (
            <div className="sidebar-brand">
              <img src={hdfcLogo} alt="HDFC Logo" className="sidebar-logo" />
            </div>
          )}
          <button className="sidebar-collapse-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? "◀" : "▶"}
          </button>
        </div>

        <nav className="menu">
          {menuItems.map((item) => {
            if (item.adminOnly && role !== "admin") return null;
            const isActive = activeItem?.label === item.label;
            return (
              <div
                key={item.label}
                className={`menu-item${isActive ? " active" : ""}${!sidebarOpen ? " collapsed" : ""}`}
                style={isActive ? { background: themeColor } : {}}
                title={!sidebarOpen ? item.label : undefined}
                onClick={() => {
                  if (item.route) { window.open(`${API_BASE}${item.route}`, "_blank"); return; }
                  setActiveMenu(item.label);
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                <span className="menu-item-icon">{item.icon}</span>
                {sidebarOpen && <span className="menu-item-label">{item.label}</span>}
              </div>
            );
          })}
        </nav>

        {sidebarOpen && (
          <div className="sidebar-user-chip">
            <div className="sidebar-user-chip-inner">
              <div className="sidebar-user-avatar" style={{ background: themeColor }}>{initials}</div>
              <div>
                <div className="sidebar-user-name">{user.name}</div>
                <div className="sidebar-user-role">{role}</div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* ── MAIN ──────────────────────────────────────────── */}
      <main className="main">
        <div className="content-wrapper">

          {/* Topbar */}
          <div className="topbar" style={{ backgroundColor: themeColor }}>
            <div className="topbar-left">
              <div>
                <h1>{isOverview ? pageTitle : activeItem?.label}</h1>
                {!isOverview && (
                  <div className="topbar-breadcrumb">
                    <span className="topbar-breadcrumb-link" onClick={() => setActiveMenu(menuItems[0]?.label)}>Overview</span>
                    <span>›</span>
                    <span>{activeItem?.label}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="topbar-right">
              {timeLeft !== null && (() => {
                const mins = Math.floor(timeLeft / 60);
                const secs = timeLeft % 60;
                return (
                  <div className={`session-timer ${timerClass}`}>
                    <span>⏱</span>
                    <span>{mins}m {String(secs).padStart(2, "0")}s</span>
                    <span className="timer-label">session</span>
                  </div>
                );
              })()}

              <button
                className="topbar-search-btn"
                onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { ctrlKey: true, key: "k", bubbles: true }))}
              >
                <span>🔍</span>
                <span className="search-label">Search</span>
                <kbd>⌘K</kbd>
              </button>

              <button className="topbar-icon-btn" onClick={() => setDark(!dark)} title="Toggle dark mode">
                {dark ? "☀️" : "🌙"}
              </button>

              <button className="topbar-icon-btn" onClick={() => setShowNotifications(!showNotifications)}>
                🔔<span className="notif-dot" />
              </button>

              <div className="profile" ref={profileRef}>
                <div className="profile-trigger" onClick={() => setShowDropdown(!showDropdown)}>
                  <div className="profile-initials-circle">{initials}</div>
                  <span className="profile-username">{user.preferred_username || user.name}</span>
                </div>
                {showDropdown && (
                  <div className="dropdown">
                    <div className="dropdown-header">
                      <div className="dropdown-name">{user.name}</div>
                      <div className="dropdown-email">{user.email}</div>
                    </div>
                    {[
                      { label: "👤 View Profile",    action: () => { setShowProfile(true); setShowDropdown(false); } },
                      { label: dark ? "☀️ Light Mode" : "🌙 Dark Mode", action: () => { setDark(!dark); setShowDropdown(false); } },
                      { label: "❓ Help & Support",  action: () => setShowDropdown(false) },
                    ].map(({ label, action }) => (
                      <div key={label} className="dropdown-item" onClick={action}>{label}</div>
                    ))}
                    <hr className="dropdown-divider" />
                    <div className="dropdown-logout" onClick={logout}>🚪 Sign out</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Welcome banner */}
          {isOverview && (
            <div className="welcome-card" style={{ borderLeft: `6px solid ${themeColor}` }}>
              <div>
                <h2>{greeting}, {user.name} 👋</h2>
                <p>Welcome back to your <strong>{role.toUpperCase()}</strong> portal.</p>
                {timeLeft !== null && (
                  <span className={`session-timer ${timerClass}`}>
                    ⏱ Session: {Math.floor(timeLeft / 60)}m {String(timeLeft % 60).padStart(2, "0")}s
                  </span>
                )}
              </div>
              <img src="https://cdn-icons-png.flaticon.com/512/2921/2921222.png" alt="illustration" />
            </div>
          )}

          {/* ── CONTENT AREA — IdentityCard removed ── */}
          <div className="content-area">
            <div className="content-main">
              {renderContent()}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

export default Dashboard;