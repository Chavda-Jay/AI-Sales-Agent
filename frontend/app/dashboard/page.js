'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const CUSTOMERS_URL = "http://localhost:3001/api/customers";
const CONVERSATIONS_URL = "http://localhost:3001/api/conversations";
const HANDOFFS_URL = "http://localhost:3001/api/handoffs";
const ANALYTICS_URL = "http://localhost:3001/api/analytics";

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

/* ─── Dark theme tokens ─── */
const c = {
  bg: '#0e1117',
  panel: '#161b22',
  panel2: '#1c2129',
  line: '#2b3140',
  muted: '#8b949e',
  ivory: '#e6edf3',
  primary: '#58a6ff',
  hot: '#f85149',
  warm: '#ffc107',
  cold: '#8b949e',
  cust: '#3fb950',
};

const styles = {
  page: {
    background: c.bg, minHeight: '100vh', color: c.ivory, ...inter,
  },
  wrap: {
    maxWidth: '1080px', margin: '0 auto', padding: '32px 24px 80px',
  },
  backBtn: {
    display: 'inline-flex', alignItems: 'center',
    background: c.panel2, color: c.primary, border: `1px solid ${c.primary}`,
    padding: '8px 16px', borderRadius: '12px',
    textDecoration: 'none', fontWeight: 700, ...sora, fontSize: '13px',
    marginBottom: '24px',
  },
  eyebrow: {
    ...sora, fontSize: '11px', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '.18em',
    color: c.primary, marginBottom: '6px',
  },
  titleRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  h1: {
    ...sora, fontSize: '28px', fontWeight: 800, color: c.ivory, margin: 0,
  },
  refreshBtn: {
    background: c.panel, border: `1px solid ${c.line}`, color: c.ivory,
    borderRadius: '8px', padding: '8px 16px', cursor: 'pointer',
    ...inter, fontSize: '13px', fontWeight: 600, transition: 'all 0.2s',
  },
  sub: {
    color: c.muted, fontSize: '14px', marginTop: '8px', marginBottom: '0',
  },
  sectionTitle: {
    ...sora, fontSize: '15px', fontWeight: 800, textTransform: 'uppercase',
    letterSpacing: '.06em', color: c.primary, margin: 0,
  },
  card: {
    background: c.panel, border: `1px solid ${c.line}`, borderRadius: '18px',
    padding: '22px',
  },
  statCard: {
    background: c.panel, border: `1px solid ${c.line}`, borderRadius: '18px',
    padding: '20px', textAlign: 'center',
  },
  statLabel: {
    ...mono, fontSize: '11px', textTransform: 'uppercase',
    letterSpacing: '.1em', color: c.muted, marginBottom: '8px',
  },
  statVal: {
    ...sora, fontSize: '32px', fontWeight: 800,
  },
  badge: (bg, color) => ({
    background: bg, color: color, padding: '4px 10px', borderRadius: '12px',
    fontSize: '11px', fontWeight: 700, display: 'inline-block',
    textTransform: 'uppercase',
  }),
  progressBg: {
    flex: 1, background: c.panel2, height: '40px', borderRadius: '6px',
    position: 'relative', overflow: 'hidden',
  },
  progressFill: (width) => ({
    width: `${width}%`, height: '100%',
    background: `linear-gradient(90deg, ${c.primary}, #3a7bd5)`,
    borderRadius: '6px', transition: 'width 0.6s ease',
  }),
  metricBadge: {
    background: c.panel, border: `1px solid ${c.line}`, padding: '6px 12px',
    borderRadius: '8px', color: c.ivory, fontSize: '13px', fontWeight: 600,
    display: 'flex', alignItems: 'center', gap: '8px',
  },
  table: {
    width: '100%', borderCollapse: 'collapse',
  },
  th: {
    ...mono, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.08em',
    color: c.muted, fontWeight: 700, padding: '12px 16px', textAlign: 'left',
    borderBottom: `1px solid ${c.line}`,
  },
  td: {
    padding: '14px 16px', borderBottom: `1px solid ${c.line}`, fontSize: '14px',
    color: c.ivory,
  },
  handoffCard: {
    background: c.panel, border: `1px solid ${c.line}`, borderRadius: '14px',
    padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    borderLeft: `4px solid ${c.hot}`,
  },
  resolveBtn: {
    background: c.panel2, border: `1px solid ${c.line}`, color: c.ivory,
    borderRadius: '8px', padding: '8px 16px', cursor: 'pointer',
    ...inter, fontSize: '12px', fontWeight: 600, transition: 'all 0.2s',
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr',
    gap: '24px',
    marginTop: '32px'
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: '32px'
  }
};

