import { useState } from "react";
import "./landingPage.css";
import { UserCircle, Shield, Lock, Users, ArrowRight, Moon, Sun } from "lucide-react";
import hdfcLogo from '../assets/hdfcbanklogo.png';

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost";

function LandingPage() {
  const [darkMode, setDarkMode] = useState(false);

  const handleLogin = () => {
    window.location.href = `${API_BASE}/login`;
  };

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
  };

  const features = [
    { icon: <Shield size={22} />, title: "Secure Access",       desc: "Enterprise-grade security" },
    { icon: <Lock size={22} />,   title: "Role-Based Control",  desc: "Granular access control" },
    { icon: <Users size={22} />,  title: "Multi-User Support",  desc: "Manage teams with ease" },
  ];

  return (
    <div className="landing-container">

      {/* Header */}
      <header className="landing-header">
        <div className="logo-box">
          <img src={hdfcLogo} alt="HDFC Bank Logo" className="logo-img" />
        </div>

        <div className="header-right">
          <button className="theme-toggle" onClick={toggleTheme} title="Toggle dark mode">
            {darkMode ? <Sun size={16} color="#a5b4fc" /> : <Moon size={16} color="#1e3a8a" />}
          </button>
          <button className="login-btn" onClick={handleLogin}>
            <span>Log In</span>
            <UserCircle size={18} />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <div className="landing-wrapper">

        {/* LEFT */}
        <div className="landing-left">
          <span className="hero-eyebrow">🔐 Trusted by HDFC Bank</span>

          <h1 className="landing-title">
            Welcome to <span className="gradient-text">Auth Service</span>
          </h1>

          <p className="subtitle-line1">
            Secure Identity & Access Management for modern banking operations.
          </p>

          <div className="hero-cta-row">
            <button className="get-started-btn" onClick={handleLogin}>
              <span>Get Started</span>
              <ArrowRight size={18} />
            </button>
            <span className="hero-trust">🔒 Bank-grade encryption</span>
          </div>

          {/* Feature Cards */}
          <div className="features-grid">
            {features.map((feature, index) => (
              <div key={index} className="feature-card">
                <div className="feature-icon">{feature.icon}</div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-desc">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT */}
        <div className="landing-right">
          <div className="illustration-wrapper">
            <img
              src="/src/assets/yy.png"
              alt="Security Illustration"
              className="main-illustration"
            />
          </div>
        </div>

      </div>
    </div>
  );
}

export default LandingPage;