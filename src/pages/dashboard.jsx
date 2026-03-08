/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { getCurrentUser, logout } from "../api/auth";
import "./dashboard.css";
import hdfcLogo from "../assets/hdfcbanklogo.png";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area, LineChart, Line, PieChart, Pie, Cell,
} from "recharts";

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
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════════
const SIDEBAR_MENUS = {
  admin:    [{ label: "Overview", icon: "⊞" }, { label: "User Management", icon: "👥" }, { label: "Security Logs", icon: "🔐" }, { label: "API Settings", icon: "⚙️" }, { label: "Audit Trail", icon: "📊" }, { label: "Configuration", icon: "🛠️" }],
  manager:  [{ label: "Overview", icon: "⊞" }, { label: "Inbox", icon: "📩" }, { label: "Accounts", icon: "👤" }, { label: "Invoices", icon: "📄" }, { label: "Planning", icon: "📈" }, { label: "Settings", icon: "⚙️" }],
  employee: [{ label: "Overview", icon: "⊞" }, { label: "Timeline", icon: "🕐" }, { label: "Activity", icon: "⚡" }, { label: "Messages", icon: "💬" }, { label: "Settings", icon: "⚙️" }],
  user:     [{ label: "My Wallet", icon: "💳" }, { label: "Transactions", icon: "🔄" }, { label: "Cards", icon: "💴" }, { label: "Savings", icon: "🏦" }, { label: "Support", icon: "🎧" }],
};

const ROLE_THEME = { admin: "#365f7c", manager: "#2f8cf7", employee: "#4e73df", user: "#7c3aed" };
const PAGE_TITLE  = { admin: "Administrator Console", manager: "Manager's Dashboard", employee: "Employee Dashboard", user: "User Dashboard" };

// Dark-mode aware CSS variables injected at root
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
// ANIMATED COUNTER HOOK
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

  // Reconstruct with original prefix/suffix
  const prefix = String(target).match(/^[^0-9]*/)?.[0] || "";
  const suffix = String(target).match(/[^0-9.]+$/)?.[0] || "";
  const decimals = String(target).includes(".") ? String(target).split(".")[1]?.length || 0 : 0;
  return prefix + val.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOAST SYSTEM  (welcome · session warning · refresh)
// ═══════════════════════════════════════════════════════════════════════════════
function useToast() {
  const [toasts, setToasts] = React.useState([]);
  const add = React.useCallback((message, type = "info", duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((p) => [...p, { id, message, type }]);
    if (duration > 0) setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), duration);
    return id;
  }, []);
  const remove = React.useCallback((id) => setToasts((p) => p.filter((t) => t.id !== id)), []);
  return { toasts, add, remove };
}

function ToastContainer({ toasts, onRemove }) {
  if (!toasts.length) return null;
  return (
    <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 9999,
      display: "flex", flexDirection: "column", gap: 10, pointerEvents: "none" }}>
      {toasts.map((t) => (
        <div key={t.id} style={{
          background: t.type === "error" ? "#fef2f2" : t.type === "warning" ? "#fffbeb" : t.type === "success" ? "#f0fdf4" : "#f8fafc",
          borderLeft: `4px solid ${t.type === "error" ? "#ef4444" : t.type === "warning" ? "#f59e0b" : t.type === "success" ? "#10b981" : "#6366f1"}`,
          color: "#1e293b", padding: "12px 16px", borderRadius: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.14)", fontSize: 14, fontWeight: 500,
          minWidth: 280, display: "flex", alignItems: "center", gap: 10,
          pointerEvents: "all", animation: "slideInRight 0.3s ease" }}>
          <span style={{ fontSize: 18 }}>
            {t.type === "error" ? "🚨" : t.type === "warning" ? "⚠️" : t.type === "success" ? "✅" : "ℹ️"}
          </span>
          <span style={{ flex: 1 }}>{t.message}</span>
          <button onClick={() => onRemove(t.id)} style={{ background: "none", border: "none",
            cursor: "pointer", fontSize: 18, color: "#94a3b8", padding: 0, lineHeight: 1 }}>×</button>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE PAGE
// ═══════════════════════════════════════════════════════════════════════════════
function ProfilePage({ user, role, themeColor, dark, onClose }) {
  const empId = user.employeeId || user.employee_id || generateEmpId(user.sub);
  const [tab, setTab] = useState("info");

  const tabs = [{ id: "info", label: "Profile Info" }, { id: "security", label: "Security" }, { id: "prefs", label: "Preferences" }];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 8500,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={onClose}>
      <div style={{ background: dark ? "#1e293b" : "#fff", borderRadius: 22, width: "100%", maxWidth: 560,
        boxShadow: "0 30px 80px rgba(0,0,0,0.22)", overflow: "hidden", animation: "fadeDown 0.25s ease" }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header banner */}
        <div style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}bb)`,
          padding: "32px 32px 24px", position: "relative" }}>
          <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16,
            background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8,
            color: "#fff", cursor: "pointer", fontSize: 18, width: 32, height: 32,
            display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, fontWeight: 700, color: "#fff", border: "3px solid rgba(255,255,255,0.5)",
              flexShrink: 0 }}>
              {(user.name || "U").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>{user.name}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 3 }}>{user.email}</div>
              <span style={{ fontSize: 11, background: "rgba(255,255,255,0.2)", color: "#fff",
                borderRadius: 99, padding: "3px 10px", marginTop: 6, display: "inline-block",
                fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{role}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${dark ? "#334155" : "#f1f5f9"}`,
          padding: "0 24px" }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "12px 16px", fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? themeColor : (dark ? "#94a3b8" : "#64748b"),
              background: "none", border: "none", borderBottom: `2px solid ${tab === t.id ? themeColor : "transparent"}`,
              cursor: "pointer", transition: "all 0.2s" }}>{t.label}</button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ padding: "24px 32px", maxHeight: 360, overflowY: "auto" }}>
          {tab === "info" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                ["Full Name",    user.name                 ],
                ["Username",     user.preferred_username   ],
                ["Email",        user.email                ],
                ["Employee ID",  empId                     ],
                ["Role",         role.toUpperCase()        ],
                ["Account Sub",  user.sub?.slice(0, 18) + "…"],
              ].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between",
                  padding: "10px 14px", background: dark ? "#0f172a" : "#f8fafc",
                  borderRadius: 10 }}>
                  <span style={{ fontSize: 13, color: dark ? "#94a3b8" : "#64748b", fontWeight: 500 }}>{label}</span>
                  <span style={{ fontSize: 13, color: dark ? "#f1f5f9" : "#1e293b", fontWeight: 600 }}>{val || "—"}</span>
                </div>
              ))}
            </div>
          )}
          {tab === "security" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { label: "Two-Factor Auth", val: "Enabled", col: "#10b981" },
                { label: "Last Login",      val: "Today, 9:42 AM", col: null },
                { label: "Login Device",    val: "Chrome / Mumbai", col: null },
                { label: "Session Timeout", val: "15 minutes", col: null },
                { label: "Password Changed",val: "14 days ago", col: null },
              ].map(({ label, val, col }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between",
                  padding: "10px 14px", background: dark ? "#0f172a" : "#f8fafc", borderRadius: 10 }}>
                  <span style={{ fontSize: 13, color: dark ? "#94a3b8" : "#64748b", fontWeight: 500 }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: col || (dark ? "#f1f5f9" : "#1e293b") }}>{val}</span>
                </div>
              ))}
              <button style={{ marginTop: 4, padding: "10px 16px", background: "#fef2f2",
                color: "#ef4444", border: "none", borderRadius: 10, fontWeight: 600,
                fontSize: 13, cursor: "pointer" }}>🔑 Change Password</button>
            </div>
          )}
          {tab === "prefs" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { label: "Email Notifications", checked: true  },
                { label: "SMS Alerts",          checked: false },
                { label: "Login Alerts",        checked: true  },
                { label: "Monthly Reports",     checked: true  },
              ].map(({ label, checked }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "center", padding: "10px 14px",
                  background: dark ? "#0f172a" : "#f8fafc", borderRadius: 10 }}>
                  <span style={{ fontSize: 13, color: dark ? "#f1f5f9" : "#1e293b", fontWeight: 500 }}>{label}</span>
                  <div style={{ width: 40, height: 22, borderRadius: 11,
                    background: checked ? themeColor : "#e2e8f0",
                    position: "relative", cursor: "pointer" }}>
                    <div style={{ position: "absolute", top: 3, left: checked ? 21 : 3,
                      width: 16, height: 16, borderRadius: "50%", background: "#fff",
                      transition: "left 0.2s", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }} />
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
// SEARCH BAR (Ctrl+K)
// ═══════════════════════════════════════════════════════════════════════════════
function SearchBar({ role, onNavigate, dark }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");
  const inputRef          = useRef(null);
  const allItems          = useMemo(() => SIDEBAR_MENUS[role] || [], [role]);
  const filtered          = useMemo(() =>
    query.trim() === "" ? allItems : allItems.filter((i) => i.label.toLowerCase().includes(query.toLowerCase())),
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 8000,
      display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 100 }}
      onClick={() => setOpen(false)}>
      <div style={{ background: dark ? "#1e293b" : "#fff", borderRadius: 16, width: "100%", maxWidth: 480,
        boxShadow: "0 25px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px",
          borderBottom: `1px solid ${dark ? "#334155" : "#f1f5f9"}` }}>
          <span style={{ fontSize: 18, color: "#94a3b8" }}>🔍</span>
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search menu…" style={{ flex: 1, border: "none", outline: "none",
              fontSize: 15, color: dark ? "#f1f5f9" : "#1e293b", background: "transparent" }} />
          <kbd style={{ fontSize: 11, background: dark ? "#334155" : "#f1f5f9", borderRadius: 6,
            padding: "2px 6px", color: "#94a3b8", border: `1px solid ${dark ? "#475569" : "#e5e7eb"}` }}>ESC</kbd>
        </div>
        <div style={{ padding: 8, maxHeight: 300, overflowY: "auto" }}>
          {filtered.length === 0
            ? <div style={{ padding: "16px 12px", color: "#94a3b8", fontSize: 14, textAlign: "center" }}>No results</div>
            : filtered.map((item) => (
              <div key={item.label} onClick={() => { onNavigate(item.label); setOpen(false); setQuery(""); }}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                  borderRadius: 8, cursor: "pointer", fontSize: 14, color: dark ? "#f1f5f9" : "#475569" }}
                onMouseEnter={(e) => e.currentTarget.style.background = dark ? "#334155" : "#f8fafc"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <span style={{ fontSize: 18 }}>{item.icon}</span><span>{item.label}</span>
              </div>
            ))}
        </div>
        <div style={{ padding: "8px 18px", borderTop: `1px solid ${dark ? "#334155" : "#f1f5f9"}`,
          fontSize: 12, color: "#94a3b8", display: "flex", gap: 16 }}>
          <span>↵ select</span><span>ESC close</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
