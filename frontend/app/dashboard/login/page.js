'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sora, Inter } from 'next/font/google';
import toast, { Toaster } from 'react-hot-toast';

const sora = Sora({ subsets: ['latin'], weight: ['400', '600', '800'] });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600'] });

const rawApi = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const API_BASE = rawApi.replace(/\/+$/, '');

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!password) {
      toast.error("Please enter the admin password");
      return;
    }
    setLoading(true);
    
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      const data = await res.json();
      
      if (res.ok && data.token) {
        sessionStorage.setItem("admin_token", data.token);
        toast.success("Login successful!");
        setTimeout(() => {
          router.push('/dashboard');
        }, 1000);
      } else {
        toast.error(data.detail || "Invalid password");
        setLoading(false);
      }
    } catch (err) {
      toast.error("Network error. Please check backend.");
      setLoading(false);
    }
  };

  return (
    <div className={`login-page ${inter.className}`}>
      <Toaster position="top-right" />
      <div className="login-container">
        <div className="login-header">
          <div className="login-brand" style={sora.style}>
            <span style={{ color: '#0ea5e9' }}>AI</span> SALES AGENT
          </div>
          <h1 className="login-title">Admin Access</h1>
          <p className="login-subtitle">Enter your master passcode to access the dashboard.</p>
        </div>
        
        <form onSubmit={handleLogin} className="login-form">
          <div className="input-group">
            <input 
              type="password" 
              placeholder="Enter Passcode..." 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-input"
              autoFocus
            />
          </div>
          
          <button type="submit" disabled={loading} className="login-button">
            {loading ? 'Verifying...' : 'Access Dashboard'}
          </button>
        </form>
        
        <div className="login-footer">
          <p>Secure Area • Unauthorized access prohibited</p>
        </div>
      </div>
      
      <style jsx>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: #0f1115;
          background-image: 
            radial-gradient(circle at 15% 50%, rgba(14, 165, 233, 0.08), transparent 25%),
            radial-gradient(circle at 85% 30%, rgba(139, 92, 246, 0.08), transparent 25%);
          color: #e2e8f0;
        }
        
        .login-container {
          background: rgba(30, 33, 40, 0.6);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 24px;
          padding: 48px;
          width: 100%;
          max-width: 440px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.4);
          animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .login-header {
          text-align: center;
          margin-bottom: 40px;
        }
        
        .login-brand {
          font-size: 20px;
          font-weight: 800;
          letter-spacing: 0.1em;
          margin-bottom: 24px;
        }
        
        .login-title {
          font-size: 28px;
          font-weight: 600;
          margin: 0 0 8px 0;
          color: #ffffff;
        }
        
        .login-subtitle {
          font-size: 14px;
          color: #94a3b8;
          margin: 0;
        }
        
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        
        .login-input {
          width: 100%;
          background: rgba(15, 17, 21, 0.6);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 16px 20px;
          font-size: 16px;
          color: #ffffff;
          outline: none;
          transition: all 0.2s ease;
          text-align: center;
          letter-spacing: 0.2em;
        }
        
        .login-input:focus {
          border-color: #0ea5e9;
          box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.2);
        }
        
        .login-input::placeholder {
          letter-spacing: normal;
          color: #64748b;
        }
        
        .login-button {
          width: 100%;
          padding: 16px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #0ea5e9, #3b82f6);
          color: white;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 8px 24px rgba(14, 165, 233, 0.3);
        }
        
        .login-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(14, 165, 233, 0.4);
        }
        
        .login-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        
        .login-footer {
          margin-top: 32px;
          text-align: center;
          font-size: 12px;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        @media (max-width: 480px) {
          .login-container {
            padding: 32px 24px;
            border-radius: 20px;
          }
        }
      `}</style>
    </div>
  );
}
