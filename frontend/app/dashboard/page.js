'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import toast from 'react-hot-toast';

const rawApi = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const API_BASE = rawApi.replace(/\/+$/, '');

const authFetch = async (url, options = {}) => {
  if (typeof window !== 'undefined') {
    const token = sessionStorage.getItem('admin_token');
    if (!token) { window.location.href = '/dashboard/login'; return new Response(null, {status: 401}); }
    const headers = { ...options.headers, 'Authorization': 'Bearer ' + token };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401 || res.status === 403) {
      window.location.href = '/dashboard/login';
    }
    return res;
  }
  return fetch(url, options);
};

const CUSTOMERS_URL = `${API_BASE}/api/customers`;
const CONVERSATIONS_URL = `${API_BASE}/api/conversations`;
const HANDOFFS_URL = `${API_BASE}/api/handoffs`;
const REFERRALS_URL = `${API_BASE}/api/referrals`;
const ANALYTICS_URL = `${API_BASE}/api/analytics`;
const WEEKLY_URL = `${API_BASE}/api/analytics/weekly`;

function segColor(seg) {
  if (seg === 'HOT') return '#f85149';
  if (seg === 'WARM') return '#ffc107';
  if (seg === 'CUSTOMER') return '#3fb950';
  return '#8b949e';
}

function segTextColor(seg) {
  if (seg === 'WARM') return '#000';
  return '#fff';
}

const sora = { fontFamily: 'var(--font-sora, Sora, sans-serif)' };
const mono = { fontFamily: 'var(--font-jetbrains-mono, monospace)' };
const inter = { fontFamily: 'var(--font-inter, Inter, sans-serif)' };

/* ─── CSS Variable theme tokens ─── */
const c = {
  bg: 'var(--bg)',
  panel: 'var(--panel)',
  panel2: 'var(--panel2)',
  line: 'var(--line)',
  muted: 'var(--muted)',
  ivory: 'var(--ivory)',
  primary: 'var(--primary)',
  hot: 'var(--hot)',
  warm: 'var(--warm)',
  cold: 'var(--cold)',
  cust: 'var(--cust)',
};

const styles = {
  page: {
    background: c.bg, minHeight: '100vh', color: c.ivory, ...inter,
  },
  navbar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '24px 40px', background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(12px)',
    borderBottom: `1px solid ${c.line}`, position: 'sticky', top: 0, zIndex: 100
  },
  navBrand: {
    ...sora, fontSize: '24px', fontWeight: 900, color: c.ivory,
    textTransform: 'uppercase', letterSpacing: '0.1em'
  },
  wrap: {
    maxWidth: '1600px', margin: '0 auto', padding: '40px 40px 100px',
  },
  eyebrow: {
    ...sora, fontSize: '12px', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '.18em',
    color: c.primary, marginBottom: '8px',
  },
  titleRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'
  },
  sub: {
    color: c.muted, fontSize: '15px', marginTop: '0', marginBottom: '40px',
  },
  sectionTitle: {
    ...sora, fontSize: '16px', fontWeight: 800, textTransform: 'uppercase',
    letterSpacing: '.06em', color: c.primary, margin: 0,
  },
  card: {
    background: c.panel, backdropFilter: 'blur(16px)', 
    border: `1px solid ${c.line}`, borderRadius: '24px',
    boxShadow: '0 12px 32px rgba(0,0,0,0.05)', padding: '28px',
  },
  statCard: {
    background: c.panel, backdropFilter: 'blur(16px)', 
    border: `1px solid ${c.line}`, borderRadius: '24px',
    boxShadow: '0 12px 32px rgba(0,0,0,0.05)', padding: '28px', textAlign: 'center',
    display: 'flex', flexDirection: 'column', justifyContent: 'center'
  },
  statLabel: {
    ...mono, fontSize: '12px', textTransform: 'uppercase',
    letterSpacing: '.1em', color: c.muted, marginBottom: '12px',
  },
  statVal: {
    ...sora, fontSize: '42px', fontWeight: 800,
  },
  badge: (bg, color) => ({
    background: bg, color: color, padding: '6px 12px', borderRadius: '12px',
    fontSize: '11px', fontWeight: 700, display: 'inline-block',
    textTransform: 'uppercase',
  }),
  progressBg: {
    flex: 1, background: c.panel2, height: '40px', borderRadius: '8px',
    position: 'relative', overflow: 'hidden',
  },
  progressFill: (width) => ({
    width: `${width}%`, height: '100%',
    background: `linear-gradient(90deg, ${c.primary}, #3a7bd5)`,
    borderRadius: '8px', transition: 'width 0.6s ease',
  }),
  table: {
    width: '100%', borderCollapse: 'collapse',
  },
  th: {
    ...mono, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.08em',
    color: c.muted, fontWeight: 700, padding: '16px 20px', textAlign: 'left',
    borderBottom: `1px solid ${c.line}`, background: c.panel2
  },
  td: {
    padding: '16px 20px', borderBottom: `1px solid ${c.line}`, fontSize: '15px',
    color: c.ivory,
  },
  handoffCard: {
    background: c.panel, border: `1px solid ${c.line}`, borderRadius: '16px',
    padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    borderLeft: `4px solid ${c.hot}`,
  },
  resolveBtn: {
    background: c.panel2, border: `1px solid ${c.line}`, color: c.ivory,
    borderRadius: '8px', padding: '10px 16px', cursor: 'pointer',
    ...inter, fontSize: '13px', fontWeight: 600, transition: 'all 0.2s',
  },
  feedCard: {
    background: c.panel, border: `1px solid ${c.line}`,
    borderRadius: '16px', padding: '16px 20px', marginBottom: '12px',
    display: 'flex', alignItems: 'center', gap: '16px',
    transition: 'all 0.3s ease', cursor: 'pointer',
  },
  feedIcon: {
    width: '44px', height: '44px', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '20px'
  }
};