function Skeleton({ width = "100%", height = 16, radius = 8, style = {} }) {
  return <div style={{ width, height, borderRadius: radius, background: "linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite", ...style }} />;
}

function DashboardSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: "var(--bg-card)", borderRadius: 20, padding: "28px 32px", borderLeft: "6px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
          <Skeleton width="40%" height={24} /><Skeleton width="25%" height={14} /><Skeleton width="160px" height={28} radius={20} />
        </div>
        <Skeleton width={90} height={90} radius={12} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        {[1,2,3].map((i) => (
          <div key={i} style={{ background: "var(--bg-card)", borderRadius: 18, padding: 22, borderTop: "4px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
            <Skeleton width="60%" height={12} /><Skeleton width="45%" height={28} /><Skeleton width="100%" height={36} radius={4} />
          </div>
        ))}
      </div>
      <div style={{ background: "var(--bg-card)", borderRadius: 20, padding: 28, borderTop: "4px solid var(--border)" }}>
        <Skeleton width="30%" height={18} style={{ marginBottom: 20 }} /><Skeleton width="100%" height={250} radius={8} />
      </div>
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

function ProgressBar({ value, color }) {
  return (
    <div style={{ background: "var(--border)", borderRadius: 99, height: 7, width: "100%", overflow: "hidden" }}>
      <div style={{ width: `${value}%`, background: color, height: "100%", borderRadius: 99, transition: "width 0.8s ease" }} />
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
        const dash = seg.frac * circ, offset = circ - (seg.cumulative - seg.frac) * circ;
        return <circle key={seg.color + i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth="18" strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={offset} transform="rotate(-90 64 64)" style={{ transition: "stroke-dasharray 0.9s ease" }} />;
      })}
      <text x={cx} y={cy - 5} textAnchor="middle" fontSize="18" fontWeight="800" fill="var(--text-main)">{total.toLocaleString()}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="var(--text-sub)">{label}</text>
    </svg>
  );
}

function KpiCard({ label, val, trend, up, themeColor, children }) {
  const animated = useCountUp(val);
  return (
    <div className="glass-card" style={{ "--card-color": themeColor }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: up ? "#10b981" : "#ef4444",
          background: up ? "#d1fae5" : "#fee2e2", borderRadius: 99, padding: "2px 8px" }}>{trend}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text-main)", marginBottom: children ? 8 : 0 }}>{animated}</div>
      {children}
    </div>
  );
}

function ComingSoon({ item, themeColor }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: 340, gap: 16 }}>
      <div style={{ fontSize: 56 }}>{item?.icon || "📄"}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-main)" }}>{item?.label}</div>
      <div style={{ fontSize: 14, color: "var(--text-sub)", textAlign: "center", maxWidth: 300 }}>
        This section is coming soon. Stay tuned!
      </div>
      <div style={{ background: themeColor, color: "#fff", borderRadius: 99,
        padding: "8px 22px", fontSize: 13, fontWeight: 600 }}>Coming Soon</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// USER MANAGEMENT PAGE  (Admin → User Management menu item)
// ═══════════════════════════════════════════════════════════════════════════════
const INITIAL_USERS = [
  { id: 1,  name: "Alice Chen",   email: "alice@bank.io",   role: "User",    status: "Active",    last: "2 min ago",  av: "AC", dept: "Retail"    },
  { id: 2,  name: "Bob Reyes",    email: "bob@bank.io",     role: "Manager", status: "Active",    last: "14 min ago", av: "BR", dept: "Operations" },
  { id: 3,  name: "David Kim",    email: "david@bank.io",   role: "User",    status: "Suspended", last: "2 days ago", av: "DK", dept: "Retail"    },
  { id: 4,  name: "Emeka Osei",   email: "emeka@bank.io",   role: "Analyst", status: "Active",    last: "1h ago",     av: "EO", dept: "Analytics"  },
  { id: 5,  name: "Sara Mehta",   email: "sara@bank.io",    role: "User",    status: "Active",    last: "30 min ago", av: "SM", dept: "Retail"    },
  { id: 6,  name: "James Park",   email: "james@bank.io",   role: "Admin",   status: "Active",    last: "5 min ago",  av: "JP", dept: "IT"         },
  { id: 7,  name: "Nina Volkov",  email: "nina@bank.io",    role: "User",    status: "Inactive",  last: "1 week ago", av: "NV", dept: "HR"         },
  { id: 8,  name: "Carlos Diaz",  email: "carlos@bank.io",  role: "Analyst", status: "Active",    last: "3h ago",     av: "CD", dept: "Analytics"  },
];

