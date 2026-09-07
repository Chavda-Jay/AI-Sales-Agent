'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sora, Inter } from 'next/font/google';
import toast, { Toaster } from 'react-hot-toast';

const sora = Sora({ subsets: ['latin'], weight: ['400', '600', '700', '800'] });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

const rawApi = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const API_BASE = rawApi.replace(/\/+$/, '');

const authFetch = async (url, options = {}) => {
  if (typeof window !== 'undefined') {
    const token = sessionStorage.getItem('admin_token');
    if (!token) { window.location.href = '/dashboard/login'; return new Response(null, { status: 401 }); }
    const headers = { ...options.headers, 'Authorization': 'Bearer ' + token };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401 || res.status === 403) {
      window.location.href = '/dashboard/login';
    }
    return res;
  }
  return fetch(url, options);
};

const c = {
  bg: '#0f1115',
  panel: '#1e2128',
  panel2: '#272b33',
  line: '#31353f',
  muted: '#8e96a4',
  ivory: '#f8fafc',
  primary: '#0ea5e9',
};

const styles = {
  page: { background: c.bg, minHeight: '100vh', color: c.ivory, fontFamily: 'Inter, sans-serif' },
  navbar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '24px 40px', background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(12px)',
    borderBottom: `1px solid ${c.line}`, position: 'sticky', top: 0, zIndex: 100
  },
  navBrand: { fontFamily: 'Sora, sans-serif', fontSize: '24px', fontWeight: 900, color: c.ivory, letterSpacing: '0.1em' },
  wrap: { maxWidth: '1200px', margin: '0 auto', padding: '40px' },
  card: { background: c.panel, border: `1px solid ${c.line}`, borderRadius: '24px', padding: '28px' },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: '20px' },
  th: { textAlign: 'left', padding: '16px', color: c.muted, borderBottom: `1px solid ${c.line}`, fontSize: '14px', fontWeight: 600 },
  td: { padding: '16px', borderBottom: `1px solid ${c.line}`, fontSize: '15px' },
  btnPrimary: { background: c.primary, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 },
  btnDanger: { background: '#ef4444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 },
  btnSecondary: { background: c.panel2, color: c.ivory, border: `1px solid ${c.line}`, padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 },
  input: { width: '100%', padding: '12px', background: c.panel2, border: `1px solid ${c.line}`, color: c.ivory, borderRadius: '8px', marginTop: '8px', marginBottom: '16px' }
};

