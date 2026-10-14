'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sora, Inter } from 'next/font/google';
import toast, { Toaster } from 'react-hot-toast';

const sora = Sora({ subsets: ['latin'], weight: ['600', '700', '800'] });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

const rawApi = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";
const API_BASE = rawApi.replace(/\/+$/, '');

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your email address");
      return;
    }
    if (!email.includes('@')) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!password) {
      toast.error("Please enter your password");
      return;
    }
    setLoading(true);

    const payload = { email: email.trim(), password };

    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && data.token) {
        sessionStorage.setItem("admin_token", data.token);
        toast.success("Welcome back! Signing in to dashboard...");
        setTimeout(() => {
          router.push('/dashboard');
        }, 800);
      } else {
        toast.error(data.detail || "Invalid email or password");
        setLoading(false);
      }
    } catch (err) {
      toast.error("Network error. Please make sure backend is running.");
      setLoading(false);
    }
  };

  const handleForgotPassword = (e) => {
    e.preventDefault();
    toast("To reset your password, please contact support or your account administrator.", {
      icon: "🔑",
      duration: 4000
    });
  };

  return (
    <div className={`rw-login-page ${inter.className}`}>
      <Toaster position="top-center" />

      {/* Modern Top Bar */}
      <header className="rw-header">
        <Link href="/" className="rw-logo" style={sora.style}>
          <div className="rw-logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div className="rw-logo-text">
            <span className="rw-logo-title">AI Sales Agent</span>
            <span className="rw-logo-sub">Merchant Portal</span>
          </div>
        </Link>
        {/* Sleek Professional Auth Pill */}
        <div className="rw-header-actions">
          <span className="rw-header-text">New merchant?</span>
          <Link 
            href="/signup" 
            className="rw-header-create-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              padding: '6px 16px',
              borderRadius: '9999px',
              fontSize: '13px',
              fontWeight: '600',
              textDecoration: 'none',
              boxShadow: '0 2px 10px rgba(37, 99, 235, 0.45)',
            }}
          >
            <span style={{ color: '#ffffff', fontWeight: '600' }}>Create Store</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </Link>
        </div>
      </header>

      {/* Split Hero Workspace */}
      <div className="rw-login-container">
        
        {/* Left Column: Focused Login Form */}
        <div className="rw-login-form-col">
          <div className="rw-login-card">
            
            <div className="rw-badge-row">
              <span className="rw-portal-badge">MERCHANT DASHBOARD</span>
            </div>

            <div className="rw-card-header">
              <h1 className="rw-card-title" style={sora.style}>Welcome back</h1>
              <p className="rw-card-desc">
                Sign in to view real-time customer conversations, orders, and AI conversion analytics.
              </p>
            </div>

            <form onSubmit={handleLogin} className="rw-form-body">
              
              {/* Email Field */}
              <div className="rw-field">
                <label className="rw-field-label">Owner Email Address</label>
                <div className="rw-input-box">
                  <span className="rw-input-ico">✉️</span>
                  <input
                    type="email"
                    placeholder="owner@yourbrand.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rw-input-text"
                    autoFocus
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="rw-field">
                <div className="rw-field-label-row">
                  <label className="rw-field-label">Password</label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="rw-forgot-link"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="rw-input-box">
                  <span className="rw-input-ico">🔒</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your account password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rw-input-text"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="rw-pw-btn"
                    tabIndex={-1}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {/* Remember me row */}
              <div className="rw-remember-row">
                <label className="rw-remember-label">
                  <input type="checkbox" defaultChecked className="rw-checkbox" />
                  <span>Remember me on this browser</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="rw-submit-btn"
                style={sora.style}
              >
                {loading ? "Signing in..." : "Sign In to Dashboard →"}
              </button>

            </form>

            {/* Merchant Security Note */}
            <div className="rw-security-badge">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <span>Protected by 256-Bit SSL Merchant Encryption</span>
            </div>

            <div className="rw-card-footer">
              <span>Don’t have an AI store yet?</span>
              <Link href="/signup" className="rw-signup-link">
                Launch your free store in 60s →
              </Link>
            </div>

          </div>
        </div>

        {/* Right Column: Sleek Minimalist Merchant Showcase */}
        <div className="rw-login-showcase-col">
          <div className="rw-showcase-card">
            
            <div className="rw-showcase-header">
              <div className="rw-live-status">
                <span className="rw-live-dot"></span>
                <span>AI SALES AGENT PLATFORM</span>
              </div>
              <span className="rw-health-tag">🟢 24/7 Active</span>
            </div>

            <h3 className="rw-showcase-headline" style={sora.style}>
              Autonomous sales engine for your online store
            </h3>

            <p className="rw-showcase-intro">
              Sign in to manage live customer conversations, catalog inventory, and automated order conversions.
            </p>

            {/* Clean 4-Item Feature Grid (Visual & Compact, Zero Clutter) */}
            <div className="rw-clean-grid">
              <div className="rw-clean-item">
                <div className="rw-ci-icon">⚡</div>
                <div className="rw-ci-text">
                  <strong>Instant AI Replies</strong>
                  <span>&lt; 1.5s in Hindi, English & Hinglish</span>
                </div>
              </div>

              <div className="rw-clean-item">
                <div className="rw-ci-icon">🎯</div>
                <div className="rw-ci-text">
                  <strong>Lead Intent Tagging</strong>
                  <span>Hot, Warm & Cold buyer tagging</span>
                </div>
              </div>

              <div className="rw-clean-item">
                <div className="rw-ci-icon">📦</div>
                <div className="rw-ci-text">
                  <strong>Live Catalog Control</strong>
                  <span>Instant price sync & store banners</span>
                </div>
              </div>

              <div className="rw-clean-item">
                <div className="rw-ci-icon">💬</div>
                <div className="rw-ci-text">
                  <strong>WhatsApp Checkout</strong>
                  <span>Automated checkout & order tracking</span>
                </div>
              </div>
            </div>

            {/* Clean Bottom Trust & Security Bar */}
            <div className="rw-clean-footer">
              <div className="rw-cf-trust">
                <span className="rw-cf-stars">★★★★★</span>
                <span className="rw-cf-text">Trusted by 500+ Indian retail merchants</span>
              </div>
              <div className="rw-cf-secure">
                <span>🔒 256-Bit SSL</span>
              </div>
            </div>

          </div>
        </div>

      </div>

      <style jsx>{`
        .rw-login-page {
          min-height: 100vh;
          background: #080d1a;
          background-image: 
            radial-gradient(circle at 15% 25%, rgba(37, 99, 235, 0.16) 0%, transparent 40%),
            radial-gradient(circle at 85% 75%, rgba(139, 92, 246, 0.14) 0%, transparent 40%),
            linear-gradient(180deg, #090e1c 0%, #050811 100%);
          color: #f8fafc;
          display: flex;
          flex-direction: column;
        }

        /* Top Navbar */
        .rw-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 48px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(9, 14, 28, 0.88);
          backdrop-filter: blur(20px);
          position: sticky;
          top: 0;
          z-index: 50;
        }

        .rw-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #ffffff;
          text-decoration: none;
        }

        .rw-logo-icon {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #2563eb, #3b82f6);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.45);
        }

        .rw-logo-text {
          display: flex;
          flex-direction: column;
        }

        .rw-logo-title {
          font-size: 17px;
          font-weight: 700;
          line-height: 1.2;
          color: #ffffff;
        }

        .rw-logo-sub {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 500;
          letter-spacing: 0.04em;
        }

        /* Sleek Top-Right Auth Pill */
        .rw-header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 5px 6px 5px 14px;
          border-radius: 9999px;
          backdrop-filter: blur(12px);
          transition: all 0.2s;
        }

        .rw-header-actions:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.12);
        }

        .rw-header-text {
          font-size: 13.5px;
          color: #cbd5e1;
          font-weight: 500;
        }

        .rw-header-create-btn,
        .rw-header-create-btn:visited,
        .rw-header-create-btn:hover,
        .rw-header-create-btn:active,
        .rw-header-create-btn:focus {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background-color: #2563eb !important;
          color: #ffffff !important;
          border: 1px solid rgba(255, 255, 255, 0.25) !important;
          padding: 6px 16px;
          border-radius: 9999px;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none !important;
          box-shadow: 0 2px 10px rgba(37, 99, 235, 0.45);
          transition: all 0.2s ease;
        }

        .rw-header-create-btn:hover {
          background-color: #1d4ed8 !important;
          color: #ffffff !important;
          box-shadow: 0 4px 16px rgba(37, 99, 235, 0.65);
          transform: translateY(-1px);
        }

        /* Container */
        .rw-login-container {
          max-width: 1240px;
          margin: 0 auto;
          padding: 48px 32px 80px;
          display: grid;
          grid-template-columns: 1.05fr 0.95fr;
          gap: 48px;
          align-items: center;
          width: 100%;
          flex: 1;
        }

        /* Card Container */
        .rw-login-card {
          background: rgba(18, 26, 45, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 38px 40px;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(16px);
        }

        .rw-badge-row {
          margin-bottom: 14px;
        }

        .rw-portal-badge {
          display: inline-block;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.1em;
          color: #38bdf8;
          background: rgba(56, 189, 248, 0.12);
          padding: 4px 12px;
          border-radius: 20px;
          border: 1px solid rgba(56, 189, 248, 0.25);
        }

        .rw-card-header {
          margin-bottom: 26px;
        }

        .rw-card-title {
          font-size: 30px;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: -0.02em;
          margin-bottom: 8px;
        }

        .rw-card-desc {
          font-size: 15px;
          color: #94a3b8;
          line-height: 1.5;
        }

        /* Form */
        .rw-form-body {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .rw-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .rw-field-label {
          font-size: 14px;
          font-weight: 600;
          color: #e2e8f0;
        }

        .rw-input-box {
          position: relative;
          display: flex;
          align-items: center;
        }

        .rw-input-ico {
          position: absolute;
          left: 16px;
          font-size: 16px;
          pointer-events: none;
        }

        .rw-input-text {
          width: 100%;
          height: 52px;
          padding: 0 16px 0 46px;
          background: rgba(11, 17, 32, 0.75);
          border: 1.5px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          color: #ffffff;
          font-size: 15px;
          transition: all 0.2s;
          outline: none;
        }

        .rw-input-text:focus {
          border-color: #3b82f6;
          background: rgba(11, 17, 32, 0.95);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
        }

        .rw-pw-btn {
          position: absolute;
          right: 14px;
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          padding: 4px 8px;
        }

        .rw-pw-btn:hover {
          color: #ffffff;
        }

        .rw-submit-btn {
          height: 52px;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          border: none;
          border-radius: 12px;
          color: #ffffff;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(37, 99, 235, 0.45);
          transition: all 0.2s;
          margin-top: 6px;
        }

        .rw-submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(37, 99, 235, 0.6);
        }

        .rw-submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .rw-field-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .rw-forgot-link {
          background: transparent;
          border: none;
          color: #38bdf8;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          padding: 0;
          transition: color 0.2s;
        }

        .rw-forgot-link:hover {
          color: #60a5fa;
          text-decoration: underline;
        }

        /* Remember me */
        .rw-remember-row {
          display: flex;
          align-items: center;
          margin-top: -6px;
        }

        .rw-remember-label {
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 13.5px;
          color: #cbd5e1;
          cursor: pointer;
          user-select: none;
        }

        .rw-checkbox {
          width: 16px;
          height: 16px;
          accent-color: #2563eb;
          cursor: pointer;
          border-radius: 4px;
        }

        /* Security Badge */
        .rw-security-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 24px;
          padding: 10px 14px;
          background: rgba(16, 185, 129, 0.06);
          border: 1px solid rgba(16, 185, 129, 0.18);
          border-radius: 12px;
          font-size: 12.5px;
          color: #6ee7b7;
          font-weight: 500;
        }

        .rw-card-footer {
          margin-top: 24px;
          text-align: center;
          font-size: 14px;
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .rw-signup-link {
          color: #38bdf8;
          font-weight: 600;
          text-decoration: none;
        }

        .rw-signup-link:hover {
          text-decoration: underline;
        }

        /* ──────── RIGHT SHOWCASE ──────── */
        .rw-login-showcase-col {
          display: flex;
          flex-direction: column;
        }

        .rw-showcase-card {
          background: rgba(18, 26, 45, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 34px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(16px);
        }

        .rw-showcase-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 22px;
        }

        .rw-live-status {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: #34d399;
        }

        .rw-live-dot {
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          box-shadow: 0 0 10px #10b981;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.8; }
        }

        .rw-health-tag {
          font-size: 12px;
          font-weight: 600;
          color: #34d399;
          background: rgba(16, 185, 129, 0.1);
          padding: 4px 10px;
          border-radius: 20px;
        }

        .rw-showcase-headline {
          font-size: 20px;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: -0.01em;
          margin-bottom: 8px;
          line-height: 1.35;
        }

        .rw-showcase-intro {
          font-size: 13.5px;
          color: #94a3b8;
          line-height: 1.5;
          margin-bottom: 24px;
        }

        /* Clean Feature Grid */
        .rw-clean-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
          margin-bottom: 24px;
        }

        .rw-clean-item {
          background: rgba(11, 17, 32, 0.65);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 16px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          transition: all 0.2s;
        }

        .rw-clean-item:hover {
          background: rgba(15, 23, 42, 0.9);
          border-color: rgba(59, 130, 246, 0.35);
          transform: translateY(-1px);
        }

        .rw-ci-icon {
          font-size: 20px;
          width: 36px;
          height: 36px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .rw-ci-text {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .rw-ci-text strong {
          font-size: 13.5px;
          font-weight: 700;
          color: #ffffff;
        }

        .rw-ci-text span {
          font-size: 11.5px;
          color: #94a3b8;
          line-height: 1.35;
        }

        /* Clean Footer */
        .rw-clean-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 18px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .rw-cf-trust {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .rw-cf-stars {
          color: #fbbf24;
          font-size: 13px;
          letter-spacing: 2px;
        }

        .rw-cf-text {
          font-size: 12px;
          color: #94a3b8;
          font-weight: 500;
        }

        .rw-cf-secure {
          font-size: 11.5px;
          color: #34d399;
          font-weight: 600;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.2);
          padding: 4px 10px;
          border-radius: 20px;
        }

        /* Responsive Breakpoints */
        @media (max-width: 1024px) {
          .rw-login-container {
            grid-template-columns: 1fr;
            padding: 32px 20px 60px;
          }
          .rw-login-showcase-col {
            display: none;
          }
          .rw-header {
            padding: 16px 20px;
          }
          .rw-login-card {
            padding: 28px 22px;
          }
        }
      `}</style>
    </div>
  );
}