export default function Dashboard() {
  const [customers, setCustomers] = useState([]);
  const [handoffs, setHandoffs] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedOrders, setSelectedOrders] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);

  const viewOrders = async (customerId) => {
    try {
      const res = await fetch(`http://localhost:3001/api/customers/${customerId}/orders`);
      if (res.ok) {
        const data = await res.json();
        setSelectedOrders(data);
        setShowOrderModal(true);
      }
    } catch(e) {
      console.error(e);
    }
  };

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch(CUSTOMERS_URL);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }

      const hRes = await fetch(HANDOFFS_URL);
      if (hRes.ok) {
        setHandoffs(await hRes.json());
      }

      const aRes = await fetch(ANALYTICS_URL);
      if (aRes.ok) {
        setAnalytics(await aRes.json());
      }
    } catch (e) {
      console.error("Could not fetch customers", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const resolveHandoff = async (id) => {
    try {
      await fetch(`${HANDOFFS_URL}/${id}/resolve`, { method: 'POST' });
      setHandoffs(prev => prev.map(h => h.id === id ? { ...h, status: 'resolved' } : h));
    } catch (e) {
      console.error(e);
    }
  };

  const total = customers.length;
  const hotCount = customers.filter(c => c.segment === 'HOT').length;
  const warmCount = customers.filter(c => c.segment === 'WARM').length;
  const coldCount = customers.filter(c => c.segment === 'COLD').length;
  const pendingHandoffs = handoffs.filter(h => h.status === 'pending');

  return (
    <div style={styles.page}>
      <div style={styles.wrap}>

        {/* Back to Chat */}
        <Link href="/" style={styles.backBtn}>Back to Chat</Link>

        {/* Header */}
        <div style={styles.eyebrow}>CRM Dashboard</div>
        <div style={styles.titleRow}>
          <h1 style={styles.h1}>Customer Overview</h1>
          <button onClick={fetchCustomers} disabled={loading} style={{
            ...styles.refreshBtn,
            opacity: loading ? 0.6 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
        <p style={styles.sub}>Monitor your live AI sales leads and review conversation transcripts.</p>

        <div style={styles.gridContainer}>
          {/* Left Column */}
          <div style={styles.column}>
            {/* Performance Overview */}
            {analytics && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={styles.sectionTitle}>Performance Overview</h2>
                </div>
                <div style={{ ...styles.card, padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                        <div style={{ width: '110px', fontSize: '12px', fontWeight: 600, color: c.muted, textTransform: 'uppercase', letterSpacing: '.05em', textAlign: 'right' }}>
                          {stage.label}
                        </div>
                        <div style={styles.progressBg}>
                          <div style={styles.progressFill(width)} />
                        </div>
                        <div style={{ width: '80px', ...mono, fontSize: '14px', fontWeight: 700, color: c.ivory }}>
                          {stage.count} <span style={{ fontSize: '11px', color: c.muted, fontWeight: 500 }}>({percent}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Analytics Graph */}
            <div style={{ marginTop: '32px', marginBottom: '32px' }}>
              <h2 style={{ ...styles.sectionTitle, marginBottom: '16px' }}>7-Day Intent Trend</h2>
              <div style={{ ...styles.card, padding: '24px 24px 0 0', height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[
                    { name: 'Mon', leads: 12, hot: 2, orders: 1 },
                    { name: 'Tue', leads: 19, hot: 5, orders: 2 },
                    { name: 'Wed', leads: 15, hot: 4, orders: 1 },
                    { name: 'Thu', leads: 22, hot: 8, orders: 3 },
                    { name: 'Fri', leads: 28, hot: 12, orders: 4 },
                    { name: 'Sat', leads: 35, hot: 16, orders: 7 },
                    { name: 'Sun', leads: 42, hot: 24, orders: 11 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" vertical={false} />
                    <XAxis dataKey="name" stroke="#8b949e" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#8b949e" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid #1F1F1F', borderRadius: '8px' }} 
                      itemStyle={{ fontWeight: 600 }}
                    />
                    <Line type="monotone" dataKey="leads" name="Total Leads" stroke="#58a6ff" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="hot" name="Hot Leads" stroke="#f85149" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="orders" name="Orders" stroke="#3fb950" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Activity Table */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={styles.sectionTitle}>Recent Activity</h2>
              </div>

              <div style={{ ...styles.card, padding: 0, overflow: 'hidden' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Customer</th>
                      <th style={styles.th}>Segment</th>
                      <th style={styles.th}>Score</th>
                      <th style={styles.th}>Last Interaction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ ...styles.td, textAlign: 'center', color: c.muted }}>
                          No customers yet.
                        </td>
                      </tr>
                    ) : (
                      customers.slice(0, 8).map(cust => (
                        <tr key={cust.id} onClick={() => viewOrders(cust.id)} style={{ cursor: 'pointer' }}>
                          <td style={styles.td}>
                            <div style={{ fontWeight: 600 }}>{cust.name || 'Unknown'}</div>
                          </td>
                          <td style={styles.td}>
                            <span style={styles.badge(segColor(cust.segment), segTextColor(cust.segment))}>
                              {cust.segment}
                            </span>
                          </td>
                          <td style={{ ...styles.td, fontWeight: 600, ...mono }}>{cust.intent_score || 0}</td>
                          <td style={{ ...styles.td, color: c.muted, fontSize: '13px' }}>
                            {cust.last_interaction ? new Date(cust.last_interaction + (cust.last_interaction.endsWith('Z') ? '' : 'Z')).toLocaleString('en-IN', {
                              day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true
                            }) : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div style={styles.column}>
            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
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

            {/* Needs Attention */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <h2 style={styles.sectionTitle}>Needs Attention</h2>
                {pendingHandoffs.length > 0 && (
                  <span style={styles.badge(c.hot, '#fff')}>
                    {pendingHandoffs.length} Pending
                  </span>
                )}
              </div>

              {handoffs.length === 0 ? (
                <div style={{ ...styles.card, padding: '24px', textAlign: 'center', color: c.muted, fontSize: '13px' }}>
                  No handoffs requested yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {pendingHandoffs.map(h => (
                    <div key={h.id} style={styles.handoffCard}>
                      <div>
                        <div style={{ fontWeight: 600, color: c.ivory, marginBottom: '4px', fontSize: '14px' }}>
                          {h.name || 'Unknown'}
                        </div>
                        <div style={{ color: c.hot, fontSize: '13px', fontWeight: 500 }}>
                          Reason: {h.reason}
                        </div>
                        <div style={{ color: c.muted, fontSize: '11px', marginTop: '6px' }}>
                          {new Date(h.created_at).toLocaleString()}
                        </div>
                      </div>
                      <button onClick={() => resolveHandoff(h.id)} style={styles.resolveBtn}>
                        Mark as Resolved
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
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
    </div>
  );
}