export default function CatalogManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shop = searchParams.get('shop');

  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState(null); // 'add' | 'edit' | 'delete' | null
  const [currentItem, setCurrentItem] = useState({ name: '', price: '', note: '', image_url: '' });
  const [itemToDelete, setItemToDelete] = useState(null);

  useEffect(() => {
    if (!shop) {
      toast.error("No shop selected.");
      router.push('/dashboard');
      return;
    }
    fetchCatalog();
  }, [shop]);

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/config?shop=${shop}`);
      const data = await res.json();
      if (res.ok) {
        setCatalog(data.catalog || []);
      }
    } catch (e) {
      toast.error("Failed to load catalog");
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!currentItem.name || !currentItem.price) {
      toast.error("Name and price are required");
      return;
    }
    const payload = {
      name: currentItem.name,
      price: parseFloat(currentItem.price),
      note: currentItem.note || "",
      image_url: currentItem.image_url || ""
    };

    try {
      let res;
      if (modalMode === 'add') {
        res = await authFetch(`${API_BASE}/api/businesses/${shop}/catalog`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await authFetch(`${API_BASE}/api/businesses/${shop}/catalog/${currentItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        toast.success(modalMode === 'add' ? "Item added" : "Item updated");
        setModalMode(null);
        fetchCatalog();
      } else {
        const errorData = await res.json();
        toast.error(errorData.detail || "Failed to save item");
      }
    } catch (e) {
      toast.error("Network error");
    }
  };

  const confirmDelete = (item) => {
    setItemToDelete(item);
    setModalMode('delete');
  };

  const handleDelete = async () => {
    if (!itemToDelete || !itemToDelete.id) return;
    try {
      const res = await authFetch(`${API_BASE}/api/businesses/${shop}/catalog/${itemToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success("Item deleted successfully!");
        setModalMode(null);
        setItemToDelete(null);
        fetchCatalog();
      } else {
        const errorData = await res.json();
        toast.error(errorData.detail || "Failed to delete item");
      }
    } catch (e) {
      toast.error("Network error");
    }
  };

  if (loading) return <div style={{ ...styles.page, display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '24px' }}>Loading...</div>;

  return (
    <div style={styles.page}>
      <Toaster position="top-right" />
      <nav className="nav-container" style={styles.navbar}>
        <div className="nav-brand" style={styles.navBrand}>
          <span style={{ color: c.primary }}>▲</span> AI SALES AGENT
        </div>
        <button onClick={() => router.push('/dashboard')} style={styles.btnSecondary}>Back to Dashboard</button>
      </nav>

      <div className="wrap-container" style={styles.wrap}>
        <div className="header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 className="header-title" style={{ fontFamily: 'Sora, sans-serif', margin: 0, fontSize: '32px' }}>Manage Catalog</h1>
            <p style={{ color: c.muted, marginTop: '8px' }}>Store: {shop}</p>
          </div>
          <button onClick={() => { setModalMode('add'); setCurrentItem({ name: '', price: '', note: '', image_url: '' }); }} style={styles.btnPrimary}>
            + Add New Product
          </button>
        </div>

        <div className="card-container" style={styles.card}>
          {catalog.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: c.muted }}>No products found. Add one above!</div>
          ) : (
            <div className="table-responsive">
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Image</th>
                    <th style={styles.th}>Name</th>
                    <th style={styles.th}>Price</th>
                    <th style={styles.th}>Note</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.map((item, index) => (
                    <tr key={item.id || index}>
                      <td style={styles.td}>
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px' }} />
                        ) : (
                          <div style={{ width: '48px', height: '48px', background: c.panel2, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: c.muted }}>No Img</div>
                        )}
                      </td>
                      <td style={{ ...styles.td, fontWeight: 600 }}>{item.name}</td>
                      <td style={{ ...styles.td, color: '#22c55e' }}>₹{item.price}</td>
                      <td style={{ ...styles.td, color: c.muted }}>{item.note || '-'}</td>
                      <td className="action-buttons" style={{ ...styles.td, display: 'flex', gap: '8px', alignItems: 'center', height: '81px' }}>
                        <button onClick={() => { setModalMode('edit'); setCurrentItem(item); }} style={styles.btnSecondary}>Edit</button>
                        <button onClick={() => confirmDelete(item)} style={styles.btnDanger}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {modalMode && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          {modalMode === 'delete' ? (
            <div className="modal-card" style={{ ...styles.card, width: '100%', maxWidth: '400px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗑️</div>
              <h2 style={{ fontFamily: 'Sora, sans-serif', marginTop: 0 }}>Delete Product?</h2>
              <p style={{ color: c.muted, marginBottom: '24px' }}>Are you sure you want to permanently delete <strong>{itemToDelete?.name}</strong>? This action cannot be undone.</p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                <button onClick={() => setModalMode(null)} style={{ background: 'transparent', color: c.ivory, border: 'none', cursor: 'pointer', fontWeight: 600, padding: '8px 16px' }}>Cancel</button>
                <button onClick={handleDelete} style={{ ...styles.btnDanger, padding: '10px 24px' }}>Yes, Delete</button>
              </div>
            </div>
          ) : (
            <div className="modal-card" style={{ ...styles.card, width: '100%', maxWidth: '400px', maxHeight: '90vh', overflowY: 'auto' }}>
              <h2 style={{ fontFamily: 'Sora, sans-serif', marginTop: 0 }}>{modalMode === 'add' ? 'Add Product' : 'Edit Product'}</h2>

              <label style={{ fontSize: '12px', fontWeight: 600, color: c.muted, textTransform: 'uppercase' }}>Product Name</label>
              <input type="text" value={currentItem.name} onChange={e => setCurrentItem({ ...currentItem, name: e.target.value })} style={styles.input} placeholder="e.g. Test Shirt" />

              <label style={{ fontSize: '12px', fontWeight: 600, color: c.muted, textTransform: 'uppercase' }}>Price (₹)</label>
              <input type="number" value={currentItem.price} onChange={e => setCurrentItem({ ...currentItem, price: e.target.value })} style={styles.input} placeholder="e.g. 599" />

              <label style={{ fontSize: '12px', fontWeight: 600, color: c.muted, textTransform: 'uppercase' }}>Note (Optional)</label>
              <input type="text" value={currentItem.note} onChange={e => setCurrentItem({ ...currentItem, note: e.target.value })} style={styles.input} placeholder="e.g. Available in S, M, L" />

              <label style={{ fontSize: '12px', fontWeight: 600, color: c.muted, textTransform: 'uppercase' }}>Image URL (Optional)</label>
              <input type="text" value={currentItem.image_url} onChange={e => setCurrentItem({ ...currentItem, image_url: e.target.value })} style={styles.input} placeholder="https://..." />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button onClick={() => setModalMode(null)} style={{ background: 'transparent', color: c.ivory, border: 'none', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                <button onClick={handleSave} style={styles.btnPrimary}>Save Item</button>
              </div>
            </div>
          )}
        </div>
      )}
      
      <style jsx>{`
        .table-responsive {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        
        @media (max-width: 768px) {
          .nav-container {
            padding: 16px 20px !important;
          }
          .nav-brand {
            font-size: 18px !important;
          }
          .wrap-container {
            padding: 20px !important;
          }
          .header-row {
            flex-direction: column;
            align-items: flex-start !important;
            gap: 16px;
          }
          .header-title {
            font-size: 24px !important;
          }
          .card-container {
            padding: 16px !important;
            border-radius: 16px !important;
          }
          .action-buttons {
            flex-direction: column;
            height: auto !important;
            gap: 6px !important;
          }
          .action-buttons button {
            width: 100%;
            padding: 8px !important;
          }
        }
      `}</style>
    </div>
  );
}
