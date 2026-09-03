'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import toast from 'react-hot-toast';

const rawApi = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const API_BASE = rawApi.replace(/\/+$/, '');
const CUSTOMERS_URL = `${API_BASE}/api/customers`;
const CONVERSATIONS_URL = `${API_BASE}/api/conversations`;
const HANDOFFS_URL = `${API_BASE}/api/handoffs`;
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
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('app-theme') || 'dark';
    setTheme(savedTheme);
  }, []);

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  const [selectedShop, setSelectedShop] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [handoffs, setHandoffs] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteCustomerId, setDeleteCustomerId] = useState(null);
  const [selectedOrders, setSelectedOrders] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [replyTexts, setReplyTexts] = useState({});
  const [weeklyData, setWeeklyData] = useState([]);
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [selectedCustName, setSelectedCustName] = useState('');
  const [showConvoModal, setShowConvoModal] = useState(false);

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
      const res = await fetch(`${API_BASE}/api/customers/${customerId}/orders`);
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
      const res = await fetch(`${API_BASE}/api/customers/${cid}`, { method: 'DELETE' });
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

  const handleDeleteCustomer = (e, customerId) => {
    e.stopPropagation();
    setDeleteCustomerId(customerId);
  };

  const fetchCustomers = async (isPolling = false, shopId = selectedShop) => {
    if (!isPolling) setLoading(true);
    try {
      const qs = shopId ? `?shop=${shopId}` : '';
      const res = await fetch(`${CUSTOMERS_URL}${qs}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }

      const hRes = await fetch(HANDOFFS_URL);
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

      const aRes = await fetch(`${ANALYTICS_URL}${qs}`);
      if (aRes.ok) {
        setAnalytics(await aRes.json());
      }

      const wRes = await fetch(WEEKLY_URL);
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

  useEffect(() => {
    fetchCustomers(false, selectedShop);
    const intervalId = setInterval(() => {
      fetchCustomers(true, selectedShop);
    }, 3000);
    return () => clearInterval(intervalId);
  }, [selectedShop]);
    
  const stores = [
    { id: 'clothing', name: 'Urban Threads', category: 'E-commerce Shop', icon: '👕', agents: 12, sales: '$142,500', leads: 85 },
    { id: 'electronics', name: 'Sharma Electronics', category: 'Tech Retailer', icon: '💻', agents: 9, sales: '$98,320', leads: 58 }
  ];

  const total = customers.length;
  const hotCount = customers.filter(c => c.segment === 'HOT').length;
  const warmCount = customers.filter(c => c.segment === 'WARM').length;
  const coldCount = customers.filter(c => c.segment === 'COLD').length;
  const pendingHandoffs = handoffs.filter(h => h.status === 'pending');

  return (
    <div className="dash-page" style={{ display: 'flex', minHeight: '100vh' }}>
      
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 190 }} onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`dash-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div style={{ ...styles.navBrand, padding: '0 24px', marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '20px', fontWeight: '800' }}>
          <span style={{ color: '#0ea5e9' }}>▲</span> AI SALES AGENT
        </div>
        
        <div style={{ padding: '0 12px' }}>
          <div style={{ padding: '12px', color: !selectedShop ? c.ivory : c.muted, fontSize: '14px', fontFamily: 'var(--font-inter, sans-serif)', display: 'flex', gap: '12px', background: !selectedShop ? 'rgba(14,165,233,0.1)' : 'transparent', border: !selectedShop ? '1px solid rgba(14,165,233,0.2)' : '1px solid transparent', borderRadius: '8px', cursor: 'pointer' }}
               onClick={() => setSelectedShop(null)}>
            <span>🏪</span> My Stores
          </div>

          <div style={{ padding: '12px', color: selectedShop ? c.ivory : c.muted, fontSize: '14px', fontFamily: 'var(--font-inter, sans-serif)', display: 'flex', gap: '12px', background: selectedShop ? 'rgba(14,165,233,0.1)' : 'transparent', border: selectedShop ? '1px solid rgba(14,165,233,0.2)' : '1px solid transparent', borderRadius: '8px', cursor: selectedShop ? 'pointer' : 'default', marginTop: '8px', opacity: selectedShop ? 1 : 0.6 }}
               onClick={() => { if(!selectedShop && stores.length > 0) setSelectedShop(stores[0].id) }}>
            <span>🏠</span> Store Dashboard
          </div>

          <div style={{ padding: '12px', color: c.muted, fontSize: '14px', fontFamily: 'var(--font-inter, sans-serif)', display: 'flex', gap: '12px', cursor: 'not-allowed', marginTop: '8px', opacity: 0.5 }}>
            <span>⚙️</span> AI Settings <span style={{fontSize:'10px', background:'rgba(255,255,255,0.1)', padding:'2px 6px', borderRadius:'4px', marginLeft:'auto'}}>Soon</span>
          </div>
          <div style={{ padding: '12px', color: c.muted, fontSize: '14px', fontFamily: 'var(--font-inter, sans-serif)', display: 'flex', gap: '12px', cursor: 'not-allowed', marginTop: '8px', opacity: 0.5 }}>
            <span>📊</span> Analytics <span style={{fontSize:'10px', background:'rgba(255,255,255,0.1)', padding:'2px 6px', borderRadius:'4px', marginLeft:'auto'}}>Soon</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="dash-main">
        <nav className="dash-navbar" style={{ background: 'transparent', borderBottom: 'none' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <button 
              className="dash-hamburger"
              style={{ background: 'transparent', border: 'none', color: c.ivory, cursor: 'pointer', marginRight: '16px', display: 'none' }}
              onClick={() => setSidebarOpen(true)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              style={{
                background: 'var(--panel2)', border: '1px solid var(--line)', color: 'var(--ivory)',
                cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 16px', borderRadius: '24px', fontWeight: 'bold'
              }}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#0ea5e9', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>A</div>
          </div>
        </nav>

        <div className="dash-wrap" style={{ padding: '0 40px 100px', flex: 1, overflowY: 'auto' }}>
          
          {!selectedShop ? (
            /* Connected Businesses View */
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                <div>
                  <h1 className="dash-h1" style={{ marginBottom: '8px' }}>Connected Businesses</h1>
                  <p style={{ color: c.muted, margin: 0, fontSize: '15px' }}>Overview ({stores.length} Stores Active)</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {stores.map(s => (
                  <div key={s.id} onClick={() => setSelectedShop(s.id)} style={{
                    background: c.panel, border: `1px solid rgba(14,165,233,0.3)`, borderRadius: '16px', padding: '24px',
                    cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 8px 32px rgba(14,165,233,0.05)',
                    position: 'relative', overflow: 'hidden'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60px', background: 'linear-gradient(to top, rgba(14,165,233,0.1), transparent)' }}></div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                          {s.icon}
                        </div>
                        <div>
                          <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{s.name}</div>
                          <div style={{ fontSize: '13px', color: c.muted, marginTop: '4px' }}>{s.category}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 10px #22c55e' }}></div>
                        <span style={{ fontSize: '20px', color: c.muted }}>...</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderTop: `1px solid ${c.line}`, borderBottom: `1px solid ${c.line}`, marginBottom: '16px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: c.muted, fontSize: '12px', marginBottom: '4px' }}>
                          <span>🤖</span> Active AI Agents
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>{s.agents}</div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: c.muted, fontSize: '12px', marginBottom: '4px' }}>
                          <span>💰</span> Total Sales
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>{analytics?.orders_placed || 0}</div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: c.muted, fontSize: '12px', marginBottom: '4px' }}>
                          <span>🔥</span> Hot Leads
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>{analytics?.hot_or_above || 0}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2 }}>
                      <div style={{ fontSize: '13px', color: '#0ea5e9', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
                        Performance Graph
                      </div>
                      <div style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, border: '1px solid rgba(34,197,94,0.2)' }}>
                        status <span style={{display:'inline-block', width:'6px', height:'6px', borderRadius:'50%', background:'#22c55e', marginLeft:'4px'}}></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Store Detail View */
            <div>
              <button 
                onClick={() => setSelectedShop(null)}
                style={{ background: 'transparent', border: 'none', color: '#0ea5e9', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontWeight: 600, padding: 0 }}
              >
                ← Back to Stores
              </button>
              
              {/* Header Title */}
              <div style={styles.eyebrow}>AI CRM • {stores.find(s => s.id === selectedShop)?.name}</div>
              <div style={styles.titleRow}>
                <h1 className="dash-h1">Customer Overview</h1>
              </div>
              <p style={styles.sub}>Monitor your live AI sales leads and manage customer handoffs for this store.</p>

        {/* Top Row: Stat Cards */}
        <div className="dash-stats-grid">
          {[
            { label: 'Total Customers', val: total, color: c.ivory },
            { label: 'HOT Leads', val: hotCount, color: c.hot },
            { label: 'WARM Leads', val: warmCount, color: c.warm },
            { label: 'COLD Leads', val: coldCount, color: c.cold },
          ].map((stat, i) => (
            <div key={i} style={styles.statCard}>
              <div style={styles.statLabel}>{stat.label}</div>
              <div style={{ ...styles.statVal, color: stat.color }}>{stat.val}</div>
            </div>
          ))}
        </div>
{/* Middle Row: Graph & Needs Attention */}
        <div className="dash-main-grid">
          
          {/* Left: Performance & Graph */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {analytics && (
              <div style={styles.card}>
                <h2 style={{ ...styles.sectionTitle, marginBottom: '24px' }}>Performance Overview</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {[
                    { label: 'Conversations', count: analytics.total_conversations },
                    { label: 'Warm+ Leads', count: analytics.warm_or_above },
                    { label: 'Hot Leads', count: analytics.hot_or_above },
                    { label: 'Orders Placed', count: analytics.orders_placed },
                  ].map((stage, i, arr) => {
                    const max = Math.max(1, arr[0].count);
                    const width = Math.max(2, (stage.count / max) * 100);
                    const percent = Math.round((stage.count / max) * 100);
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ flex: '0 0 100px', fontSize: '13px', fontWeight: 600, color: c.muted, textTransform: 'uppercase', letterSpacing: '.05em', textAlign: 'right' }}>
                          {stage.label}
                        </div>
                        <div style={styles.progressBg}>
                          <div style={styles.progressFill(width)} />
                        </div>
                        <div style={{ flex: '0 0 70px', ...mono, fontSize: '16px', fontWeight: 700, color: c.ivory }}>
                          {stage.count} <div style={{ fontSize: '11px', color: c.muted, fontWeight: 500 }}>({percent}%)</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ ...styles.card, padding: '28px 28px 12px 12px', height: '360px', display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ ...styles.sectionTitle, marginBottom: '24px', paddingLeft: '16px' }}>7-Day Intent Trend</h2>
              <div style={{ flex: 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyData.length > 0 ? weeklyData : [
                    { name: 'Mon', leads: 0, hot: 0, orders: 0 },
                    { name: 'Tue', leads: 0, hot: 0, orders: 0 },
                    { name: 'Wed', leads: 0, hot: 0, orders: 0 },
                    { name: 'Thu', leads: 0, hot: 0, orders: 0 },
                    { name: 'Fri', leads: 0, hot: 0, orders: 0 },
                    { name: 'Sat', leads: 0, hot: 0, orders: 0 },
                    { name: 'Sun', leads: 0, hot: 0, orders: 0 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2b3140" vertical={false} />
                    <XAxis dataKey="name" stroke="#8b949e" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#8b949e" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: c.panel, border: `1px solid ${c.line}`, borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }} 
                      itemStyle={{ fontWeight: 600, fontFamily: 'var(--font-inter, sans-serif)' }}
                    />
                    <Line type="monotone" dataKey="leads" name="Total Leads" stroke="#58a6ff" strokeWidth={4} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 8 }} />
                    <Line type="monotone" dataKey="hot" name="Hot Leads" stroke="#f85149" strokeWidth={4} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 8 }} />
                    <Line type="monotone" dataKey="orders" name="Orders" stroke="#3fb950" strokeWidth={4} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Right: Needs Attention */}
          <div style={styles.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h2 style={styles.sectionTitle}>Needs Attention</h2>
              {pendingHandoffs.length > 0 && (
                <span style={styles.badge(c.hot, '#fff')}>
                  {pendingHandoffs.length} Pending
                </span>
              )}
            </div>

            {handoffs.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: c.muted, fontSize: '15px' }}>
                No handoffs requested yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {pendingHandoffs.map(h => (
                  <div key={h.id} style={styles.handoffCard}>
                    <div style={{ flex: 1, marginRight: '16px' }}>
                      <div style={{ fontWeight: 700, color: c.ivory, marginBottom: '6px', fontSize: '15px' }}>
                        {h.name || 'Unknown Customer'}
                      </div>
                      <div style={{ color: c.hot, fontSize: '14px', fontWeight: 500 }}>
                        Reason: {h.reason}
                      </div>
                      <div style={{ color: c.muted, fontSize: '12px', marginTop: '8px' }}>
                        {new Date(h.created_at + (h.created_at.endsWith('Z') ? '' : 'Z')).toLocaleString('en-IN', {
                          day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true
                        })}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '180px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input 
                          type="text" 
                          className="manager-input"
                          placeholder="Type reply..." 
                          value={replyTexts[h.id] || ''}
                          onChange={(e) => setReplyTexts(prev => ({ ...prev, [h.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === 'Enter') sendReply(h.id); }}
                          style={{ 
                            flex: 1, 
                            border: `1px solid ${c.line}`, 
                            borderRadius: '8px', 
                            padding: '8px 12px',
                            fontSize: '13px',
                            background: c.panel2,
                            color: c.ivory,
                            outline: 'none'
                          }}
                        />
                        <button onClick={() => sendReply(h.id)} style={{ ...styles.resolveBtn, background: c.cust, color: '#fff', border: 'none' }}>
                          Send
                        </button>
                      </div>
                      <button onClick={() => resolveHandoff(h.id)} style={styles.resolveBtn}>
                        Mark as Resolved
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Row: Live Timeline Feed */}
        <div style={{ ...styles.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '24px 28px', borderBottom: `1px solid ${c.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={styles.sectionTitle}>Live Activity Feed</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: c.cust, fontWeight: 600 }}>
               <div style={{ width: '8px', height: '8px', background: c.cust, borderRadius: '50%', boxShadow: `0 0 10px ${c.cust}` }} />
               Syncing live...
            </div>
          </div>
          <div style={{ padding: '24px' }}>
            {customers.length === 0 ? (
              <div style={{ textAlign: 'center', color: c.muted, padding: '40px' }}>No live activity yet.</div>
            ) : (
              customers.slice(0, 15).map(cust => (
                <div 
                  key={cust.id} 
                  style={styles.feedCard}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = c.panel2;
                    e.currentTarget.style.transform = 'translateX(4px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = c.panel;
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                  onClick={() => viewOrders(cust.id)}
                >
                  <div style={{ ...styles.feedIcon, background: `${segColor(cust.segment)}20`, color: segColor(cust.segment) }}>
                    {cust.segment === 'HOT' ? '🔥' : cust.segment === 'CUSTOMER' ? '🛍️' : '💬'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: c.ivory, fontSize: '15px' }}>{cust.name || 'Anonymous Visitor'}</span>
                      <span style={styles.badge(segColor(cust.segment), segTextColor(cust.segment))}>{cust.segment}</span>
                    </div>
                    <div style={{ color: c.muted, fontSize: '13px' }}>
                      Intent Score: <strong style={{ color: c.ivory, ...mono }}>{cust.intent_score || 0}/100</strong> ΓÇó 
                      Last active: {cust.last_interaction ? new Date(cust.last_interaction + (cust.last_interaction.endsWith('Z') ? '' : 'Z')).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true
                      }) : 'just now'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button 
                      onClick={(e) => handleDeleteCustomer(e, cust.id)}
                      style={{ ...styles.resolveBtn, background: 'transparent', color: c.hot, border: `1px solid ${c.hot}`, padding: '8px 12px' }}
                      title="Delete"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                    <button 
                      onClick={(e) => viewConversation(e, cust.id, cust.name)}
                      style={{ ...styles.resolveBtn, background: 'transparent', color: c.primary, border: `1px solid ${c.primary}` }}
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
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


    </div>
  );
}