export default function Dashboard() {
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#daily-report') {
        setDailyReportOpen(true);
        setContentIdeasOpen(false);
      } else if (hash === '#content-ideas') {
        setDailyReportOpen(false);
        setContentIdeasOpen(true);
      } else {
        setDailyReportOpen(false);
        setContentIdeasOpen(false);
      }
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = sessionStorage.getItem('admin_token');
      if (!token) {
        window.location.href = '/dashboard/login';
      } else {
        setIsAuthChecking(false);
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.shop && payload.shop !== 'master') {
            setSelectedShop(payload.shop);
          } else {
            setIsSuperAdmin(true);
          }
        } catch(e) {}
      }
    }
  }, []);

  

  
  





  const [selectedShop, setSelectedShop] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [handoffs, setHandoffs] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [segments, setSegments] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteCustomerId, setDeleteCustomerId] = useState(null);
  const [selectedOrders, setSelectedOrders] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [replyTexts, setReplyTexts] = useState({});
  const [weeklyData, setWeeklyData] = useState([]);
  const [stores, setStores] = useState([]);
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [selectedCustName, setSelectedCustName] = useState('');
  const [showConvoModal, setShowConvoModal] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState(null);
  const [storeDeleteInput, setStoreDeleteInput] = useState('');


  // Daily Report state
  const [dailyReportOpen, setDailyReportOpen] = useState(false);
  const [dailyReport, setDailyReport] = useState(null);
  const [dailyReportDate, setDailyReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyReportLoading, setDailyReportLoading] = useState(false);

  // Content Ideas state
  const [contentIdeasOpen, setContentIdeasOpen] = useState(false);
  const [contentIdeasLoading, setContentIdeasLoading] = useState(false);
  const [generatedIdeas, setGeneratedIdeas] = useState([]);
  const [contentProduct, setContentProduct] = useState('All Products');
  const [contentType, setContentType] = useState('Mix');
  const [shopCatalog, setShopCatalog] = useState([]);

  useEffect(() => {
    if (selectedShop) {
      fetch(`${API_BASE}/api/config?shop=${selectedShop}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.catalog) {
            setShopCatalog(data.catalog);
          } else {
            setShopCatalog([]);
          }
        })
        .catch(err => console.error('Failed to fetch catalog', err));
    } else {
      setShopCatalog([]);
    }
  }, [selectedShop]);

  const generateIdeas = async () => {
    if (!selectedShop) return;
    setContentIdeasLoading(true);
    setGeneratedIdeas([]);
    try {
      const res = await authFetch(`${API_BASE}/api/content-ideas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_slug: selectedShop,
          product_name: contentProduct,
          content_type: contentType
        })
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedIdeas(data.ideas || []);
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(`Failed to generate ideas: ${errData.detail || res.status}`);
      }
    } catch (e) {
      toast.error(`Network error generating ideas: ${e.message}`);
    } finally {
      setContentIdeasLoading(false);
    }
  };

  const fetchDailyReport = async (dateStr, shopSlug) => {
    setDailyReportLoading(true);
    try {
      const params = new URLSearchParams({ date: dateStr });
      if (shopSlug) params.append('shop', shopSlug);
      const res = await authFetch(`${API_BASE}/api/daily-report?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDailyReport(data);
      } else {
        toast.error('Failed to load daily report');
      }
    } catch (e) {
      toast.error('Network error loading report');
    } finally {
      setDailyReportLoading(false);
    }
  };

  const viewConversation = async (e, custId, custName) => {
    e.stopPropagation();
    try {
      const [convoRes, orderRes] = await Promise.all([
        fetch(`${API_BASE}/api/conversations/${custId}`),
        fetch(`${API_BASE}/api/customers/${custId}/orders`)
      ]);
      if (convoRes.ok) setSelectedConvo(await convoRes.json());
      if (orderRes.ok) setSelectedOrders(await orderRes.json());
      setSelectedCustName(custName || 'Anonymous Visitor');
      setShowConvoModal(true);
    } catch(e) {
      console.error(e);
    }
  };

  const viewOrders = async (customerId) => {
    try {
      const res = await authFetch(`${API_BASE}/api/customers/${customerId}/orders`);
      if (res.ok) {
        const data = await res.json();
        setSelectedOrders(data);
        setShowOrderModal(true);
      }
    } catch(e) {
      console.error(e);
    }
  };

  const confirmDelete = async () => {
    if (!deleteCustomerId) return;
    const cid = deleteCustomerId;
    setDeleteCustomerId(null);
    try {
      const res = await authFetch(`${API_BASE}/api/customers/${cid}`, { method: 'DELETE' });
      if (res.ok) {
        setCustomers(prev => prev.filter(c => c.id !== cid));
        toast.success('Lead deleted successfully', { position: 'top-right' });
      } else {
        toast.error('Failed to delete lead');
      }
    } catch (err) {
      console.error("Failed to delete customer", err);
      toast.error('Failed to delete lead');
    }
  };

  const confirmDeleteStore = async () => {
    if (!storeToDelete || storeDeleteInput !== 'DELETE') return;
    try {
      const res = await authFetch(`${API_BASE}/api/businesses/${storeToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        setStores(prev => prev.filter(s => s.id !== storeToDelete.id));
        setStoreToDelete(null);
        setStoreDeleteInput('');
        toast.success(`Store ${storeToDelete.name} deleted successfully!`, { position: 'top-center' });
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to delete store');
      }
    } catch(e) {
      console.error(e);
      toast.error('Error deleting store');
    }
  };

  const handleDeleteCustomer = (e, customerId) => {
    e.stopPropagation();
    setDeleteCustomerId(customerId);
  };

  const sendReply = async (handoffId) => {
    const text = replyTexts[handoffId];
    if (!text || !text.trim()) return;
    try {
      const res = await authFetch(`${API_BASE}/api/handoffs/${handoffId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      if (res.ok) {
        toast.success('Reply sent successfully', { position: 'top-right' });
        setReplyTexts(prev => ({ ...prev, [handoffId]: '' }));
      } else {
        toast.error('Failed to send reply');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error sending reply');
    }
  };

  const resolveHandoff = async (handoffId) => {
    try {
      const res = await authFetch(`${API_BASE}/api/handoffs/${handoffId}/resolve`, { method: 'POST' });
      if (res.ok) {
        toast.success('Marked as resolved', { position: 'top-right' });
        setHandoffs(prev => prev.map(h => h.id === handoffId ? { ...h, status: 'resolved' } : h));
      } else {
        toast.error('Failed to resolve');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error resolving');
    }
  };

  const fetchCustomers = async (isPolling = false, shopId = selectedShop) => {
    if (!isPolling) setLoading(true);
    try {
      const qs = shopId ? `?shop=${shopId}` : '';
      
      if (isSuperAdmin && !shopId) {
        const storesRes = await authFetch(`${API_BASE}/api/businesses`);
        if (storesRes.ok) {
           setStores(await storesRes.json());
        }
      }

      const res = await authFetch(`${CUSTOMERS_URL}${qs}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }

      const hRes = await authFetch(HANDOFFS_URL);
      if (hRes.ok) {
        const newHandoffs = await hRes.json();
        setHandoffs(prev => {
          const prevPendingCount = prev.filter(h => h.status === 'pending').length;
          const newPendingCount = newHandoffs.filter(h => h.status === 'pending').length;
          
          if (newPendingCount > prevPendingCount) {
             const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
             audio.play().catch(err => console.log('Audio blocked by browser:', err));
          }
          return newHandoffs;
        });
      }

      const refRes = await authFetch(`${REFERRALS_URL}${qs}`);
      if (refRes.ok) {
        setReferrals(await refRes.json());
      }

      const aRes = await authFetch(`${ANALYTICS_URL}${qs}`);
      if (aRes.ok) {
        setAnalytics(await aRes.json());
      }

      const segRes = await authFetch(`${API_BASE}/api/analytics/segments${qs}`);
      if (segRes.ok) {
        setSegments(await segRes.json());
      }

      const wRes = await authFetch(`${WEEKLY_URL}${qs}`);
      if (wRes.ok) {
        setWeeklyData(await wRes.json());
      }
    } catch (e) {
      console.error("Could not fetch customers", e);
    } finally {
      if (!isPolling) setLoading(false);
    }
  };
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) return toast.error("New password must be at least 8 chars");
    setPasswordLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/api/admin/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Password updated!");
        setSettingsOpen(false);
        setOldPassword('');
        setNewPassword('');
      } else {
        toast.error(typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail) || "Failed to update password");
      }
    } catch (e) {
      toast.error("Network error");
    } finally {
      setPasswordLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers(false, selectedShop);
    const intervalId = setInterval(() => {
      fetchCustomers(true, selectedShop);
    }, 3000);
    
  

  return () => clearInterval(intervalId);
  }, [selectedShop, isSuperAdmin]);
    
    

  const total = customers.length;
  const hotCount = customers.filter(c => c.segment === 'HOT').length;
  const warmCount = customers.filter(c => c.segment === 'WARM').length;
  const coldCount = customers.filter(c => c.segment === 'COLD').length;
  const pendingHandoffs = handoffs.filter(h => h.status === 'pending');

  const [forceResetOpen, setForceResetOpen] = useState(null);
  const [forceResetPassword, setForceResetPassword] = useState('');

  const handleForceReset = async (e) => {
    e.preventDefault();
    if (forceResetPassword.length < 8) return toast.error("New password must be at least 8 chars");
    setPasswordLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/api/admin/force-reset-shop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: forceResetOpen.id, new_password: forceResetPassword })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Shop password reset successfully!");
        setForceResetOpen(null);
        setForceResetPassword('');
      } else {
        toast.error(typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail) || "Failed to reset password");
      }
    } catch (e) {
      toast.error("Network error");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="dash-page" style={{ display: 'flex', minHeight: '100vh', position: 'relative' }}>
      
      {/* Force Reset Modal (Superadmin only) */}
      {forceResetOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: c.panel, border: `1px solid ${c.line}`, borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '400px', boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ ...sora.style, fontSize: '20px', color: c.ivory, margin: 0 }}>Reset Password</h2>
              <button onClick={() => setForceResetOpen(null)} style={{ background: 'transparent', border: 'none', color: c.muted, cursor: 'pointer', fontSize: '20px' }}>×</button>
            </div>
            <p style={{ color: c.muted, fontSize: '13px', marginBottom: '20px' }}>
              Resetting password for <strong>{forceResetOpen.name}</strong>
            </p>
            <form onSubmit={handleForceReset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: c.muted, marginBottom: '8px', fontWeight: 500 }}>New Password</label>
                <input 
                  type="password" 
                  value={forceResetPassword}
                  onChange={e => setForceResetPassword(e.target.value)}
                  style={{ width: '100%', background: c.panel2, border: `1px solid ${c.line}`, color: c.ivory, padding: '12px', borderRadius: '8px', outline: 'none' }}
                  required
                  minLength={8}
                />
              </div>
              
              <button 
                type="submit" 
                disabled={passwordLoading}
                style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 600, marginTop: '8px', cursor: passwordLoading ? 'not-allowed' : 'pointer', opacity: passwordLoading ? 0.7 : 1 }}
              >
                {passwordLoading ? 'Resetting...' : 'Force Reset Password'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {settingsOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: c.panel, border: `1px solid ${c.line}`, borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '400px', boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ ...sora.style, fontSize: '20px', color: c.ivory, margin: 0 }}>Store Settings</h2>
              <button onClick={() => setSettingsOpen(false)} style={{ background: 'transparent', border: 'none', color: c.muted, cursor: 'pointer', fontSize: '20px' }}>×</button>
            </div>
            
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: c.muted, marginBottom: '8px', fontWeight: 500 }}>Current Password</label>
                <input 
                  type="password" 
                  value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)}
                  style={{ width: '100%', background: c.panel2, border: `1px solid ${c.line}`, color: c.ivory, padding: '12px', borderRadius: '8px', outline: 'none' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: c.muted, marginBottom: '8px', fontWeight: 500 }}>New Password</label>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  style={{ width: '100%', background: c.panel2, border: `1px solid ${c.line}`, color: c.ivory, padding: '12px', borderRadius: '8px', outline: 'none' }}
                  required
                  minLength={8}
                />
              </div>
              
              <button 
                type="submit" 
                disabled={passwordLoading}
                style={{ background: c.cust, color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 600, marginTop: '8px', cursor: passwordLoading ? 'not-allowed' : 'pointer', opacity: passwordLoading ? 0.7 : 1 }}
              >
                {passwordLoading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 190 }} onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`dash-sidebar ${sidebarOpen ? 'open' : ''}`} style={{display: 'flex', flexDirection: 'column', background: 'var(--bg)', borderRight: '1px solid var(--line)', padding: '24px 0'}}>
        <div style={{ padding: '0 24px', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'var(--primary)', borderRadius: '8px', padding: '6px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
          </div>
          <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--ivory)', letterSpacing: '0.02em' }}>AI Sales Agent <span style={{ fontSize: '10px', background: 'rgba(59,130,246,0.2)', color: 'var(--primary)', padding: '2px 6px', borderRadius: '4px', verticalAlign: 'middle', marginLeft: '4px' }}>B2C</span></span>
        </div>
        
        <div style={{ padding: '0 12px' }}>
          {isSuperAdmin && (
            <div style={{ padding: '12px', color: !selectedShop && !dailyReportOpen && !contentIdeasOpen ? c.ivory : c.muted, fontSize: '14px', fontFamily: 'var(--font-inter, sans-serif)', display: 'flex', gap: '12px', background: !selectedShop && !dailyReportOpen && !contentIdeasOpen ? 'rgba(14,165,233,0.1)' : 'transparent', border: !selectedShop && !dailyReportOpen && !contentIdeasOpen ? '1px solid rgba(14,165,233,0.2)' : '1px solid transparent', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                 onClick={() => { setSelectedShop(null); setDailyReportOpen(false); setContentIdeasOpen(false); }}
                 onMouseEnter={e => { if(selectedShop || dailyReportOpen || contentIdeasOpen) e.currentTarget.style.color = '#fff'; }}
                 onMouseLeave={e => { if(selectedShop || dailyReportOpen || contentIdeasOpen) e.currentTarget.style.color = c.muted; }}
                 >
              <span>🏪</span> My Stores
            </div>
          )}

          {selectedShop && (
            <div style={{ margin: '16px 0', borderTop: `1px solid ${c.line}` }}>
              <div style={{ padding: '16px 12px 8px', ...sora.style, fontSize: '11px', color: c.muted, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {stores.find(s => s.id === selectedShop)?.name || 'Store'}
              </div>
            </div>
          )}

          <div style={{ padding: '12px', color: selectedShop && !dailyReportOpen && !contentIdeasOpen ? c.ivory : c.muted, fontSize: '14px', fontFamily: 'var(--font-inter, sans-serif)', display: 'flex', gap: '12px', background: selectedShop && !dailyReportOpen && !contentIdeasOpen ? 'rgba(14,165,233,0.1)' : 'transparent', border: selectedShop && !dailyReportOpen && !contentIdeasOpen ? '1px solid rgba(14,165,233,0.2)' : '1px solid transparent', borderRadius: '8px', cursor: 'default', marginTop: '8px', opacity: selectedShop ? 1 : 0.6 }}
               onClick={() => { window.location.hash = ''; }}>
            <span>🏠</span> Store Dashboard
          </div>

          <div style={{ padding: '12px', color: c.muted, fontSize: '14px', fontFamily: 'var(--font-inter, sans-serif)', display: 'flex', gap: '12px', cursor: selectedShop ? 'pointer' : 'not-allowed', marginTop: '8px', opacity: selectedShop ? 1 : 0.5, transition: 'all 0.2s' }}
               onClick={() => { if(selectedShop) window.location.href = `/dashboard/catalog?shop=${selectedShop}`; }}
               onMouseEnter={e => { if(selectedShop) e.currentTarget.style.color = '#fff'; }}
               onMouseLeave={e => { if(selectedShop) e.currentTarget.style.color = c.muted; }}
               >
            <span>🏷️</span> Manage Catalog
          </div>

          <div style={{ padding: '12px', color: c.muted, fontSize: '14px', fontFamily: 'var(--font-inter, sans-serif)', display: 'flex', gap: '12px', cursor: 'pointer', marginTop: '8px', opacity: 1, transition: 'all 0.2s' }}
               onClick={() => setSettingsOpen(true)}
               onMouseEnter={e => e.currentTarget.style.color = '#fff'}
               onMouseLeave={e => e.currentTarget.style.color = c.muted}
               >
            <span>⚙️</span> Settings
          </div>
          <div style={{ padding: '12px', color: dailyReportOpen && !contentIdeasOpen ? c.ivory : c.muted, fontSize: '14px', fontFamily: 'var(--font-inter, sans-serif)', display: 'flex', gap: '12px', cursor: selectedShop ? 'pointer' : 'not-allowed', marginTop: '8px', opacity: selectedShop ? 1 : 0.5, transition: 'all 0.2s', background: dailyReportOpen && !contentIdeasOpen ? 'rgba(14,165,233,0.1)' : 'transparent', border: dailyReportOpen && !contentIdeasOpen ? '1px solid rgba(14,165,233,0.2)' : '1px solid transparent', borderRadius: '8px' }}
               onClick={() => { if (selectedShop) { window.location.hash = 'daily-report'; fetchDailyReport(dailyReportDate, selectedShop); } }}
               onMouseEnter={e => { if (selectedShop && !(dailyReportOpen && !contentIdeasOpen)) e.currentTarget.style.color = '#fff'; }}
               onMouseLeave={e => { if (selectedShop && !(dailyReportOpen && !contentIdeasOpen)) e.currentTarget.style.color = c.muted; }}
               >
            <span>📊</span> Daily Report
          </div>
          
          <div style={{ padding: '12px', color: contentIdeasOpen ? c.ivory : c.muted, fontSize: '14px', fontFamily: 'var(--font-inter, sans-serif)', display: 'flex', gap: '12px', cursor: selectedShop ? 'pointer' : 'not-allowed', marginTop: '8px', opacity: selectedShop ? 1 : 0.5, transition: 'all 0.2s', background: contentIdeasOpen ? 'rgba(234,179,8,0.1)' : 'transparent', border: contentIdeasOpen ? '1px solid rgba(234,179,8,0.2)' : '1px solid transparent', borderRadius: '8px' }}
               onClick={() => { if(selectedShop) { window.location.hash = 'content-ideas'; } }}
               onMouseEnter={e => { if(selectedShop && !contentIdeasOpen) e.currentTarget.style.color = '#fff'; }}
               onMouseLeave={e => { if(selectedShop && !contentIdeasOpen) e.currentTarget.style.color = c.muted; }}
               >
            <span>💡</span> Content Ideas
          </div>
        </div>
      
        <div style={{ marginTop: 'auto', marginBottom: '20px', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <button 
            onClick={() => {
              sessionStorage.removeItem('admin_token');
              window.location.href = '/dashboard/login';
            }}
            style={{
              background: 'transparent', border: '1px solid var(--line)', color: 'var(--muted)',
              borderRadius: '8px', padding: '12px 16px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%',
              fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'var(--muted)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--line)'; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            Logout
          </button>
        </div>
      </aside>


      {/* Main Content Area */}
      <div className="dash-main">
        <header style={{ padding: '24px 32px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, position: 'relative' }}>
            <button 
              className="dash-hamburger"
              style={{ background: 'transparent', border: 'none', color: 'var(--ivory)', cursor: 'pointer', marginRight: '8px', display: 'none' }}
              onClick={() => setSidebarOpen(true)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
          </div>
        </header>

         <div className="dash-wrap">
          
          {contentIdeasOpen ? (
            /* Content Ideas View */
            <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ ...sora.style, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.18em', color: '#eab308', marginBottom: '8px' }}>Content Engine</div>
                  <h1 style={{ ...sora.style, fontSize: '28px', fontWeight: 800, color: '#fff', margin: '0 0 4px 0', letterSpacing: '-0.5px' }}>💡 Content Ideas Generator</h1>
                  <p style={{ color: c.muted, margin: 0, fontSize: '14px' }}>AI-powered social media ideas for your catalog</p>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px', padding: '24px', marginBottom: '32px', backdropFilter: 'blur(12px)' }}>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: '1 1 200px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: c.muted, marginBottom: '8px' }}>Target Product</label>
                    <select
                      value={contentProduct}
                      onChange={(e) => setContentProduct(e.target.value)}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '12px 16px', borderRadius: '12px', outline: 'none', appearance: 'none', cursor: 'pointer' }}
                    >
                      <option value="All Products" style={{ background: '#0f172a', color: '#fff' }}>All Products (Entire Catalog)</option>
                      {shopCatalog?.map((item, idx) => (
                        <option key={idx} value={item.name} style={{ background: '#0f172a', color: '#fff' }}>{item.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: '1 1 150px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: c.muted, marginBottom: '8px' }}>Content Format</label>
                    <select
                      value={contentType}
                      onChange={(e) => setContentType(e.target.value)}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '12px 16px', borderRadius: '12px', outline: 'none', appearance: 'none', cursor: 'pointer' }}
                    >
                      <option value="Mix" style={{ background: '#0f172a', color: '#fff' }}>Mix (Reel, Post, Story)</option>
                      <option value="Instagram Reel" style={{ background: '#0f172a', color: '#fff' }}>Instagram Reel</option>
                      <option value="Instagram Post" style={{ background: '#0f172a', color: '#fff' }}>Instagram Post</option>
                      <option value="Instagram Story" style={{ background: '#0f172a', color: '#fff' }}>Instagram Story</option>
                      <option value="Promotional Offer" style={{ background: '#0f172a', color: '#fff' }}>Promotional Offer</option>
                      <option value="Festival/Seasonal" style={{ background: '#0f172a', color: '#fff' }}>Festival / Seasonal</option>
                    </select>
                  </div>
                  <div>
                    <button 
                      onClick={generateIdeas}
                      disabled={contentIdeasLoading}
                      style={{ background: 'linear-gradient(135deg, #eab308, #ca8a04)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '12px', fontSize: '14px', fontWeight: 600, cursor: contentIdeasLoading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(234, 179, 8, 0.2)', display: 'flex', alignItems: 'center', gap: '8px', opacity: contentIdeasLoading ? 0.7 : 1 }}
                    >
                      {contentIdeasLoading ? '✨ Generating...' : '✨ Generate Ideas'}
                    </button>
                  </div>
                </div>
              </div>

              {contentIdeasLoading ? (
                <div style={{ textAlign: 'center', padding: '80px 0', color: c.muted, animation: 'pulse 1.5s infinite' }}>
                  <div style={{ fontSize: '32px', marginBottom: '16px' }}>🤔</div>
                  <p>AI is brainstorming creative ideas...</p>
                </div>
              ) : generatedIdeas.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
                  {generatedIdeas.map((idea, idx) => (
                    <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(90deg, #eab308, transparent)' }}></div>
                      
                      <div style={{ display: 'inline-block', padding: '6px 12px', background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', borderRadius: '8px', fontSize: '12px', fontWeight: 700, marginBottom: '16px', border: '1px solid rgba(234, 179, 8, 0.2)' }}>
                        {idea.format || 'Post'}
                      </div>
                      
                      <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px', marginBottom: '16px', position: 'relative' }}>
                        <p style={{ color: '#fff', fontSize: '14px', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap', paddingRight: '50px' }}>{idea.caption}</p>
                        <button 
                          onClick={(e) => {
                            navigator.clipboard.writeText(idea.caption);
                            const btn = e.currentTarget;
                            const originalText = btn.innerHTML;
                            btn.innerHTML = 'Copied!';
                            setTimeout(() => { btn.innerHTML = originalText; }, 2000);
                          }}
                          style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(255,255,255,0.1)', border: 'none', color: c.muted, padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', transition: 'all 0.2s' }}
                          onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                          onMouseLeave={e => e.currentTarget.style.color = c.muted}
                        >
                          Copy
                        </button>
                      </div>

                      <div>
                        <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: c.muted, marginBottom: '4px', fontWeight: 700, letterSpacing: '0.05em' }}>Why it works</h4>
                        <p style={{ color: c.muted, fontSize: '13px', margin: 0, lineHeight: '1.5' }}>{idea.why_it_works}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                 <div style={{ textAlign: 'center', padding: '80px 0', color: c.muted, background: 'rgba(255,255,255,0.01)', borderRadius: '24px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>📱</div>
                  <p style={{ fontSize: '16px', fontWeight: 500, color: c.ivory }}>Ready to create viral content?</p>
                  <p style={{ fontSize: '14px', marginTop: '8px' }}>Select a product and format, then click Generate Ideas.</p>
                </div>
              )}
            </div>
          ) : dailyReportOpen ? (
            /* Daily Report View */
            <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ ...sora, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.18em', color: c.primary, marginBottom: '8px' }}>{stores.find(s => s.id === selectedShop)?.name || 'Store'} • Daily Autonomous Report</div>
                  <h1 style={{ ...sora, fontSize: '28px', fontWeight: 800, color: '#fff', margin: '0 0 4px 0', letterSpacing: '-0.5px' }}>📊 Morning Snapshot</h1>
                  <p style={{ color: c.muted, margin: 0, fontSize: '14px' }}>{new Date(dailyReportDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="date"
                    value={dailyReportDate}
                    onChange={e => { setDailyReportDate(e.target.value); fetchDailyReport(e.target.value, selectedShop); }}
                    style={{ background: c.panel, border: `1px solid ${c.line}`, color: c.ivory, padding: '10px 16px', borderRadius: '12px', fontSize: '14px', outline: 'none', cursor: 'pointer' }}
                  />
                  <button onClick={() => { window.location.hash = ''; }} style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${c.line}`, color: c.muted, padding: '10px 16px', borderRadius: '12px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>← Back</button>
                </div>
              </div>

              {dailyReportLoading ? (
                <div style={{ textAlign: 'center', padding: '80px 0', color: c.muted }}>
                  <div style={{ fontSize: '40px', marginBottom: '16px', animation: 'spin 1s linear infinite' }}>⏳</div>
                  <p>Generating report...</p>
                </div>
              ) : dailyReport ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* Stats Grid - 4 columns */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    {[
                      { label: 'New Leads', value: dailyReport.new_leads_count, icon: '🆕', color: '#0ea5e9' },
                      { label: 'Hot Prospects', value: dailyReport.hot_prospects_count, icon: '🔥', color: '#f85149' },
                      { label: 'Pending Handoffs', value: dailyReport.pending_handoffs_count, icon: '🤝', color: '#f59e0b' },
                      { label: 'Conversations', value: dailyReport.total_conversations_today, icon: '💬', color: '#a78bfa' },
                    ].map((stat, i) => (
                      <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '24px', backdropFilter: 'blur(12px)', transition: 'all 0.3s' }}
                           onMouseEnter={e => { e.currentTarget.style.borderColor = stat.color + '40'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                           onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                        <div style={{ fontSize: '28px', marginBottom: '12px' }}>{stat.icon}</div>
                        <div style={{ ...mono, fontSize: '36px', fontWeight: 800, color: stat.color, marginBottom: '4px' }}>{stat.value}</div>
                        <div style={{ ...inter, fontSize: '13px', color: c.muted, fontWeight: 500 }}>{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Sales Summary + Intent Score */}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '28px', backdropFilter: 'blur(12px)' }}>
                      <div style={{ ...sora, fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: c.primary, marginBottom: '20px' }}>💰 Sales Summary</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
                        <div>
                          <div style={{ ...mono, fontSize: '32px', fontWeight: 800, color: '#22c55e' }}>{dailyReport.orders_today}</div>
                          <div style={{ fontSize: '13px', color: c.muted, marginTop: '4px' }}>Orders Today</div>
                        </div>
                        <div>
                          <div style={{ ...mono, fontSize: '32px', fontWeight: 800, color: '#22c55e' }}>₹{dailyReport.revenue_today?.toLocaleString() || '0'}</div>
                          <div style={{ fontSize: '13px', color: c.muted, marginTop: '4px' }}>Revenue</div>
                        </div>
                        <div>
                          <div style={{ ...mono, fontSize: '32px', fontWeight: 800, color: dailyReport.conversion_rate_today > 10 ? '#22c55e' : '#f59e0b' }}>{dailyReport.conversion_rate_today}%</div>
                          <div style={{ fontSize: '13px', color: c.muted, marginTop: '4px' }}>Conversion Rate</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '28px', backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ ...mono, fontSize: '48px', fontWeight: 800, color: dailyReport.avg_intent_score_today >= 7 ? '#22c55e' : dailyReport.avg_intent_score_today >= 4 ? '#f59e0b' : c.muted }}>{dailyReport.avg_intent_score_today}</div>
                      <div style={{ fontSize: '13px', color: c.muted, marginTop: '8px', textAlign: 'center' }}>Avg Intent Score</div>
                      <div style={{ width: '80%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', marginTop: '12px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(dailyReport.avg_intent_score_today * 10, 100)}%`, height: '100%', background: `linear-gradient(90deg, ${c.primary}, #3a7bd5)`, borderRadius: '3px', transition: 'width 0.6s ease' }}></div>
                      </div>
                    </div>
                  </div>

                  {/* Segment Breakdown + Top Products */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {/* Segment Breakdown */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '28px', backdropFilter: 'blur(12px)' }}>
                      <div style={{ ...sora, fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: c.primary, marginBottom: '20px' }}>📈 Segment Breakdown</div>
                      {dailyReport.segment_breakdown && Object.keys(dailyReport.segment_breakdown).length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {Object.entries(dailyReport.segment_breakdown).map(([seg, count]) => {
                            const total = Object.values(dailyReport.segment_breakdown).reduce((a, b) => a + b, 0);
                            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                            const segColors = { HOT: '#f85149', WARM: '#f59e0b', COLD: '#8b949e', CUSTOMER: '#22c55e' };
                            return (
                              <div key={seg}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                  <span style={{ fontSize: '13px', fontWeight: 600, color: segColors[seg] || c.muted }}>{seg}</span>
                                  <span style={{ ...mono, fontSize: '13px', color: c.ivory }}>{count} ({pct}%)</span>
                                </div>
                                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                                  <div style={{ width: `${pct}%`, height: '100%', background: segColors[seg] || c.muted, borderRadius: '4px', transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ color: c.muted, fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>No segment data available</div>
                      )}
                    </div>

                    {/* Top Products */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '28px', backdropFilter: 'blur(12px)' }}>
                      <div style={{ ...sora, fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: c.primary, marginBottom: '20px' }}>🏆 Top Products Today</div>
                      {dailyReport.top_products_today && dailyReport.top_products_today.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          {dailyReport.top_products_today.map((prod, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: i === 0 ? 'linear-gradient(135deg, #f59e0b, #d97706)' : i === 1 ? 'linear-gradient(135deg, #94a3b8, #64748b)' : 'linear-gradient(135deg, #a16207, #92400e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 800, color: '#fff' }}>
                                {i + 1}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{prod.name}</div>
                                <div style={{ fontSize: '12px', color: c.muted }}>{prod.count} order{prod.count !== 1 ? 's' : ''}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ color: c.muted, fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>No orders today yet</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '80px 0', color: c.muted }}>
                  <p>Select a date to view the report.</p>
                </div>
              )}
            </div>
          ) : !selectedShop && isSuperAdmin ? (
            /* Connected Businesses View */
            <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                <div>
                  <h1 style={{ ...sora.style, fontSize: '28px', fontWeight: 800, color: '#fff', margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>Connected Businesses</h1>
                  <p style={{ color: c.muted, margin: 0, fontSize: '15px' }}>Overview ({stores.length} Stores Active)</p>
                </div>
              </div>

              <div className="dash-stores-grid">
                {stores.map(s => (
                  <div key={s.id} onClick={() => setSelectedShop(s.id)} style={{
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px', padding: '24px',
                    cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', backdropFilter: 'blur(12px)',
                    position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '20px'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(14,165,233,0.3)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.4), 0 0 20px rgba(14,165,233,0.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.boxShadow = 'none'; }}>
                    
                    {/* Header Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(14,165,233,0.15), rgba(59,130,246,0.05))', border: '1px solid rgba(14,165,233,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 800, color: '#0ea5e9', boxShadow: 'inset 0 0 20px rgba(14,165,233,0.05)' }}>
                          {s.icon || (s.name ? s.name.charAt(0).toUpperCase() : 'S')}
                        </div>
                        <div>
                          <div style={{ ...sora.style, fontSize: '20px', fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>{s.name}</div>
                          <div style={{ fontSize: '13px', color: c.muted, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }}></span>
                            {s.category || 'Retail E-commerce'}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setForceResetOpen(s); }}
                          style={{ background: 'transparent', color: c.muted, border: `1px solid ${c.line}`, padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = c.panel2; e.currentTarget.style.color = '#fff'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c.muted; }}
                        >
                          Reset Pwd
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setStoreToDelete(s); setStoreDeleteInput(''); }}
                          style={{ background: 'transparent', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)'; }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Stats Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.02)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: c.muted, fontSize: '12px', fontWeight: 500 }}>
                          🤖 AI Agents
                        </div>
                        <div style={{ ...mono.style, fontSize: '24px', fontWeight: 700, color: '#fff' }}>{s.agents || 1}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: c.muted, fontSize: '12px', fontWeight: 500 }}>
                          💰 Sales
                        </div>
                        <div style={{ ...mono.style, fontSize: '24px', fontWeight: 700, color: '#22c55e' }}>{s.id === 'urban-threads' ? 45 : (s.id === 'sharma-electronics' ? 12 : 0)}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: c.muted, fontSize: '12px', fontWeight: 500 }}>
                          🔥 Hot Leads
                        </div>
                        <div style={{ ...mono.style, fontSize: '24px', fontWeight: 700, color: '#f59e0b' }}>{s.id === 'urban-threads' ? 14 : (s.id === 'sharma-electronics' ? 8 : 0)}</div>
                      </div>
                    </div>

                    {/* Footer Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      <div style={{ fontSize: '13px', color: '#0ea5e9', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
                        View Dashboard
                      </div>
                      <div style={{ color: c.muted, fontSize: '12px', fontWeight: 500 }}>
                        Synced: Just now
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Store Detail View */
            <div>

        {/* Top Row: Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '24px' }}>
          {[
            { 
              label: 'Total Customers', 
              val: total, 
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
              trend: '+12.5%',
              trendUp: true
            },
            { 
              label: 'Orders Placed', 
              val: analytics?.orders_placed || 0,
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>,
              trend: '+8.2%',
              trendUp: true
            },
            { 
              label: 'AI Conversations', 
              val: analytics?.total_conversations || 0,
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>,
              trend: '+24.1%',
              trendUp: true
            },
            { 
              label: 'HOT Leads', 
              val: hotCount, 
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2c0 0-5 6.5-5 11a5 5 0 0 0 10 0c0-4.5-5-11-5-11z"></path></svg>,
              trend: '+5.4%',
              trendUp: true
            },
            { 
              label: 'WARM Leads', 
              val: warmCount, 
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>,
              trend: 'Stable',
              trendUp: true
            },
            { 
              label: 'COLD Leads', 
              val: coldCount, 
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>,
              trend: '-2.0%',
              trendUp: false
            },
          ].map((stat, i) => (
            <div key={i} style={{
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              boxShadow: 'var(--shadow-sm)',
              transition: 'transform 0.2s',
              cursor: 'default',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--primary)', padding: '8px', borderRadius: '8px' }}>
                  {stat.icon}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '600', color: stat.trendUp ? 'var(--cust)' : 'var(--hot)' }}>
                  {stat.trendUp ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"></polyline><polyline points="16 17 22 17 22 11"></polyline></svg>
                  )}
                  {stat.trend}
                </div>
              </div>
              <div style={{ color: 'var(--muted)', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--ivory)' }}>
                {stat.val}
              </div>
            </div>
          ))}
        </div>
        {/* Row 2: Sales Performance & Lead Funnel */}
        <div className="dash-main-grid">
          {/* Left: Sales Performance */}
          <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', minHeight: '360px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#fff', margin: 0 }}>Sales Performance</h2>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--muted)' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }}></span> This Week</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--muted)' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--line)' }}></span> Last Week</div>
              </div>
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyData.length > 0 ? weeklyData : [
                  { name: 'Mon', leads: 0, hot: 0, orders: 0 },
                  { name: 'Tue', leads: 0, hot: 0, orders: 0 },
                  { name: 'Wed', leads: 0, hot: 0, orders: 0 },
                  { name: 'Thu', leads: 0, hot: 0, orders: 0 },
                  { name: 'Fri', leads: 0, hot: 0, orders: 0 },
                  { name: 'Sat', leads: 0, hot: 0, orders: 0 },
                  { name: 'Sun', leads: 0, hot: 0, orders: 0 },
                ]} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--panel2)', border: '1px solid var(--line)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }} 
                    itemStyle={{ fontWeight: 600, fontFamily: 'var(--font-inter)' }}
                  />
                  <Area type="monotone" dataKey="orders" name="Orders" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                  <Line type="monotone" dataKey="hot" name="Hot Leads" stroke="var(--muted)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right: Lead Funnel */}
          <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#fff', marginBottom: '8px' }}>Lead Funnel</h2>
            <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '32px' }}>Conversion breakdown from all AI conversations.</p>
            
            {analytics && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, justifyContent: 'center' }}>
                {[
                  { label: 'Conversations', count: analytics.total_conversations, color: 'var(--primary)' },
                  { label: 'Warm+ Leads', count: analytics.warm_or_above, color: 'var(--accent-purple)' },
                  { label: 'Hot Leads', count: analytics.hot_or_above, color: 'var(--hot)' },
                  { label: 'Orders Placed', count: analytics.orders_placed, color: 'var(--cust)' },
                ].map((stage, i, arr) => {
                  const max = Math.max(1, arr[0].count);
                  const width = Math.max(2, (stage.count / max) * 100);
                  const percent = Math.round((stage.count / max) * 100);
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--muted)' }}>{stage.label}</div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>{stage.count} <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: '500' }}>({percent}%)</span></div>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${width}%`, height: '100%', background: stage.color, borderRadius: '4px', transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Row 3: Needs Attention & Market Segments */}
        <div className="dash-main-grid">
          {/* Left: Needs Attention */}
          <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#fff', margin: 0 }}>Needs Attention</h2>
              {pendingHandoffs.length > 0 && (
                <span style={{ background: 'var(--hot)', color: '#fff', fontSize: '11px', fontWeight: '800', padding: '4px 10px', borderRadius: '12px' }}>
                  {pendingHandoffs.length} Pending
                </span>
              )}
            </div>

            {handoffs.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '14px', padding: '40px 0' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px' }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                All caught up! No handoffs requested.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '340px', overflowY: 'auto', paddingRight: '4px' }}>
                {pendingHandoffs.map(h => (
                  <div key={h.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontWeight: '700', color: 'var(--ivory)', fontSize: '14px', marginBottom: '4px' }}>
                          {h.name || 'Unknown Customer'}
                        </div>
                        <div style={{ color: 'var(--hot)', fontSize: '13px', fontWeight: '500' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px', verticalAlign: 'middle' }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                          Reason: {h.reason}
                        </div>
                      </div>
                      <div style={{ color: 'var(--muted)', fontSize: '11px', fontWeight: '500' }}>
                        {new Date(h.created_at + (h.created_at.endsWith('Z') ? '' : 'Z')).toLocaleString('en-IN', {
                          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                        })}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <textarea 
                        placeholder="Type reply (e.g. Please pay at UPI ID: ...)" 
                        value={replyTexts[h.id] || ''}
                        onChange={(e) => setReplyTexts(prev => ({ ...prev, [h.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(h.id); } }}
                        style={{ 
                          width: '100%', border: '1px solid var(--line)', borderRadius: '8px', padding: '10px 12px',
                          fontSize: '13px', background: 'rgba(0,0,0,0.2)', color: 'var(--ivory)', outline: 'none',
                          minHeight: '60px', resize: 'vertical', fontFamily: 'var(--font-inter)'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => sendReply(h.id)} style={{ flex: 1, background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                          Send Message
                        </button>
                        <button onClick={() => resolveHandoff(h.id)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--muted)', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          Resolve
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Market Segments */}
          <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#fff', marginBottom: '8px' }}>Market Segments</h2>
            <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '24px' }}>Customer distribution by city tiers and acquisition source.</p>
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ width: '140px', height: '140px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={segments?.tiers?.length > 0 ? segments.tiers : [{ tier: 'Tier-1', count: 1 }]}
                        cx="50%" cy="50%" innerRadius={45} outerRadius={60}
                        paddingAngle={5} dataKey="count" stroke="none"
                      >
                        {(segments?.tiers?.length > 0 ? segments.tiers : [{ tier: 'Tier-1', count: 1 }]).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['var(--primary)', 'var(--accent-purple)', 'var(--accent-cyan)', 'var(--muted)'][index % 4]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'var(--panel2)', border: '1px solid var(--line)', borderRadius: '8px' }} itemStyle={{ color: '#fff', fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ flex: 1, paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted)', letterSpacing: '0.05em' }}>BY TIER</div>
                  {(segments?.tiers || []).map((t, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#fff' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: ['var(--primary)', 'var(--accent-purple)', 'var(--accent-cyan)', 'var(--muted)'][i % 4] }}></span>
                        {t.tier}
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>{t.count}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderTop: '1px solid var(--line)', paddingTop: '24px' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted)', letterSpacing: '0.05em', marginBottom: '12px' }}>TOP SOURCE</div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--accent-green)', textTransform: 'capitalize' }}>
                    {segments?.sources?.[0]?.source || 'Website'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>{segments?.sources?.[0]?.count || 0} customers</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted)', letterSpacing: '0.05em', marginBottom: '12px' }}>TOP LTV CUSTOMER</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {segments?.top_customers?.[0]?.name || 'No data'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>₹{segments?.top_customers?.[0]?.lifetime_value || 0}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 4: Recent Customers */}
        <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '16px', overflow: 'hidden', marginBottom: '40px' }}>
          <div style={{ padding: '24px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#fff', margin: 0 }}>Recent Customers</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--cust)', fontWeight: '600' }}>
               <div style={{ width: '8px', height: '8px', background: 'var(--cust)', borderRadius: '50%', boxShadow: '0 0 10px var(--cust)' }} />
               Live Sync
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontSize: '12px', fontWeight: '600', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '16px 24px', fontWeight: '600' }}>NAME</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600' }}>STATUS</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600' }}>LTV</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600' }}>TIER</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600' }}>SOURCE</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600' }}>TIME</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px', fontSize: '14px' }}>No live activity yet.</td>
                  </tr>
                ) : (
                  customers.slice(0, 15).map(cust => (
                    <tr 
                      key={cust.id} 
                      style={{ borderBottom: '1px solid var(--line)', transition: 'background 0.2s', cursor: 'pointer' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      onClick={() => viewOrders(cust.id)}
                    >
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: '#fff' }}>
                            {cust.name ? cust.name.charAt(0).toUpperCase() : '?'}
                          </div>
                          <div>
                            <div style={{ fontWeight: '600', color: '#fff', fontSize: '14px' }}>{cust.name || 'Anonymous'}</div>
                            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{cust.city || 'Unknown City'}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ 
                          display: 'inline-block', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700',
                          background: cust.segment === 'HOT' ? 'rgba(244, 63, 94, 0.1)' : cust.segment === 'CUSTOMER' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(139, 92, 246, 0.1)',
                          color: cust.segment === 'HOT' ? 'var(--hot)' : cust.segment === 'CUSTOMER' ? 'var(--accent-green)' : 'var(--accent-purple)'
                        }}>
                          {cust.segment}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', fontWeight: '600', color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>
                        ₹{cust.lifetime_value || 0}
                      </td>
                      <td style={{ padding: '16px 24px', color: 'var(--ivory)', fontSize: '13px' }}>
                        {cust.tier || '-'}
                      </td>
                      <td style={{ padding: '16px 24px', color: 'var(--ivory)', fontSize: '13px', textTransform: 'capitalize' }}>
                        {cust.source || 'website'}
                      </td>
                      <td style={{ padding: '16px 24px', color: 'var(--muted)', fontSize: '12px' }}>
                        {cust.last_interaction ? new Date(cust.last_interaction + (cust.last_interaction.endsWith('Z') ? '' : 'Z')).toLocaleString('en-IN', {
                          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                        }) : 'just now'}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCustomer(e, cust.id);
                            }}
                            style={{ background: 'transparent', color: 'var(--hot)', border: '1px solid var(--hot)', borderRadius: '6px', padding: '6px 8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Delete"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                          </button>
                          <button 
                            onClick={(e) => viewConversation(e, cust.id, cust.name)}
                            style={{ background: 'transparent', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Referrals Section */}
        <div style={{ ...styles.card, marginTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <h2 style={styles.sectionTitle}>🎁 Referral Engine</h2>
            <span style={styles.badge(c.primary, '#fff')}>{referrals.length} Total</span>
          </div>
          {referrals.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: c.muted, fontSize: '15px' }}>
              No referrals generated yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {referrals.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: c.ivory }}>Referrer: {r.referrer_name}</div>
                    <div style={{ fontSize: '13px', color: c.muted }}>Referred: {r.referred_name}</div>
                    <div style={{ fontSize: '11px', color: c.muted, marginTop: '4px' }}>Code: {r.referral_code}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    {r.reward_status === 'earned' ? (
                      <span style={styles.badge(c.cust, '#fff')}>Earned ₹{r.reward_amount}</span>
                    ) : (
                      <span style={styles.badge(c.muted, '#fff')}>Pending</span>
                    )}
                    <div style={{ fontSize: '11px', color: c.muted }}>
                      {new Date(r.created_at + (r.created_at.endsWith('Z') ? '' : 'Z')).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

            </div>
          )}
        </div>
      </div>

      {showOrderModal && (
        <div className="modal-overlay" onClick={() => setShowOrderModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowOrderModal(false)}>✖</button>
            <h2 style={{ ...styles.sectionTitle, marginBottom: '24px' }}>Order History</h2>
            {selectedOrders && selectedOrders.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {selectedOrders.map((o, idx) => (
                  <div key={idx} className="order-item">
                    <div>
                      <div style={{ fontWeight: 600, color: c.ivory }}>{o.product_name || 'Unknown Product'}</div>
                      <div style={{ fontSize: '12px', color: c.muted, marginTop: '4px' }}>Order ID: {o.id}</div>
                      <div style={{ fontSize: '12px', color: c.muted, marginTop: '2px' }}>
                        {new Date(o.created_at + (o.created_at.endsWith('Z') ? '' : 'Z')).toLocaleString('en-IN', {
                          day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true
                        })}
                      </div>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: c.cust }}>₹{o.amount}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: c.muted, padding: '32px 0' }}>No orders found for this customer.</div>
            )}
          </div>
        </div>
      )}

      {showConvoModal && (
        <div className="modal-overlay" onClick={() => setShowConvoModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <button className="modal-close" onClick={() => setShowConvoModal(false)}>✖</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: `${c.primary}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.primary, fontSize: '18px' }}>💬</div>
              <div>
                <h2 style={{ ...styles.sectionTitle, margin: 0 }}>Conversation History</h2>
                <div style={{ color: c.muted, fontSize: '13px', marginTop: '4px' }}>{selectedCustName}</div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '8px', marginBottom: '16px' }}>
              {selectedConvo && selectedConvo.length > 0 ? (
                selectedConvo.map((msg, idx) => (
                  <div key={idx}>
                    {msg.message && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                        <div style={{ background: `${c.primary}22`, border: `1px solid ${c.primary}33`, borderRadius: '16px 16px 4px 16px', padding: '12px 16px', maxWidth: '80%', color: c.ivory, fontSize: '14px', lineHeight: '1.5' }}>
                          {msg.message}
                        </div>
                      </div>
                    )}
                    {msg.reply && (
                      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ background: c.panel2, border: `1px solid ${c.line}`, borderRadius: '16px 16px 16px 4px', padding: '12px 16px', maxWidth: '80%', color: c.ivory, fontSize: '14px', lineHeight: '1.5' }}>
                          <div style={{ fontSize: '11px', color: c.primary, fontWeight: 700, marginBottom: '6px', ...mono }}>AI AGENT</div>
                          {msg.reply}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', color: c.muted, padding: '40px 0' }}>No conversation history found.</div>
              )}
            </div>

            {selectedOrders && selectedOrders.length > 0 && (
              <div style={{ borderTop: `1px solid ${c.line}`, paddingTop: '16px' }}>
                <div style={{ ...mono, fontSize: '11px', color: c.cust, fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '.1em' }}>📦 Orders ({selectedOrders.length})</div>
                {selectedOrders.map((o, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: idx < selectedOrders.length - 1 ? `1px solid ${c.line}` : 'none' }}>
                    <div style={{ fontSize: '13px', color: c.ivory }}>{o.product_name || 'Product'}</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: c.cust }}>₹{o.amount}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {deleteCustomerId && (
        <div className="modal-overlay" onClick={() => setDeleteCustomerId(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center', padding: '40px 32px' }}>
            <div style={{ background: 'rgba(248, 81, 73, 0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: c.hot }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </div>
            <h2 style={{ ...styles.sectionTitle, marginBottom: '12px', fontSize: '20px' }}>Delete Lead?</h2>
            <p style={{ color: c.muted, fontSize: '14px', marginBottom: '32px', lineHeight: '1.5' }}>
              Are you sure you want to permanently delete this lead? This action cannot be undone and will remove them from the database.
            </p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
              <button 
                style={{ flex: 1, padding: '12px', background: 'transparent', border: `1px solid ${c.line}`, borderRadius: '8px', color: c.ivory, cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.2s' }}
                onClick={() => setDeleteCustomerId(null)}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                Cancel
              </button>
              <button 
                style={{ flex: 1, padding: '12px', background: c.hot, border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(248,81,73,0.3)' }}
                onClick={confirmDelete}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {storeToDelete && (
        <div className="modal-overlay" onClick={() => setStoreToDelete(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center', padding: '40px 32px' }}>
            <div style={{ background: 'rgba(248, 81, 73, 0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: c.hot }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </div>
            <h2 style={{ ...styles.sectionTitle, marginBottom: '12px', fontSize: '20px' }}>Delete Store: {storeToDelete.name}?</h2>
            <p style={{ color: c.muted, fontSize: '14px', marginBottom: '24px', lineHeight: '1.5' }}>
              Are you sure you want to permanently delete this store and ALL its related data (customers, orders, conversations)? This action CANNOT be undone.
            </p>
            <div style={{ marginBottom: '32px', textAlign: 'left' }}>
              <label style={{ display: 'block', fontSize: '12px', color: c.muted, marginBottom: '8px', fontWeight: 600 }}>Type DELETE to confirm</label>
              <input 
                type="text" 
                value={storeDeleteInput}
                onChange={e => setStoreDeleteInput(e.target.value)}
                placeholder="DELETE"
                style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: `1px solid ${storeDeleteInput === 'DELETE' ? c.hot : c.line}`, color: c.ivory, padding: '12px', borderRadius: '8px', outline: 'none', transition: 'all 0.2s' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
              <button 
                style={{ flex: 1, padding: '12px', background: 'transparent', border: `1px solid ${c.line}`, borderRadius: '8px', color: c.ivory, cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.2s' }}
                onClick={() => setStoreToDelete(null)}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                Cancel
              </button>
              <button 
                disabled={storeDeleteInput !== 'DELETE'}
                style={{ flex: 1, padding: '12px', background: c.hot, border: 'none', borderRadius: '8px', color: '#fff', cursor: storeDeleteInput === 'DELETE' ? 'pointer' : 'not-allowed', fontSize: '14px', fontWeight: 600, transition: 'all 0.2s', boxShadow: storeDeleteInput === 'DELETE' ? '0 4px 12px rgba(248,81,73,0.3)' : 'none', opacity: storeDeleteInput === 'DELETE' ? 1 : 0.5 }}
                onClick={confirmDeleteStore}
              >
                Yes, Delete Store
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