function UserManagementPage({ themeColor }) {
  const [users, setUsers]         = useState(INITIAL_USERS);
  const [selected, setSelected]   = useState(new Set());
  const [search, setSearch]       = useState("");
  const [filterRole, setFilterRole]   = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [sortField, setSortField] = useState("name");
  const [sortAsc, setSortAsc]     = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTab, setAddTab]           = useState("single"); // "single" | "excel"
  const [newUser, setNewUser]         = useState({ name: "", email: "", role: "User", dept: "Retail" });
  const [importRows, setImportRows]   = useState([]); // parsed excel rows
  const [importErrors, setImportErrors] = useState([]);
  const [dragOver, setDragOver]       = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState(null);
  const [editingUser, setEditingUser]  = useState(null); // user object being edited
  const [toast, setToast]             = useState(null);
  const fileInputRef                  = useRef(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Filtered + sorted list
  const displayed = useMemo(() => {
    let list = users.filter((u) => {
      const q = search.toLowerCase();
      const matchSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q) || u.dept.toLowerCase().includes(q);
      const matchRole   = filterRole   === "All" || u.role   === filterRole;
      const matchStatus = filterStatus === "All" || u.status === filterStatus;
      return matchSearch && matchRole && matchStatus;
    });
    list = [...list].sort((a, b) => {
      const va = a[sortField]?.toLowerCase?.() ?? a[sortField];
      const vb = b[sortField]?.toLowerCase?.() ?? b[sortField];
      return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
    return list;
  }, [users, search, filterRole, filterStatus, sortField, sortAsc]);

  const allVisibleSelected = displayed.length > 0 && displayed.every((u) => selected.has(u.id));

  const toggleAll = () => {
    if (allVisibleSelected) {
      setSelected((p) => { const n = new Set(p); displayed.forEach((u) => n.delete(u.id)); return n; });
    } else {
      setSelected((p) => { const n = new Set(p); displayed.forEach((u) => n.add(u.id)); return n; });
    }
  };

  const toggleOne = (id) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const executeBulk = (action) => {
    setUsers((prev) => prev.map((u) => {
      if (!selected.has(u.id)) return u;
      if (action === "activate")  return { ...u, status: "Active"    };
      if (action === "suspend")   return { ...u, status: "Suspended" };
      if (action === "deactivate")return { ...u, status: "Inactive"  };
      return u;
    }).filter((u) => action !== "delete" || !selected.has(u.id)));
    showToast(`${action === "delete" ? "Deleted" : action.charAt(0).toUpperCase() + action.slice(1) + "d"} ${selected.size} user(s)`);
    setSelected(new Set());
    setBulkConfirm(null);
  };

  const handleSort = (field) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const addUser = () => {
    if (!newUser.name || !newUser.email) return;
    const initials = newUser.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    setUsers((p) => [...p, { ...newUser, id: Date.now(), status: "Active", last: "Just now", av: initials }]);
    showToast(`User "${newUser.name}" added successfully`);
    setNewUser({ name: "", email: "", role: "User", dept: "Retail" });
    setShowAddModal(false);
  };

  const saveEdit = () => {
    if (!editingUser.name || !editingUser.email) return;
    const initials = editingUser.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    setUsers((p) => p.map((u) => u.id === editingUser.id ? { ...editingUser, av: initials } : u));
    showToast(`User "${editingUser.name}" updated successfully`);
    setEditingUser(null);
  };

  // ── Excel / CSV parser (no external lib needed for CSV; use SheetJS for xlsx)
  const parseFile = (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();

    if (ext === "csv") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const lines = e.target.result.split("\n").map((l) => l.trim()).filter(Boolean);
        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/[^a-z]/g,""));
        const rows = lines.slice(1).map((line, idx) => {
          const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
          const obj = {};
          headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
          const name  = obj.name  || obj.fullname || obj.username || "";
          const email = obj.email || obj.emailaddress || "";
          const role  = ["Admin","Manager","Analyst","User"].find((r) => r.toLowerCase() === (obj.role||"").toLowerCase()) || "User";
          const dept  = obj.dept || obj.department || "Retail";
          const err   = !name ? "Missing name" : !email ? "Missing email" : !email.includes("@") ? "Invalid email" : "";
          return { _row: idx + 2, name, email, role, dept, _err: err };
        });
        setImportRows(rows);
        setImportErrors(rows.filter((r) => r._err));
      };
      reader.readAsText(file);
    } else if (ext === "xlsx" || ext === "xls") {
      // Use SheetJS (already available in project or cdn)
      import("https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs").then((XLSX) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const wb   = XLSX.read(e.target.result, { type: "array" });
          const ws   = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
          const rows = data.map((obj, idx) => {
            const keys = Object.keys(obj).reduce((a, k) => { a[k.toLowerCase().replace(/[^a-z]/g,"")] = obj[k]; return a; }, {});
            const name  = String(keys.name  || keys.fullname || keys.username || "").trim();
            const email = String(keys.email || keys.emailaddress || "").trim();
            const role  = ["Admin","Manager","Analyst","User"].find((r) => r.toLowerCase() === String(keys.role||"").toLowerCase()) || "User";
            const dept  = String(keys.dept || keys.department || "Retail").trim();
            const err   = !name ? "Missing name" : !email ? "Missing email" : !email.includes("@") ? "Invalid email" : "";
            return { _row: idx + 2, name, email, role, dept, _err: err };
          });
          setImportRows(rows);
          setImportErrors(rows.filter((r) => r._err));
        };
        reader.readAsArrayBuffer(file);
      }).catch(() => {
        showToast("Could not load Excel parser. Please use CSV format.", "error");
      });
    } else {
      showToast("Please upload a .xlsx, .xls or .csv file", "error");
    }
  };

  const importUsers = () => {
    const valid = importRows.filter((r) => !r._err);
    if (!valid.length) return;
    const newOnes = valid.map((r) => ({
      id: Date.now() + Math.random(),
      name:   r.name,
      email:  r.email,
      role:   r.role,
      dept:   r.dept,
      status: "Active",
      last:   "Just now",
      av:     r.name.split(" ").map((w) => w[0]).join("").slice(0,2).toUpperCase(),
    }));
    setUsers((p) => [...p, ...newOnes]);
    showToast(`✅ Imported ${valid.length} user${valid.length > 1 ? "s" : ""} successfully`);
    setImportRows([]);
    setImportErrors([]);
    setShowAddModal(false);
  };

  const downloadTemplate = () => {
    const csv = "Name,Email,Role,Department\nJane Smith,jane@bank.io,User,Retail\nJohn Doe,john@bank.io,Manager,Operations";
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "user_import_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const statusColor = (s) => s === "Active" ? { bg: "#d1fae5", col: "#10b981" } : s === "Suspended" ? { bg: "#fee2e2", col: "#ef4444" } : { bg: "#f1f5f9", col: "#94a3b8" };
  const roles   = ["All", "Admin", "Manager", "Analyst", "User"];
  const statuses = ["All", "Active", "Suspended", "Inactive"];
  const sortIcon = (f) => sortField === f ? (sortAsc ? " ↑" : " ↓") : " ↕";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* Inline toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
          background: toast.type === "success" ? "#10b981" : "#ef4444",
          color: "#fff", padding: "12px 24px", borderRadius: 12,
          fontWeight: 600, fontSize: 14, zIndex: 9999,
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)", animation: "slideInRight 0.3s ease" }}>
          {toast.type === "success" ? "✅" : "⚠️"} {toast.msg}
        </div>
      )}

      {/* Bulk confirm modal */}
      {bulkConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 8000,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--bg-card)", borderRadius: 18, padding: 32,
            maxWidth: 400, width: "90%", boxShadow: "0 24px 60px rgba(0,0,0,0.2)", animation: "fadeDown 0.2s ease" }}>
            <div style={{ fontSize: 40, marginBottom: 12, textAlign: "center" }}>
              {bulkConfirm.action === "delete" ? "🗑️" : "⚠️"}
            </div>
            <div style={{ fontWeight: 700, fontSize: 17, color: "var(--text-main)", textAlign: "center", marginBottom: 8 }}>
              {bulkConfirm.label} {selected.size} user{selected.size > 1 ? "s" : ""}?
            </div>
            <div style={{ fontSize: 13, color: "var(--text-sub)", textAlign: "center", marginBottom: 24 }}>
              This action will be applied to all selected users.
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button onClick={() => setBulkConfirm(null)}
                style={{ padding: "10px 24px", borderRadius: 10, border: "1px solid var(--border)",
                  background: "var(--hover-bg)", color: "var(--text-main)", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={() => executeBulk(bulkConfirm.action)}
                style={{ padding: "10px 24px", borderRadius: 10, border: "none",
                  background: bulkConfirm.action === "delete" ? "#ef4444" : themeColor,
                  color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Import User Modal */}
      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 8000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--bg-card)", borderRadius: 22, width: "100%", maxWidth: 560,
            boxShadow: "0 30px 80px rgba(0,0,0,0.25)", animation: "fadeDown 0.22s ease", overflow: "hidden" }}>

            {/* Modal header */}
            <div style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)`,
              padding: "22px 28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>Add Users</div>
              <button onClick={() => { setShowAddModal(false); setImportRows([]); setImportErrors([]); }}
                style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8,
                  color: "#fff", cursor: "pointer", fontSize: 18, width: 32, height: 32,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid var(--border)", padding: "0 28px" }}>
              {[["single","👤 Single User"],["excel","📊 Import from Excel / CSV"]].map(([id,label]) => (
                <button key={id} onClick={() => { setAddTab(id); setImportRows([]); setImportErrors([]); }}
                  style={{ padding: "14px 18px", fontSize: 13, fontWeight: addTab===id ? 700 : 500,
                    color: addTab===id ? themeColor : "var(--text-sub)",
                    background: "none", border: "none",
                    borderBottom: `2px solid ${addTab===id ? themeColor : "transparent"}`,
                    cursor: "pointer", whiteSpace: "nowrap" }}>{label}</button>
              ))}
            </div>

            <div style={{ padding: "24px 28px", maxHeight: "65vh", overflowY: "auto" }}>

              {/* ── SINGLE USER TAB ── */}
              {addTab === "single" && (
                <>
                  {[["Full Name","name","text","e.g. Jane Smith"],["Email","email","email","e.g. jane@bank.io"]].map(([label,key,type,ph]) => (
                    <div key={key} style={{ marginBottom: 16 }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-sub)", display: "block", marginBottom: 6 }}>{label}</label>
                      <input type={type} placeholder={ph} value={newUser[key]}
                        onChange={(e) => setNewUser((p) => ({ ...p, [key]: e.target.value }))}
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 14,
                          border: "1px solid var(--border)", background: "var(--hover-bg)",
                          color: "var(--text-main)", outline: "none" }} />
                    </div>
                  ))}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
                    {[["Role","role",["User","Manager","Analyst","Admin"]],["Department","dept",["Retail","Operations","Analytics","IT","HR"]]].map(([label,key,opts]) => (
                      <div key={key}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-sub)", display: "block", marginBottom: 6 }}>{label}</label>
                        <select value={newUser[key]} onChange={(e) => setNewUser((p) => ({ ...p, [key]: e.target.value }))}
                          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 14,
                            border: "1px solid var(--border)", background: "var(--hover-bg)",
                            color: "var(--text-main)", outline: "none" }}>
                          {opts.map((o) => <option key={o}>{o}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <button onClick={() => setShowAddModal(false)}
                      style={{ flex: 1, padding: "11px", borderRadius: 10, border: "1px solid var(--border)",
                        background: "var(--hover-bg)", color: "var(--text-main)", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                      Cancel
                    </button>
                    <button onClick={addUser}
                      style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none",
                        background: themeColor, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                      Add User
                    </button>
                  </div>
                </>
              )}

              {/* ── EXCEL / CSV TAB ── */}
              {addTab === "excel" && (
                <>
                  {/* Download template */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <span style={{ fontSize: 13, color: "var(--text-sub)" }}>
                      Upload an Excel (.xlsx) or CSV file with columns: <b>Name, Email, Role, Department</b>
                    </span>
                    <button onClick={downloadTemplate}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
                        borderRadius: 8, border: `1px solid ${themeColor}`, background: themeColor + "15",
                        color: themeColor, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                      ⬇ Download Template
                    </button>
                  </div>

                  {/* Drop zone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault(); setDragOver(false);
                      const file = e.dataTransfer.files[0];
                      if (file) parseFile(file);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: `2px dashed ${dragOver ? themeColor : "var(--border)"}`,
                      borderRadius: 14, padding: "36px 24px", textAlign: "center",
                      background: dragOver ? themeColor + "08" : "var(--hover-bg)",
                      cursor: "pointer", transition: "all 0.2s", marginBottom: 16,
                    }}>
                    <div style={{ fontSize: 40, marginBottom: 10 }}>📂</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-main)", marginBottom: 4 }}>
                      {dragOver ? "Drop your file here" : "Drag & drop or click to upload"}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-sub)" }}>
                      Supports .xlsx, .xls, .csv
                    </div>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv"
                      style={{ display: "none" }}
                      onChange={(e) => { const f = e.target.files[0]; if (f) parseFile(f); e.target.value = ""; }} />
                  </div>

                  {/* Preview table */}
                  {importRows.length > 0 && (
                    <>
                      {/* Summary */}
                      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, padding: "4px 12px", borderRadius: 99,
                          background: "#d1fae5", color: "#10b981", fontWeight: 700 }}>
                          ✅ {importRows.filter((r) => !r._err).length} valid
                        </span>
                        {importErrors.length > 0 && (
                          <span style={{ fontSize: 13, padding: "4px 12px", borderRadius: 99,
                            background: "#fee2e2", color: "#ef4444", fontWeight: 700 }}>
                            ⚠️ {importErrors.length} error{importErrors.length > 1 ? "s" : ""}
                          </span>
                        )}
                        <span style={{ fontSize: 13, color: "var(--text-sub)" }}>
                          from {importRows.length} rows
                        </span>
                      </div>

                      {/* Table */}
                      <div style={{ overflowX: "auto", borderRadius: 10,
                        border: "1px solid var(--border)", marginBottom: 20 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                          <thead>
                            <tr style={{ background: "var(--hover-bg)" }}>
                              {["Row","Name","Email","Role","Dept","Status"].map((h) => (
                                <th key={h} style={{ padding: "9px 12px", textAlign: "left",
                                  fontSize: 11, fontWeight: 700, color: "var(--text-sub)",
                                  textTransform: "uppercase", letterSpacing: 0.5,
                                  borderBottom: "1px solid var(--border)" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {importRows.map((r, i) => (
                              <tr key={i} style={{ borderBottom: "1px solid var(--border)",
                                background: r._err ? "#fef2f2" : "transparent" }}>
                                <td style={{ padding: "8px 12px", color: "var(--text-sub)" }}>{r._row}</td>
                                <td style={{ padding: "8px 12px", color: "var(--text-main)", fontWeight: 500 }}>{r.name || "—"}</td>
                                <td style={{ padding: "8px 12px", color: "var(--text-sub)" }}>{r.email || "—"}</td>
                                <td style={{ padding: "8px 12px" }}>
                                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99,
                                    background: "var(--hover-bg)", color: "var(--text-main)", fontWeight: 600 }}>{r.role}</span>
                                </td>
                                <td style={{ padding: "8px 12px", color: "var(--text-sub)" }}>{r.dept}</td>
                                <td style={{ padding: "8px 12px" }}>
                                  {r._err
                                    ? <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 600 }}>⚠️ {r._err}</span>
                                    : <span style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>✅ OK</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Error details */}
                      {importErrors.length > 0 && (
                        <div style={{ background: "#fef2f2", borderRadius: 10, padding: "12px 16px",
                          marginBottom: 16, fontSize: 13, color: "#ef4444" }}>
                          <b>Fix these before importing:</b>
                          <ul style={{ margin: "6px 0 0 18px", lineHeight: 1.8 }}>
                            {importErrors.map((e, i) => (
                              <li key={i}>Row {e._row}: {e._err} {e.name ? `(${e.name})` : ""}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 12 }}>
                        <button onClick={() => { setImportRows([]); setImportErrors([]); }}
                          style={{ flex: 1, padding: "11px", borderRadius: 10, border: "1px solid var(--border)",
                            background: "var(--hover-bg)", color: "var(--text-main)", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                          Clear & Re-upload
                        </button>
                        <button onClick={importUsers}
                          disabled={importRows.filter((r) => !r._err).length === 0}
                          style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none",
                            background: importRows.filter((r) => !r._err).length === 0 ? "#e2e8f0" : themeColor,
                            color: importRows.filter((r) => !r._err).length === 0 ? "#94a3b8" : "#fff",
                            fontWeight: 700, fontSize: 14, cursor: importRows.filter((r) => !r._err).length === 0 ? "not-allowed" : "pointer" }}>
                          Import {importRows.filter((r) => !r._err).length} User{importRows.filter((r) => !r._err).length !== 1 ? "s" : ""}
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT USER MODAL ── */}
      {editingUser && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 8000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--bg-card)", borderRadius: 22, width: "100%", maxWidth: 500,
            boxShadow: "0 30px 80px rgba(0,0,0,0.25)", animation: "fadeDown 0.22s ease", overflow: "hidden" }}>

            {/* Header */}
            <div style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)`,
              padding: "22px 28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                  {editingUser.av}
                </div>
                <div>
                  <div style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>Edit User</div>
                  <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 2 }}>{editingUser.email}</div>
                </div>
              </div>
              <button onClick={() => setEditingUser(null)}
                style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8,
                  color: "#fff", cursor: "pointer", fontSize: 18, width: 32, height: 32,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>

            {/* Body */}
            <div style={{ padding: "24px 28px" }}>

              {/* Name + Email */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                {[["Full Name","name","text","e.g. Jane Smith"],["Email","email","email","e.g. jane@bank.io"]].map(([label,key,type,ph]) => (
                  <div key={key}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-sub)",
                      display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</label>
                    <input type={type} placeholder={ph} value={editingUser[key] || ""}
                      onChange={(e) => setEditingUser((p) => ({ ...p, [key]: e.target.value }))}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 14,
                        border: `1px solid ${editingUser[key] ? "var(--border)" : "#ef4444"}`,
                        background: "var(--hover-bg)", color: "var(--text-main)", outline: "none",
                        boxSizing: "border-box" }} />
                    {!editingUser[key] && (
                      <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>Required</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Role + Department + Status */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
                {[
                  ["Role",       "role",   ["User","Manager","Analyst","Admin"]],
                  ["Department", "dept",   ["Retail","Operations","Analytics","IT","HR"]],
                  ["Status",     "status", ["Active","Suspended","Inactive"]],
                ].map(([label, key, opts]) => (
                  <div key={key}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-sub)",
                      display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</label>
                    <select value={editingUser[key]} onChange={(e) => setEditingUser((p) => ({ ...p, [key]: e.target.value }))}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 14,
                        border: "1px solid var(--border)", background: "var(--hover-bg)",
                        color: key === "status"
                          ? editingUser.status === "Active" ? "#10b981" : editingUser.status === "Suspended" ? "#ef4444" : "#94a3b8"
                          : "var(--text-main)",
                        fontWeight: key === "status" ? 700 : 400,
                        outline: "none" }}>
                      {opts.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {/* Preview badge row */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
                background: "var(--hover-bg)", borderRadius: 12, marginBottom: 22 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: themeColor,
                  color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                  {editingUser.name?.split(" ").map((w) => w[0]).join("").slice(0,2).toUpperCase() || "?"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-main)" }}>{editingUser.name || "—"}</div>
                  <div style={{ fontSize: 12, color: "var(--text-sub)" }}>{editingUser.email || "—"} · {editingUser.dept}</div>
                </div>
                <span style={{ fontSize: 12, padding: "3px 12px", borderRadius: 99, fontWeight: 600,
                  background: "var(--bg-card)", color: "var(--text-main)", border: "1px solid var(--border)" }}>
                  {editingUser.role}
                </span>
                <span style={{ fontSize: 12, padding: "3px 12px", borderRadius: 99, fontWeight: 700,
                  background: editingUser.status === "Active" ? "#d1fae5" : editingUser.status === "Suspended" ? "#fee2e2" : "#f1f5f9",
                  color:      editingUser.status === "Active" ? "#10b981" : editingUser.status === "Suspended" ? "#ef4444" : "#94a3b8" }}>
                  {editingUser.status}
                </span>
              </div>

              {/* Buttons */}
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setEditingUser(null)}
                  style={{ flex: 1, padding: "11px", borderRadius: 10, border: "1px solid var(--border)",
                    background: "var(--hover-bg)", color: "var(--text-main)", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                  Cancel
                </button>
                <button onClick={saveEdit}
                  disabled={!editingUser.name || !editingUser.email}
                  style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none",
                    background: !editingUser.name || !editingUser.email ? "#e2e8f0" : themeColor,
                    color: !editingUser.name || !editingUser.email ? "#94a3b8" : "#fff",
                    fontWeight: 700, fontSize: 14,
                    cursor: !editingUser.name || !editingUser.email ? "not-allowed" : "pointer" }}>
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {[
          { label: "Total Users",   val: users.length,                                          icon: "👥", col: themeColor },
          { label: "Active",        val: users.filter((u) => u.status === "Active").length,      icon: "🟢", col: "#10b981" },
          { label: "Suspended",     val: users.filter((u) => u.status === "Suspended").length,   icon: "🔴", col: "#ef4444" },
          { label: "Inactive",      val: users.filter((u) => u.status === "Inactive").length,    icon: "⚫", col: "#94a3b8" },
        ].map((s) => (
          <div key={s.label} className="glass-card" style={{ "--card-color": s.col, padding: "16px 18px" }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text-main)" }}>{s.val}</div>
            <div style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Main table card */}
      <div className="glass-card" style={{ "--card-color": themeColor, padding: "22px 24px" }}>

        {/* Toolbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text-main)" }}>
            User Management
            {selected.size > 0 && (
              <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 600,
                background: themeColor + "20", color: themeColor, borderRadius: 99, padding: "2px 10px" }}>
                {selected.size} selected
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {/* Search */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--hover-bg)",
              borderRadius: 10, padding: "8px 14px", border: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text-sub)" }}>🔍</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users…" style={{ border: "none", outline: "none", fontSize: 13,
                  background: "transparent", color: "var(--text-main)", width: 160 }} />
            </div>
            {/* Role filter */}
            <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)",
                background: "var(--hover-bg)", color: "var(--text-main)", fontSize: 13, cursor: "pointer" }}>
              {roles.map((r) => <option key={r}>{r}</option>)}
            </select>
            {/* Status filter */}
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)",
                background: "var(--hover-bg)", color: "var(--text-main)", fontSize: 13, cursor: "pointer" }}>
              {statuses.map((s) => <option key={s}>{s}</option>)}
            </select>
            {/* Add User */}
            <button onClick={() => setShowAddModal(true)}
              style={{ background: themeColor, color: "#fff", border: "none", borderRadius: 10,
                padding: "8px 16px", fontSize: 13, cursor: "pointer", fontWeight: 700,
                display: "flex", alignItems: "center", gap: 6 }}>
              + Add User
            </button>
          </div>
        </div>

        {/* Bulk action bar — shows only when rows selected */}
        {selected.size > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
            background: themeColor + "12", borderRadius: 10, marginBottom: 14,
            border: `1px solid ${themeColor}30`, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-main)" }}>
              {selected.size} user{selected.size > 1 ? "s" : ""} selected — Bulk actions:
            </span>
            {[
              { label: "✅ Activate",   action: "activate",   col: "#10b981" },
              { label: "⏸ Suspend",    action: "suspend",    col: "#f97316" },
              { label: "🚫 Deactivate",action: "deactivate", col: "#94a3b8" },
              { label: "🗑️ Delete",    action: "delete",     col: "#ef4444" },
            ].map((b) => (
              <button key={b.action}
                onClick={() => setBulkConfirm({ action: b.action, label: b.label.split(" ")[1] })}
                style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${b.col}40`,
                  background: b.col + "15", color: b.col, fontSize: 12,
                  fontWeight: 700, cursor: "pointer" }}>
                {b.label}
              </button>
            ))}
            <button onClick={() => setSelected(new Set())}
              style={{ marginLeft: "auto", padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)",
                background: "var(--hover-bg)", color: "var(--text-sub)", fontSize: 12, cursor: "pointer" }}>
              Clear
            </button>
          </div>
        )}

        {/* Table header */}
        <div style={{ display: "grid", gridTemplateColumns: "40px 2fr 1.5fr 1fr 1fr 1fr 90px",
          gap: 12, padding: "8px 12px", borderBottom: "2px solid var(--border)", marginBottom: 4 }}>
          {/* Select all checkbox */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll}
              style={{ width: 16, height: 16, cursor: "pointer", accentColor: themeColor }} />
          </div>
          {[["name","Name"], ["email","Email"], ["role","Role"], ["dept","Dept."], ["status","Status"]].map(([f, l]) => (
            <div key={f} onClick={() => handleSort(f)}
              style={{ fontSize: 11, fontWeight: 700, color: "var(--text-sub)",
                textTransform: "uppercase", letterSpacing: 0.6, cursor: "pointer",
                userSelect: "none", display: "flex", alignItems: "center", gap: 2 }}>
              {l}<span style={{ opacity: 0.6 }}>{sortIcon(f)}</span>
            </div>
          ))}
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-sub)",
            textTransform: "uppercase", letterSpacing: 0.6 }}>Actions</div>
        </div>

        {/* Table rows */}
        {displayed.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-sub)", fontSize: 14 }}>
            No users match your filters.
          </div>
        ) : displayed.map((u) => {
          const sc   = statusColor(u.status);
          const isSel = selected.has(u.id);
          return (
            <div key={u.id}
              style={{ display: "grid", gridTemplateColumns: "40px 2fr 1.5fr 1fr 1fr 1fr 90px",
                gap: 12, padding: "11px 12px", borderRadius: 10, alignItems: "center",
                background: isSel ? themeColor + "10" : "transparent",
                borderBottom: "1px solid var(--border)",
                transition: "background 0.15s", cursor: "default" }}
              onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = "var(--hover-bg)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = isSel ? themeColor + "10" : "transparent"; }}>

              <input type="checkbox" checked={isSel} onChange={() => toggleOne(u.id)}
                style={{ width: 16, height: 16, cursor: "pointer", accentColor: themeColor }} />

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: themeColor,
                  color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{u.av}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-main)" }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-sub)" }}>{u.last}</div>
                </div>
              </div>

              <div style={{ fontSize: 13, color: "var(--text-sub)", overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>

              <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 99,
                background: "var(--hover-bg)", color: "var(--text-main)", fontWeight: 600,
                display: "inline-block" }}>{u.role}</span>

              <div style={{ fontSize: 12, color: "var(--text-sub)" }}>{u.dept}</div>

              <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 99,
                background: sc.bg, color: sc.col, fontWeight: 700, display: "inline-block" }}>
                {u.status}
              </span>

              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setEditingUser({ ...u })}
                  title="Edit user"
                  style={{ background: "var(--hover-bg)", border: "1px solid var(--border)",
                    borderRadius: 7, width: 30, height: 30, cursor: "pointer",
                    fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  ✏️
                </button>
                <button onClick={() => { setUsers((p) => p.filter((x) => x.id !== u.id)); showToast(`Deleted ${u.name}`); }}
                  title="Delete user"
                  style={{ background: "var(--hover-bg)", border: "1px solid var(--border)",
                    borderRadius: 7, width: 30, height: 30, cursor: "pointer",
                    fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  🗑️
                </button>
              </div>
            </div>
          );
        })}

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
          marginTop: 16, fontSize: 13, color: "var(--text-sub)" }}>
          <span>Showing {displayed.length} of {users.length} users</span>
          <span>{selected.size > 0 ? `${selected.size} selected` : "No selection"}</span>
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
  const kpis    = [
    { label: "Total Users",     val: "14,203", trend: "+8%",  up: true  },
    { label: "Active Sessions", val: "384",    trend: "+15%", up: true  },
    { label: "Failed Logins",   val: "23",     trend: "-41%", up: true  },
    { label: "Audit Events",    val: "1,204",  trend: "+2%",  up: false },
  ];
  const users   = [
    { name: "Alice Chen",  email: "alice@bank.io",  role: "User",    status: "Active",    last: "2m ago",   av: "AC" },
    { name: "Bob Reyes",   email: "bob@bank.io",    role: "Manager", status: "Active",    last: "14m ago",  av: "BR" },
    { name: "David Kim",   email: "david@bank.io",  role: "User",    status: "Suspended", last: "2 days",   av: "DK" },
    { name: "Emeka Osei",  email: "emeka@bank.io",  role: "Analyst", status: "Active",    last: "1h ago",   av: "EO" },
  ];
  const auditLogs = [
    { icon: "🔑", ev: "Admin login",    actor: user?.preferred_username || "admin", time: "Just now",  col: "#10b981" },
    { icon: "🛡️", ev: "Role updated",  actor: "system",                             time: "5 min ago", col: "#f97316" },
    { icon: "🚫", ev: "Failed login",  actor: "unknown",                             time: "12 min",    col: "#ef4444" },
    { icon: "📤", ev: "Data export",   actor: "manager01",                           time: "1h ago",    col: "#6366f1" },
    { icon: "💾", ev: "Backup",        actor: "system",                              time: "3h ago",    col: "#10b981" },
  ];
  return (
    <>
      <div className="welcome-card" style={{ borderLeft: `6px solid ${themeColor}`, flexWrap: "wrap", gap: 24 }}>
        {[{ label: "System Status", val: "🟢 Operational" }, { label: "Active Sessions", val: "384" }, { label: "DB Uptime", val: "99.9%" }, { label: "Last Backup", val: "3h ago" }, { label: "Pending Alerts", val: "⚠️ 3 Critical" }]
          .map(({ label, val }) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-main)" }}>{val}</span>
            </div>
          ))}
      </div>
      <div className="card-row" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        {kpis.map((k) => <KpiCard key={k.label} {...k} themeColor={themeColor} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
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
          {[{ label: "CPU Usage", val: 34, color: themeColor }, { label: "Memory", val: 61, color: "#f97316" }, { label: "Disk", val: 48, color: "#10b981" }, { label: "Network I/O", val: 72, color: "#6366f1" }].map((m) => (
            <div key={m.label} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 13, color: "var(--text-sub)" }}>{m.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: m.color }}>{m.val}%</span>
              </div>
              <ProgressBar value={m.val} color={m.color} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        <div className="glass-card" style={{ "--card-color": themeColor }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ color: themeColor, margin: 0 }}>User Management</h3>
            <button style={{ background: themeColor, color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>+ Add User</button>
          </div>
          {users.map((u, i) => (
            <div key={u.email} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < users.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: themeColor, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{u.av}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-main)" }}>{u.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-sub)" }}>{u.email}</div>
              </div>
              <span style={{ fontSize: 12, padding: "2px 10px", borderRadius: 99, background: u.status === "Active" ? "#d1fae5" : "#fee2e2", color: u.status === "Active" ? "#10b981" : "#ef4444", fontWeight: 600 }}>{u.status}</span>
              <span style={{ fontSize: 12, color: "var(--text-sub)", minWidth: 60 }}>{u.last}</span>
              <div style={{ display: "flex", gap: 4 }}>
                {["✏️","🗑️"].map((ic) => <button key={ic} style={{ background: "var(--hover-bg)", border: "none", borderRadius: 6, width: 28, height: 28, cursor: "pointer", fontSize: 14 }}>{ic}</button>)}
              </div>
            </div>
          ))}
        </div>
        <div className="glass-card" style={{ "--card-color": themeColor }}>
          <h3 style={{ color: themeColor, marginBottom: 16 }}>Audit Log</h3>
          {auditLogs.map((e) => (
            <div key={e.ev} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${e.col}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{e.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-main)" }}>{e.ev}</div>
                <div style={{ fontSize: 12, color: "var(--text-sub)" }}>by {e.actor}</div>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-sub)" }}>{e.time}</div>
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
  const kpis    = [
    { label: "Total Revenue",    val: "$284K", trend: "+12%", up: true  },
    { label: "Managed Accounts", val: "1,482", trend: "+4%",  up: true  },
    { label: "Invoices Sent",    val: "327",   trend: "-3%",  up: false },
    { label: "Open Tickets",     val: "14",    trend: "-22%", up: true  },
  ];
  const team    = [{ name: "Sarah Johnson", role: "Senior Analyst", perf: 92, av: "SJ" }, { name: "Mike Chen", role: "Risk Manager", perf: 85, av: "MC" }, { name: "Priya Patel", role: "Compliance Lead", perf: 78, av: "PP" }, { name: "James Lee", role: "Client Relations", perf: 95, av: "JL" }];
  const invoices= [{ id: "#INV-0041", client: "Acme Corp", amt: "$4,200", status: "Paid" }, { id: "#INV-0040", client: "Globex Ltd", amt: "$1,800", status: "Pending" }, { id: "#INV-0039", client: "Initech", amt: "$9,500", status: "Paid" }, { id: "#INV-0038", client: "Umbrella Inc", amt: "$640", status: "Overdue" }];
  return (
    <>
      <div className="card-row" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        {kpis.map((k) => <KpiCard key={k.label} {...k} themeColor={themeColor} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        <div className="chart-card" style={{ "--chart-color": themeColor }}>
          <h3 style={{ color: themeColor }}>Revenue vs Target</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData}>
              <XAxis dataKey="month" /><YAxis /><Tooltip /><Legend />
              <Line type="monotone" dataKey="revenue" stroke={themeColor}  strokeWidth={3} dot={{ fill: themeColor, r: 4 }} />
              <Line type="monotone" dataKey="target"  stroke="#e2e8f0"     strokeWidth={2} strokeDasharray="6 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-card" style={{ "--card-color": themeColor }}>
          <h3 style={{ color: themeColor, marginBottom: 16 }}>Spend Mix</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <DonutRing total={6870} label="Total" segments={[{ value: 1332, color: themeColor }, { value: 2302, color: "#a78bfa" }, { value: 1899, color: "#38bdf8" }, { value: 1337, color: "#fb923c" }]} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[["Online","$1,332",themeColor],["Entertain","$2,302","#a78bfa"],["Services","$1,899","#38bdf8"],["Shopping","$1,337","#fb923c"]].map(([l,v,c]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: c, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, color: "var(--text-sub)" }}>{l}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)" }}>{v}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        <div className="glass-card" style={{ "--card-color": themeColor }}>
          <h3 style={{ color: themeColor, marginBottom: 16 }}>Team Performance</h3>
          {team.map((m) => (
            <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: themeColor, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{m.av}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-main)" }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-sub)" }}>{m.role}</div>
                  </div>
                  <span style={{ fontWeight: 700, color: themeColor }}>{m.perf}%</span>
                </div>
                <ProgressBar value={m.perf} color={themeColor} />
              </div>
            </div>
          ))}
        </div>
        <div className="glass-card" style={{ "--card-color": themeColor }}>
          <h3 style={{ color: themeColor, marginBottom: 16 }}>Recent Invoices</h3>
          {invoices.map((inv, i) => (
            <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < invoices.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-main)" }}>{inv.id}</div>
                <div style={{ fontSize: 12, color: "var(--text-sub)" }}>{inv.client}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-main)", marginBottom: 4 }}>{inv.amt}</div>
                <span style={{ fontSize: 12, padding: "2px 10px", borderRadius: 99, fontWeight: 600, background: inv.status === "Paid" ? "#d1fae5" : inv.status === "Overdue" ? "#fee2e2" : "#fef9c3", color: inv.status === "Paid" ? "#10b981" : inv.status === "Overdue" ? "#ef4444" : "#ca8a04" }}>{inv.status}</span>
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
  const empId = user.employeeId || user.employee_id || generateEmpId(user.sub);
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
          {[["Name", user.name], ["Email", user.email], ["Employee ID", empId], ["Username", user.preferred_username]].map(([l,v]) => (
            <p key={l}><b>{l}:</b> {v}</p>
          ))}
        </div>
        <div className="glass-card" style={{ "--card-color": themeColor }}>
          <h3 style={{ color: themeColor }}>Recent Transactions</h3>
          {transactions.map((tx) => (
            <div key={tx.name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 20 }}>{tx.icon}</span>
              <span style={{ flex: 1, fontSize: 13, color: "var(--text-sub)" }}>{tx.name}</span>
              <span style={{ fontWeight: 700, fontSize: 13, color: tx.col }}>{tx.amt}</span>
            </div>
          ))}
        </div>
        <div className="glass-card" style={{ "--card-color": themeColor }}>
          <h3 style={{ color: themeColor }}>Status</h3>
          <p style={{ marginBottom: 6 }}>🟢 Active</p>
          <p>🔒 Protected</p>
          <h3 style={{ color: themeColor, marginTop: 16, marginBottom: 8 }}>Quick Actions</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[["💸","Send"],["📥","Receive"],["🔄","Exchange"],["📋","Statement"]].map(([ic,l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px",
                background: "var(--hover-bg)", borderRadius: 8, cursor: "pointer", fontSize: 13,
                color: "var(--text-sub)", fontWeight: 500 }}
                onMouseEnter={(e) => e.currentTarget.style.background = `${themeColor}15`}
                onMouseLeave={(e) => e.currentTarget.style.background = "var(--hover-bg)"}>
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
            <Area type="monotone" dataKey="target"  stroke="#e2e8f0"   fill="none"       strokeWidth={2} strokeDasharray="6 4" />
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
  const empId = user.employeeId || user.employee_id || generateEmpId(user.sub);
  const spendData = [
    { name: "Food",      value: 340, color: "#f97316" },
    { name: "Shopping",  value: 520, color: themeColor },
    { name: "Bills",     value: 280, color: "#ef4444"  },
    { name: "Subs",      value: 160, color: "#10b981"  },
    { name: "Travel",    value: 190, color: "#6366f1"  },
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
  return (
    <>
      {/* Balance hero */}
      <div className="glass-card" style={{ "--card-color": themeColor, background: `linear-gradient(135deg, ${themeColor}12, var(--bg-card))` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, color: "var(--text-sub)", marginBottom: 4 }}>Total Balance</div>
            <div style={{ fontSize: 38, fontWeight: 900, color: "var(--text-main)" }}>
              $24,830<span style={{ fontSize: 20, fontWeight: 600, color: "var(--text-sub)" }}>.50</span>
            </div>
            <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
              <div><span style={{ fontSize: 12, color: "var(--text-sub)" }}>Income </span><span style={{ fontWeight: 700, color: "#10b981" }}>+$3,240</span></div>
              <div><span style={{ fontSize: 12, color: "var(--text-sub)" }}>Expenses </span><span style={{ fontWeight: 700, color: "#ef4444" }}>-$1,890</span></div>
            </div>
          </div>
          <div style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}bb)`,
            borderRadius: 16, padding: "20px 28px", color: "#fff", minWidth: 210, boxShadow: `0 12px 30px ${themeColor}40` }}>
            <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 10, letterSpacing: 3 }}>•••• •••• •••• 4291</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Visa Platinum</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{user.name}</div>
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
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 20 }}>
        <div className="glass-card" style={{ "--card-color": themeColor }}>
          <h3 style={{ color: themeColor, marginBottom: 14 }}>Recent Transactions</h3>
          {txns.map((tx) => (
            <div key={tx.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: `${tx.col}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{tx.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-main)" }}>{tx.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-sub)" }}>{tx.cat} · {tx.date}</div>
              </div>
              <span style={{ fontWeight: 700, fontSize: 14, color: tx.col }}>{tx.amt}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {spendData.map((s) => (
                <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-sub)" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }} />
                  {s.name}
                </div>
              ))}
            </div>
          </div>
          <div className="glass-card" style={{ "--card-color": themeColor }}>
            <h3 style={{ color: themeColor, marginBottom: 10 }}>Account Info</h3>
            <p><b>Name:</b> {user.name}</p>
            <p><b>Email:</b> {user.email}</p>
            <p><b>Account ID:</b> {empId}</p>
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
const SAMPLE_NOTIFICATIONS = [
  { id: 1, icon: "💰", title: "Salary Credited",       body: "₹85,000 credited to your account",  time: "2 min ago",  unread: true,  color: "#10b981" },
  { id: 2, icon: "🔐", title: "Login from new device", body: "Chrome · Mumbai · Mar 7 2026",       time: "15 min ago", unread: true,  color: "#f97316" },
  { id: 3, icon: "📄", title: "Invoice #INV-0041 Paid",body: "Acme Corp paid $4,200",              time: "1h ago",     unread: true,  color: "#6366f1" },
  { id: 4, icon: "⚠️", title: "Failed login attempt",  body: "3 failed attempts detected",         time: "3h ago",     unread: false, color: "#ef4444" },
  { id: 5, icon: "🔄", title: "Session refreshed",     body: "Your session was auto-renewed",      time: "5h ago",     unread: false, color: "#2f8cf7" },
  { id: 6, icon: "✅", title: "Profile updated",       body: "Your profile info was saved",        time: "Yesterday",  unread: false, color: "#10b981" },
];

function NotificationsPanel({ open, onClose, themeColor, dark }) {
  const [notes, setNotes] = React.useState(SAMPLE_NOTIFICATIONS);
  const unread = notes.filter((n) => n.unread).length;
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 7000 }} onClick={onClose}>
      <div style={{ position: "absolute", top: 68, right: 20, width: 360,
        background: dark ? "#1e293b" : "#fff", borderRadius: 18,
        boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
        border: `1px solid ${dark ? "#334155" : "#e5e7eb"}`,
        overflow: "hidden", animation: "fadeDown 0.2s ease" }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 20px", borderBottom: `1px solid ${dark ? "#334155" : "#f1f5f9"}` }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: dark ? "#f1f5f9" : "#1e293b" }}>
            Notifications
            {unread > 0 && <span style={{ background: "#ef4444", color: "#fff", borderRadius: 99,
              fontSize: 11, padding: "1px 7px", marginLeft: 6 }}>{unread}</span>}
          </div>
          <button onClick={() => setNotes((p) => p.map((n) => ({ ...n, unread: false })))}
            style={{ fontSize: 12, color: themeColor, background: "none", border: "none",
              cursor: "pointer", fontWeight: 600 }}>Mark all read</button>
        </div>
        <div style={{ maxHeight: 380, overflowY: "auto" }}>
          {notes.map((n) => (
            <div key={n.id}
              onClick={() => setNotes((p) => p.map((x) => x.id === n.id ? { ...x, unread: false } : x))}
              style={{ display: "flex", gap: 12, padding: "13px 20px", cursor: "pointer",
                background: n.unread ? (dark ? "#1e3a4a" : `${n.color}08`) : "transparent",
                borderBottom: `1px solid ${dark ? "#334155" : "#f8fafc"}`, transition: "background 0.15s" }}
              onMouseEnter={(e) => e.currentTarget.style.background = dark ? "#263348" : "#f8fafc"}
              onMouseLeave={(e) => e.currentTarget.style.background = n.unread ? (dark ? "#1e3a4a" : `${n.color}08`) : "transparent"}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: `${n.color}18`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{n.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: dark ? "#f1f5f9" : "#1e293b" }}>{n.title}</span>
                  {n.unread && <div style={{ width: 8, height: 8, borderRadius: "50%", background: themeColor, flexShrink: 0 }} />}
                </div>
                <div style={{ fontSize: 12, color: dark ? "#94a3b8" : "#64748b", marginTop: 2 }}>{n.body}</div>
                <div style={{ fontSize: 11, color: dark ? "#64748b" : "#94a3b8", marginTop: 3 }}>{n.time}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: "12px 20px", textAlign: "center",
          borderTop: `1px solid ${dark ? "#334155" : "#f1f5f9"}` }}>
          <button style={{ fontSize: 13, color: themeColor, background: "none", border: "none",
            cursor: "pointer", fontWeight: 600 }}>View all notifications →</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function Dashboard() {
  const [user, setUser]                   = useState(null);
  const [isLoading, setIsLoading]         = useState(true);
  const [activeMenu, setActiveMenu]       = useState(null);
  const [showDropdown, setShowDropdown]   = useState(false);
  const [showProfile, setShowProfile]     = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [sidebarOpen, setSidebarOpen]     = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [dark, setDark]                   = useState(false);
  const [timeLeft, setTimeLeft]           = useState(null);
  const profileRef                        = useRef(null);
  const welcomeShown                      = useRef(false);
  const { toasts, add: addToast, remove: removeToast } = useToast();

  // Apply dark/light CSS vars on toggle
  useEffect(() => { applyTheme(dark); }, [dark]);

  /* FETCH USER */
  useEffect(() => {
    getCurrentUser()
      .then((data) => {
        const u = data?.data ? data.data : data;
        setUser(u);
        if (u?.exp) {
          const rem = u.exp - Math.floor(Date.now() / 1000);
          setTimeLeft(rem > 0 ? rem : 0);
        }
        if (!welcomeShown.current) { welcomeShown.current = true; addToast(`Welcome back, ${u?.name || "User"}! 👋`, "success", 3500); }
      })
      .catch(() => addToast("Failed to load user data.", "error"))
      .finally(() => setIsLoading(false));
  }, []);

  /* SESSION COUNTDOWN */
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) { if (timeLeft === 0) logout(); return; }
    if (timeLeft === 120) addToast("⚠️ Session expires in 2 minutes!", "warning", 6000);
    if (timeLeft === 30)  addToast("🚨 Session expiring in 30 seconds!", "error", 0);
    const iv = setInterval(() => setTimeLeft((p) => { if (p <= 1) { clearInterval(iv); logout(); return 0; } return p - 1; }), 1000);
    return () => clearInterval(iv);
  }, [timeLeft]);

  /* AUTO-REFRESH */
  const refreshSession = useCallback(() => {
    fetch("http://localhost:8000/refresh", { method: "POST", credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(() => getCurrentUser())
      .then((data) => {
        const u = data?.data || data; setUser(u);
        if (u?.exp) { const rem = u.exp - Math.floor(Date.now() / 1000); setTimeLeft(rem > 0 ? rem : 0); }
        addToast("Session refreshed ✅", "success", 3000);
      })
      .catch(() => { addToast("Session refresh failed. Logging out…", "error", 2000); setTimeout(logout, 2000); });
  }, []);

  useEffect(() => { if (timeLeft === 30) refreshSession(); }, [timeLeft, refreshSession]);

  /* CLOSE DROPDOWN OUTSIDE */
  useEffect(() => {
    const h = (e) => { if (profileRef.current && !profileRef.current.contains(e.target)) setShowDropdown(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="layout">
        <aside className="sidebar" style={{ background: "linear-gradient(180deg,#232382,#011651)", width: 250 }}>
          <div className="logo"><Skeleton width={120} height={36} /></div>
          <div className="menu">{[1,2,3,4,5].map((i) => <Skeleton key={i} width="90%" height={40} radius={10} style={{ marginBottom: 8 }} />)}</div>
        </aside>
        <main className="main"><div className="content-wrapper"><Skeleton width="100%" height={60} radius={18} /><DashboardSkeleton /></div></main>
      </div>
    );
  }
  if (!user) return <div className="center">Not authenticated. Please log in.</div>;

  const role        = detectRole(user);
  const themeColor  = ROLE_THEME[role]    || "#4e73df";
  const menuItems   = SIDEBAR_MENUS[role] || [];
  const pageTitle   = PAGE_TITLE[role];
  const activeItem  = activeMenu ? menuItems.find((m) => m.label === activeMenu) || menuItems[0] : menuItems[0];
  const isOverview  = !activeMenu || activeItem?.label === menuItems[0]?.label;

  const handleMenuClick = (label) => {
    setActiveMenu(label);
    setMobileSidebar(false);

  };

  return (
    <div className="layout" style={{ background: "var(--bg-app)" }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <SearchBar role={role} onNavigate={handleMenuClick} dark={dark} />
      <NotificationsPanel open={showNotifications} onClose={() => setShowNotifications(false)} themeColor={themeColor} dark={dark} />

      {/* Profile Modal */}
      {showProfile && <ProfilePage user={user} role={role} themeColor={themeColor} dark={dark} onClose={() => setShowProfile(false)} />}

      {/* Mobile overlay */}
      {mobileSidebar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 6000 }}
          onClick={() => setMobileSidebar(false)} />
      )}

      {/* ── SIDEBAR ─────────────────────────────────────────────── */}
      <aside className="sidebar" style={{
        background: "linear-gradient(180deg,#232382,#011651)",
        width: sidebarOpen ? 250 : 72,
        transition: "width 0.3s ease",
        overflow: "hidden",
        // Mobile: slide-in drawer
        position: window.innerWidth <= 768 ? "fixed" : "relative",
        left:     window.innerWidth <= 768 ? (mobileSidebar ? 0 : -260) : undefined,
        top:      window.innerWidth <= 768 ? 0 : undefined,
        height:   window.innerWidth <= 768 ? "100vh" : undefined,
        zIndex:   window.innerWidth <= 768 ? 6100 : undefined,
      }}>
        <div style={{ display: "flex", alignItems: "center",
          justifyContent: sidebarOpen ? "space-between" : "center",
          padding: sidebarOpen ? "0 16px 24px" : "0 8px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 16 }}>
          {sidebarOpen && <img src={hdfcLogo} alt="HDFC" style={{ width: 120, filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.3))" }} />}
          <button onClick={() => { sidebarOpen ? setSidebarOpen(false) : setSidebarOpen(true); setMobileSidebar(false); }}
            style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8,
              color: "rgba(255,255,255,0.85)", cursor: "pointer", fontSize: 13,
              width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.2)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}>
            {sidebarOpen ? "◀" : "▶"}
          </button>
        </div>

        <div className="menu">
          {menuItems.map((item) => {
            const isActive = activeItem?.label === item.label;
            return (
              <div key={item.label} className={`menu-item ${isActive ? "active" : ""}`}
                onClick={() => handleMenuClick(item.label)}
                title={!sidebarOpen ? item.label : undefined}
                style={{ ...(isActive ? { backgroundColor: themeColor } : {}),
                  display: "flex", alignItems: "center", gap: sidebarOpen ? 10 : 0,
                  justifyContent: sidebarOpen ? "flex-start" : "center",
                  padding: sidebarOpen ? "12px 18px" : "12px",
                  whiteSpace: "nowrap", overflow: "hidden" }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                {sidebarOpen && <span style={{ fontSize: 14 }}>{item.label}</span>}
              </div>
            );
          })}
        </div>

        {/* Sidebar user chip */}
        {sidebarOpen && (
          <div style={{ marginTop: "auto", padding: "16px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10,
              background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: themeColor,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                {(user.preferred_username || "U").slice(0, 2).toUpperCase()}
              </div>
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>{role}</div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* ── MAIN ───────────────────────────────────────────────── */}
      <main className="main">
        <div className="content-wrapper">

          {/* Topbar */}
          <div className="topbar" style={{ backgroundColor: themeColor }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {/* Mobile hamburger */}
              <button className="hamburger" onClick={() => setMobileSidebar(true)}
                style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8,
                  color: "#fff", cursor: "pointer", fontSize: 18, width: 36, height: 36,
                  display: "none", alignItems: "center", justifyContent: "center" }}>☰</button>
              <div>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{isOverview ? pageTitle : activeItem?.label}</h1>
                {!isOverview && (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ cursor: "pointer", textDecoration: "underline" }}
                      onClick={() => setActiveMenu(menuItems[0]?.label)}>Overview</span>
                    <span>›</span><span>{activeItem?.label}</span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Search */}
              <button onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { ctrlKey: true, key: "k", bubbles: true }))}
                style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.15)",
                  border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "7px 14px",
                  color: "rgba(255,255,255,0.9)", fontSize: 13, cursor: "pointer" }}>
                <span>🔍</span><span className="search-label">Search</span>
                <kbd style={{ fontSize: 10, background: "rgba(255,255,255,0.15)", borderRadius: 4,
                  padding: "1px 5px", border: "1px solid rgba(255,255,255,0.2)" }}>⌘K</kbd>
              </button>

              {/* Dark mode */}
              <button onClick={() => setDark(!dark)} title="Toggle dark mode"
                style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 10, color: "#fff", cursor: "pointer", fontSize: 17,
                  width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {dark ? "☀️" : "🌙"}
              </button>
              {/* Profile */}
              <div className="profile" ref={profileRef}>
                <div className="profile-info" onClick={() => setShowDropdown(!showDropdown)}>
                  <span className="profile-name">{user.name}</span>
                  <img src="https://i.pravatar.cc/40" alt="avatar" className="avatar" />
                </div>
                {showDropdown && (
                  <div className="dropdown">
                    <div onClick={() => { setShowProfile(true); setShowDropdown(false); }}>👤 View Profile</div>
                    <div>✏ Edit Profile</div>
                    <div onClick={() => setDark(!dark)}>{dark ? "☀️ Light Mode" : "🌙 Dark Mode"}</div>
                    <div>❓ Help &amp; Support</div>
                    <hr />
                    <button className="logout" onClick={logout}>🚪 Logout</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Welcome card */}
          {isOverview && (
            <div className="welcome-card" style={{ borderLeft: `6px solid ${themeColor}` }}>
              <div>
                <h2>{(() => { const h = new Date().getHours(); return h < 12 ? "🌅 Good Morning" : h < 17 ? "☀️ Good Afternoon" : "🌙 Good Evening"; })()}, {user.name} 👋</h2>
                <p>Welcome back to your <strong>{role.toUpperCase()}</strong> portal.</p>
                {timeLeft !== null && (
                  <span className="session" style={{ color: timeLeft <= 30 ? "#ef4444" : timeLeft <= 120 ? "#f97316" : undefined }}>
                    ⏱ Session expires in {Math.floor(timeLeft / 60)}m {String(timeLeft % 60).padStart(2, "0")}s
                  </span>
                )}
              </div>
              <img src="https://cdn-icons-png.flaticon.com/512/2921/2921222.png" alt="illustration" />
            </div>
          )}

          {/* Content */}
          {isOverview ? (
            <>
              {role === "admin"    && <AdminOverview    user={user} themeColor={themeColor} />}
              {role === "manager"  && <ManagerOverview  themeColor={themeColor} />}
              {role === "employee" && <EmployeeOverview user={user} themeColor={themeColor} />}
              {role === "user"     && <UserOverview     user={user} themeColor={themeColor} />}
            </>
          ) : activeItem?.label === "User Management" ? (
            <UserManagementPage themeColor={themeColor} />
          ) : (
            <ComingSoon item={activeItem} themeColor={themeColor} />
          )}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;