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

export default function Signup() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  // Form State
  const [formData, setFormData] = useState({
    business_name: '',
    owner_email: '',
    password: '',
    language: 'English + Hindi mix (Hinglish)',
    policies: '7-day return policy. Delivery in 3-5 days across India. Genuine product guarantee. 24/7 customer support.',
    banner_url: '',
    catalog_items: [{ name: '', price: '', note: '', image_url: '' }]
  });

  const [bannerUploading, setBannerUploading] = useState(false);
  const [productUploadingIndex, setProductUploadingIndex] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: '' });
  };

  const handleProductChange = (index, field, value) => {
    const newItems = [...formData.catalog_items];
    newItems[index][field] = value;
    setFormData({ ...formData, catalog_items: newItems });
    if (errors.catalog) setErrors({ ...errors, catalog: '' });
  };

  const handleImageUpload = async (index, e) => {
    const file = e.target.files[0];
    if (!file) return;

    setProductUploadingIndex(index);
    const formDataUpload = new FormData();
    formDataUpload.append("file", file);

    const toastId = toast.loading("Uploading product photo...");
    try {
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: formDataUpload
      });
      const data = await res.json();
      if (res.ok && data.url) {
        const finalUrl = data.url.startsWith('http') ? data.url : API_BASE + data.url;
        handleProductChange(index, 'image_url', finalUrl);
        toast.success("Product photo attached!", { id: toastId });
      } else {
        toast.error(data.detail || "Upload failed", { id: toastId });
      }
    } catch (err) {
      toast.error("Network error during photo upload", { id: toastId });
    } finally {
      setProductUploadingIndex(null);
    }
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBannerUploading(true);
    const bannerFormData = new FormData();
    bannerFormData.append('file', file);
    const toastId = toast.loading('Uploading store banner...');
    try {
      const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: bannerFormData });
      const data = await res.json();
      if (res.ok && data.url) {
        const finalUrl = data.url.startsWith('http') ? data.url : API_BASE + data.url;
        setFormData(prev => ({ ...prev, banner_url: finalUrl }));
        toast.success('Store banner uploaded!', { id: toastId });
      } else {
        toast.error(data.detail || 'Upload failed', { id: toastId });
      }
    } catch (err) {
      toast.error('Network error during banner upload', { id: toastId });
    } finally {
      setBannerUploading(false);
    }
  };

  const addProduct = () => {
    setFormData({
      ...formData,
      catalog_items: [...formData.catalog_items, { name: '', price: '', note: '', image_url: '' }]
    });
  };

  const removeProduct = (index) => {
    if (formData.catalog_items.length > 1) {
      const newItems = formData.catalog_items.filter((_, i) => i !== index);
      setFormData({ ...formData, catalog_items: newItems });
    }
  };

  const validateStep1 = () => {
    const newErrors = {};
    if (!formData.business_name.trim()) newErrors.business_name = 'Please enter your store or brand name';
    if (!formData.owner_email.trim()) newErrors.owner_email = 'Please enter your email address';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.owner_email)) newErrors.owner_email = 'Please enter a valid email address';
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters long';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};
    const firstProduct = formData.catalog_items[0];
    if (!firstProduct || !firstProduct.name.trim()) {
      newErrors.catalog = 'Please enter a product name for your first item';
    } else if (!firstProduct.price || isNaN(firstProduct.price) || Number(firstProduct.price) <= 0) {
      newErrors.catalog = 'Please enter a valid price in ₹ for your first item';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep1()) {
      setStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep2()) return;

    setLoading(true);
    const validItems = formData.catalog_items.filter(item => item.name && item.price);

    try {
      const res = await fetch(`${API_BASE}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, catalog_items: validItems })
      });

      const data = await res.json();

      if (res.ok && data.token) {
        sessionStorage.setItem("admin_token", data.token);
        toast.success("Store created successfully! Redirecting...");
        setTimeout(() => {
          router.push('/dashboard');
        }, 800);
      } else {
        toast.error(data.detail || "Failed to create store");
        if (data.detail && (data.detail.toLowerCase().includes("email") || data.detail.toLowerCase().includes("name") || data.detail.toLowerCase().includes("taken"))) {
          setStep(1);
          if (data.detail.toLowerCase().includes("email")) setErrors({ owner_email: data.detail });
          if (data.detail.toLowerCase().includes("name") || data.detail.toLowerCase().includes("taken")) setErrors({ business_name: data.detail });
        }
        setLoading(false);
      }
    } catch (err) {
      toast.error("Network error. Please make sure backend is running.");
      setLoading(false);
    }
  };

  return (
    <div className={`rw-page ${inter.className}`}>
      <Toaster position="top-center" />

      {/* Modern Top Navbar */}
      <header className="rw-header">
        <Link href="/" className="rw-logo" style={sora.style}>
          <div className="rw-logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div className="rw-logo-text">
            <span className="rw-logo-title">AI Sales Agent</span>
            <span className="rw-logo-sub">Merchant Platform</span>
          </div>
        </Link>
        
        {/* Sleek Professional Auth Pill */}
        <div className="rw-header-actions">
          <span className="rw-header-text">Already registered?</span>
          <Link 
            href="/dashboard/login" 
            className="rw-header-signin-btn"
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
            <span style={{ color: '#ffffff', fontWeight: '600' }}>Sign In</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </Link>
        </div>
      </header>

      {/* Split Hero Workspace */}
      <div className="rw-container">
        
        {/* Left Column: Focused 2-Step Form */}
        <div className="rw-form-col">
          
          {/* Stepper Progress Bar */}
          <div className="rw-stepper-box">
            <div className="rw-stepper-tabs">
              <div className={`rw-step-pill ${step >= 1 ? 'active' : ''}`}>
                <span className="rw-step-num">1</span>
                <span className="rw-step-label">Store & Account</span>
              </div>
              <div className="rw-step-divider"></div>
              <div className={`rw-step-pill ${step >= 2 ? 'active' : ''}`}>
                <span className="rw-step-num">2</span>
                <span className="rw-step-label">Banner & Products</span>
              </div>
            </div>
          </div>

          {/* STEP 1: STORE DETAILS (No forced categories, fits perfectly) */}
          {step === 1 && (
            <div className="rw-card">
              <div className="rw-card-header">
                <h1 className="rw-card-title" style={sora.style}>Start your AI Store</h1>
                <p className="rw-card-desc">
                  Set up your business in 60 seconds. Your autonomous AI agent will engage customers and close sales 24/7.
                </p>
              </div>

              <div className="rw-form-body">
                
                {/* Store Name */}
                <div className="rw-field">
                  <label className="rw-field-label">
                    <span>Store / Brand Name</span>
                    <span className="rw-req">*</span>
                  </label>
                  <div className="rw-input-box">
                    <span className="rw-input-ico">🏪</span>
                    <input
                      type="text"
                      name="business_name"
                      placeholder="e.g. Royal Fashion, Gupta Mobiles, Aroma Cafe, Luxe Decor"
                      value={formData.business_name}
                      onChange={handleChange}
                      className={`rw-input-text ${errors.business_name ? 'error' : ''}`}
                      autoFocus
                    />
                  </div>
                  {errors.business_name && <p className="rw-field-error">{errors.business_name}</p>}
                </div>

                {/* Owner Email */}
                <div className="rw-field">
                  <label className="rw-field-label">
                    <span>Owner Email Address</span>
                    <span className="rw-req">*</span>
                  </label>
                  <div className="rw-input-box">
                    <span className="rw-input-ico">✉️</span>
                    <input
                      type="email"
                      name="owner_email"
                      placeholder="owner@yourbrand.com"
                      value={formData.owner_email}
                      onChange={handleChange}
                      className={`rw-input-text ${errors.owner_email ? 'error' : ''}`}
                    />
                  </div>
                  {errors.owner_email && <p className="rw-field-error">{errors.owner_email}</p>}
                </div>

                {/* Password */}
                <div className="rw-field">
                  <label className="rw-field-label">
                    <span>Dashboard Password</span>
                    <span className="rw-req">* (Min 8 chars)</span>
                  </label>
                  <div className="rw-input-box">
                    <span className="rw-input-ico">🔒</span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      placeholder="Enter a secure password"
                      value={formData.password}
                      onChange={handleChange}
                      className={`rw-input-text ${errors.password ? 'error' : ''}`}
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
                  {errors.password && <p className="rw-field-error">{errors.password}</p>}
                </div>

                {/* Continue Button */}
                <button
                  type="button"
                  onClick={handleNext}
                  className="rw-submit-btn"
                  style={sora.style}
                >
                  Continue to Storefront & Products →
                </button>

              </div>
            </div>
          )}

          {/* STEP 2: BANNER & FIRST PRODUCT */}
          {step === 2 && (
            <div className="rw-card">
              <div className="rw-card-header">
                <div className="rw-header-nav">
                  <button type="button" onClick={() => setStep(1)} className="rw-back-btn">
                    ← Back to Step 1
                  </button>
                </div>
                <h1 className="rw-card-title" style={sora.style}>Storefront & Products</h1>
                <p className="rw-card-desc">
                  Upload your banner and add your first product so your AI sales agent can start pitching immediately.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="rw-form-body">

                {/* Store Banner Upload Section */}
                <div className="rw-section-box">
                  <div className="rw-section-header">
                    <span className="rw-sec-icon">🖼️</span>
                    <div>
                      <h3 className="rw-sec-title">Storefront Banner Photo</h3>
                      <p className="rw-sec-sub">Showcases at the top of your store card in the Explore directory.</p>
                    </div>
                  </div>

                  {formData.banner_url ? (
                    <div className="rw-banner-active">
                      <img src={formData.banner_url} alt="Store Banner" className="rw-banner-img" />
                      <div className="rw-banner-overlay">
                        <span className="rw-banner-tag">✓ Banner Ready</span>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, banner_url: '' }))}
                          className="rw-change-btn"
                        >
                          Change Photo
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rw-drop-panel">
                      <div className="rw-drop-icon">📸</div>
                      <p className="rw-drop-main">Upload your store cover photo</p>
                      <label className="rw-file-btn">
                        {bannerUploading ? 'Uploading...' : '📁 Browse & Upload Photo'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleBannerUpload}
                          disabled={bannerUploading}
                          style={{ display: 'none' }}
                        />
                      </label>
                      <div className="rw-preset-row">
                        <span>Or quick templates:</span>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, banner_url: '/images/electronics_banner.jpg' }))}
                          className="rw-preset-pill"
                        >
                          ⚡ Modern Tech
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, banner_url: '/images/clothing_banner.jpg' }))}
                          className="rw-preset-pill"
                        >
                          👗 Fashion & Retail
                        </button>
                      </div>
                      <div className="rw-auto-tip">
                        💡 <strong>Smart Fallback:</strong> If skipped, your 1st product's photo automatically becomes your store cover!
                      </div>
                    </div>
                  )}
                </div>

                {/* First Product Section */}
                <div className="rw-section-box">
                  <div className="rw-section-header">
                    <span className="rw-sec-icon">📦</span>
                    <div>
                      <h3 className="rw-sec-title">Add Your Initial Product</h3>
                      <p className="rw-sec-sub">Your AI memorizes price and details to answer customer questions accurately.</p>
                    </div>
                  </div>

                  {formData.catalog_items.map((item, index) => (
                    <div key={index} className="rw-product-card">
                      <div className="rw-prod-header">
                        <span className="rw-prod-badge">ITEM #{index + 1}</span>
                        {formData.catalog_items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeProduct(index)}
                            className="rw-prod-del"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="rw-prod-row">
                        <div className="rw-field" style={{ flex: 2 }}>
                          <label className="rw-field-label">Product Name *</label>
                          <input
                            type="text"
                            placeholder="e.g. Wireless Noise-Cancelling Earbuds"
                            value={item.name}
                            onChange={(e) => handleProductChange(index, 'name', e.target.value)}
                            className="rw-input-text"
                          />
                        </div>
                        <div className="rw-field" style={{ flex: 1 }}>
                          <label className="rw-field-label">Price (₹) *</label>
                          <input
                            type="number"
                            placeholder="e.g. 1999"
                            value={item.price}
                            onChange={(e) => handleProductChange(index, 'price', e.target.value)}
                            className="rw-input-text"
                          />
                        </div>
                      </div>

                      <div className="rw-field">
                        <label className="rw-field-label">Short Description / Key Features</label>
                        <input
                          type="text"
                          placeholder="e.g. 24hr battery life, water resistant, fast charging"
                          value={item.note}
                          onChange={(e) => handleProductChange(index, 'note', e.target.value)}
                          className="rw-input-text"
                        />
                      </div>

                      {/* Product Photo Upload */}
                      <div className="rw-field">
                        <label className="rw-field-label">Product Photo</label>
                        <div className="rw-photo-upload-row">
                          <label className="rw-upload-sub-btn">
                            {productUploadingIndex === index ? 'Uploading...' : '📷 Upload Product Image'}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleImageUpload(index, e)}
                              disabled={productUploadingIndex === index}
                              style={{ display: 'none' }}
                            />
                          </label>
                          <span className="rw-or-text">or paste image URL:</span>
                          <input
                            type="url"
                            placeholder="https://..."
                            value={item.image_url || ''}
                            onChange={(e) => handleProductChange(index, 'image_url', e.target.value)}
                            className="rw-input-text"
                            style={{ flex: 1 }}
                          />
                        </div>
                        {item.image_url && (
                          <div className="rw-thumb-preview">
                            <img src={item.image_url} alt={item.name || 'Product'} />
                            <span>✓ Image Attached</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {errors.catalog && (
                    <div className="rw-field-error-box">
                      ⚠️ {errors.catalog}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={addProduct}
                    className="rw-add-more-btn"
                  >
                    + Add Another Product
                  </button>
                </div>

                {/* Return Policy (Collapsible / Pre-populated) */}
                <div className="rw-section-box">
                  <div className="rw-section-header">
                    <span className="rw-sec-icon">🛡️</span>
                    <div>
                      <h3 className="rw-sec-title">Store Warranty & Return Policy</h3>
                      <p className="rw-sec-sub">Automatically quoted by your AI when shoppers ask about guarantees.</p>
                    </div>
                  </div>
                  <textarea
                    name="policies"
                    rows={2}
                    value={formData.policies}
                    onChange={handleChange}
                    className="rw-policy-textarea"
                  />
                </div>

                {/* Final Launch Button */}
                <div className="rw-actions-row">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="rw-btn-secondary"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="rw-submit-btn"
                    style={{ flex: 1, ...sora.style }}
                  >
                    {loading ? "Creating Store & Deploying AI..." : "🚀 Launch My Store Now"}
                  </button>
                </div>

              </form>
            </div>
          )}

        </div>

        {/* Right Column: Real-World AI Agent Live Showcase */}
        <div className="rw-showcase-col">
          
          {/* Main Visual: Simulated Live AI Assistant */}
          <div className="rw-showcase-card">
            <div className="rw-showcase-header">
              <div className="rw-live-status">
                <span className="rw-live-dot"></span>
                <span>LIVE STORE AI AGENT</span>
              </div>
              <span className="rw-speed-tag">⚡ 1.2s avg response</span>
            </div>

            <div className="rw-chat-preview">
              <div className="rw-chat-bubble customer">
                <div className="rw-bubble-meta">Customer • Just now</div>
                <div className="rw-bubble-msg">
                  "Bhai ye product available hai kya? Cash on Delivery milegi aur warranty kitne din ki hai?"
                </div>
              </div>

              <div className="rw-chat-bubble ai">
                <div className="rw-bubble-meta">
                  <span className="rw-ai-badge">AI Sales Agent</span>
                  <span>Autonomous reply</span>
                </div>
                <div className="rw-bubble-msg">
                  "Ji bilkul! Ye product abhi stock me available hai aur humare paas <strong>Cash on Delivery (COD)</strong> option bhi hai. Saath hi <strong>1-year brand warranty</strong> milti hai. Kya mai aapka order book kar dun?"
                </div>
              </div>

              <div className="rw-order-pill">
                <span className="rw-order-icon">🛍️</span>
                <div className="rw-order-info">
                  <strong>Instant Order Conversion</strong>
                  <span>₹1,999 • Customer Contact Captured Automatically</span>
                </div>
              </div>
            </div>

            {/* Merchant Highlights */}
            <div className="rw-features-grid">
              <div className="rw-feat-item">
                <span className="rw-feat-icon">🗣️</span>
                <div>
                  <h4>Hinglish & Multi-lingual</h4>
                  <p>Converses fluently in Hindi, English, and Hinglish.</p>
                </div>
              </div>

              <div className="rw-feat-item">
                <span className="rw-feat-icon">🌙</span>
                <div>
                  <h4>Never Misses Night Sales</h4>
                  <p>Closes deals 24/7 even when you are asleep.</p>
                </div>
              </div>

              <div className="rw-feat-item">
                <span className="rw-feat-icon">📊</span>
                <div>
                  <h4>Merchant Analytics</h4>
                  <p>Live lead segmentation (Hot, Warm, Cold) in dashboard.</p>
                </div>
              </div>

              <div className="rw-feat-item">
                <span className="rw-feat-icon">⚡</span>
                <div>
                  <h4>Zero Setup Fee</h4>
                  <p>Ready to sell in under 60 seconds.</p>
                </div>
              </div>
            </div>

            {/* Merchant Trust Bar */}
            <div className="rw-trust-bar">
              <span className="rw-trust-star">★★★★★</span>
              <span>Trusted by 500+ Indian retail merchants across 20+ cities</span>
            </div>

          </div>

        </div>

      </div>

      <style jsx>{`
        .rw-page {
          min-height: 100vh;
          background: #080d1a;
          background-image: 
            radial-gradient(circle at 10% 20%, rgba(37, 99, 235, 0.15) 0%, transparent 40%),
            radial-gradient(circle at 90% 80%, rgba(139, 92, 246, 0.12) 0%, transparent 40%),
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
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          padding: 5px 6px 5px 16px;
          border-radius: 9999px;
          backdrop-filter: blur(12px);
          transition: all 0.2s;
        }

        .rw-header-actions:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.18);
        }

        .rw-header-text {
          font-size: 13.5px;
          color: #cbd5e1;
          font-weight: 500;
        }

        .rw-header-signin-btn,
        .rw-header-signin-btn:visited,
        .rw-header-signin-btn:hover,
        .rw-header-signin-btn:active,
        .rw-header-signin-btn:focus {
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

        .rw-header-signin-btn:hover {
          background-color: #1d4ed8 !important;
          color: #ffffff !important;
          box-shadow: 0 4px 16px rgba(37, 99, 235, 0.65);
          transform: translateY(-1px);
        }

        /* Split Workspace Container */
        .rw-container {
          max-width: 1300px;
          margin: 0 auto;
          padding: 40px 32px 80px;
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 48px;
          align-items: start;
          width: 100%;
        }

        /* Stepper Progress Tabs */
        .rw-stepper-box {
          margin-bottom: 24px;
        }

        .rw-stepper-tabs {
          display: flex;
          align-items: center;
          gap: 16px;
          background: rgba(19, 27, 47, 0.6);
          padding: 8px 16px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .rw-step-pill {
          display: flex;
          align-items: center;
          gap: 10px;
          opacity: 0.45;
          transition: all 0.2s;
        }

        .rw-step-pill.active {
          opacity: 1;
        }

        .rw-step-num {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.12);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
        }

        .rw-step-pill.active .rw-step-num {
          background: #3b82f6;
          color: #ffffff;
          box-shadow: 0 0 12px rgba(59, 130, 246, 0.5);
        }

        .rw-step-label {
          font-size: 14px;
          font-weight: 600;
          color: #e2e8f0;
        }

        .rw-step-divider {
          flex: 1;
          height: 1px;
          background: rgba(255, 255, 255, 0.1);
        }

        /* Card Container */
        .rw-card {
          background: rgba(18, 26, 45, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 36px 38px;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(16px);
        }

        .rw-card-header {
          margin-bottom: 28px;
        }

        .rw-header-nav {
          margin-bottom: 12px;
        }

        .rw-back-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          transition: color 0.2s;
        }

        .rw-back-btn:hover {
          color: #38bdf8;
        }

        .rw-card-title {
          font-size: 28px;
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

        /* Form Fields */
        .rw-form-body {
          display: flex;
          flex-direction: column;
          gap: 22px;
        }

        .rw-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .rw-field-label {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 14px;
          font-weight: 600;
          color: #e2e8f0;
        }

        .rw-req {
          color: #f43f5e;
          margin-left: 3px;
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

        .rw-input-text.error {
          border-color: #f43f5e;
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

        .rw-field-error {
          font-size: 13px;
          color: #f43f5e;
          font-weight: 500;
        }

        /* Buttons */
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
          margin-top: 8px;
        }

        .rw-submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(37, 99, 235, 0.6);
        }

        .rw-submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .rw-btn-secondary {
          height: 52px;
          padding: 0 24px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          color: #ffffff;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .rw-btn-secondary:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        .rw-actions-row {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-top: 12px;
        }

        /* Step 2 Sections */
        .rw-section-box {
          background: rgba(11, 17, 32, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 22px;
        }

        .rw-section-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 18px;
        }

        .rw-sec-icon {
          font-size: 22px;
        }

        .rw-sec-title {
          font-size: 16px;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 3px;
        }

        .rw-sec-sub {
          font-size: 13px;
          color: #94a3b8;
        }

        /* Banner Drop Panel */
        .rw-drop-panel {
          border: 2px dashed rgba(255, 255, 255, 0.15);
          border-radius: 14px;
          padding: 24px;
          text-align: center;
          background: rgba(15, 23, 42, 0.4);
        }

        .rw-drop-icon {
          font-size: 28px;
          margin-bottom: 8px;
        }

        .rw-drop-main {
          font-size: 14px;
          font-weight: 600;
          color: #ffffff;
          margin-bottom: 12px;
        }

        .rw-file-btn {
          display: inline-block;
          padding: 10px 22px;
          background: #2563eb;
          color: #ffffff;
          font-size: 14px;
          font-weight: 600;
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .rw-file-btn:hover {
          background: #1d4ed8;
        }

        .rw-preset-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 14px;
          font-size: 13px;
          color: #94a3b8;
        }

        .rw-preset-pill {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #e2e8f0;
          padding: 4px 12px;
          border-radius: 8px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .rw-preset-pill:hover {
          background: rgba(255, 255, 255, 0.15);
          color: #ffffff;
        }

        .rw-auto-tip {
          margin-top: 14px;
          font-size: 12px;
          color: #38bdf8;
          background: rgba(56, 189, 248, 0.08);
          padding: 8px 12px;
          border-radius: 8px;
          display: inline-block;
        }

        .rw-banner-active {
          position: relative;
          border-radius: 14px;
          overflow: hidden;
          height: 180px;
        }

        .rw-banner-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .rw-banner-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
        }

        .rw-banner-tag {
          font-size: 13px;
          font-weight: 700;
          color: #34d399;
          background: rgba(6, 78, 59, 0.85);
          padding: 6px 14px;
          border-radius: 20px;
        }

        .rw-change-btn {
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: #ffffff;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 13px;
          cursor: pointer;
          backdrop-filter: blur(8px);
        }

        /* Product Card */
        .rw-product-card {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 18px;
          margin-bottom: 14px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .rw-prod-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .rw-prod-badge {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: #38bdf8;
          background: rgba(56, 189, 248, 0.1);
          padding: 3px 10px;
          border-radius: 6px;
        }

        .rw-prod-del {
          background: transparent;
          border: none;
          color: #f43f5e;
          font-size: 13px;
          cursor: pointer;
        }

        .rw-prod-row {
          display: flex;
          gap: 12px;
        }

        .rw-photo-upload-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .rw-upload-sub-btn {
          padding: 10px 16px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 10px;
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.2s;
        }

        .rw-upload-sub-btn:hover {
          background: rgba(255, 255, 255, 0.18);
        }

        .rw-or-text {
          font-size: 13px;
          color: #94a3b8;
        }

        .rw-thumb-preview {
          margin-top: 8px;
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(6, 78, 59, 0.2);
          border: 1px solid rgba(16, 185, 129, 0.3);
          padding: 6px 12px;
          border-radius: 8px;
          color: #34d399;
          font-size: 13px;
          font-weight: 600;
        }

        .rw-thumb-preview img {
          width: 36px;
          height: 36px;
          object-fit: cover;
          border-radius: 6px;
        }

        .rw-add-more-btn {
          background: transparent;
          border: 1.5px dashed rgba(255, 255, 255, 0.2);
          border-radius: 10px;
          color: #38bdf8;
          font-size: 14px;
          font-weight: 600;
          padding: 12px;
          cursor: pointer;
          width: 100%;
          transition: all 0.2s;
        }

        .rw-add-more-btn:hover {
          border-color: #38bdf8;
          background: rgba(56, 189, 248, 0.05);
        }

        .rw-policy-textarea {
          width: 100%;
          background: rgba(11, 17, 32, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 10px;
          padding: 10px 14px;
          color: #ffffff;
          font-size: 13px;
          line-height: 1.5;
          outline: none;
          resize: vertical;
        }

        .rw-field-error-box {
          background: rgba(244, 63, 94, 0.12);
          border: 1px solid rgba(244, 63, 94, 0.3);
          color: #f43f5e;
          font-size: 13px;
          font-weight: 600;
          padding: 10px 14px;
          border-radius: 8px;
        }

        /* ──────── RIGHT COLUMN: SHOWCASE ──────── */
        .rw-showcase-col {
          position: sticky;
          top: 100px;
        }

        .rw-showcase-card {
          background: rgba(18, 26, 45, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 30px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(16px);
        }

        .rw-showcase-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
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

        .rw-speed-tag {
          font-size: 12px;
          font-weight: 600;
          color: #38bdf8;
          background: rgba(56, 189, 248, 0.1);
          padding: 4px 10px;
          border-radius: 20px;
        }

        /* Live Chat Preview Box */
        .rw-chat-preview {
          background: rgba(9, 14, 28, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          margin-bottom: 24px;
        }

        .rw-chat-bubble {
          border-radius: 14px;
          padding: 12px 16px;
          max-width: 90%;
        }

        .rw-chat-bubble.customer {
          align-self: flex-start;
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .rw-chat-bubble.ai {
          align-self: flex-end;
          background: linear-gradient(135deg, rgba(37, 99, 235, 0.25), rgba(59, 130, 246, 0.15));
          border: 1px solid rgba(59, 130, 246, 0.35);
        }

        .rw-bubble-meta {
          font-size: 11px;
          color: #94a3b8;
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .rw-ai-badge {
          background: #2563eb;
          color: #ffffff;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
        }

        .rw-bubble-msg {
          font-size: 14px;
          line-height: 1.5;
          color: #f1f5f9;
        }

        .rw-order-pill {
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 12px;
          padding: 10px 14px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .rw-order-icon {
          font-size: 22px;
        }

        .rw-order-info {
          display: flex;
          flex-direction: column;
        }

        .rw-order-info strong {
          font-size: 13px;
          color: #34d399;
        }

        .rw-order-info span {
          font-size: 12px;
          color: #94a3b8;
        }

        /* Features Grid */
        .rw-features-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
          margin-bottom: 22px;
        }

        .rw-feat-item {
          display: flex;
          gap: 10px;
          align-items: flex-start;
        }

        .rw-feat-icon {
          font-size: 20px;
          line-height: 1.2;
        }

        .rw-feat-item h4 {
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 2px;
        }

        .rw-feat-item p {
          font-size: 12px;
          color: #94a3b8;
          line-height: 1.35;
        }

        /* Trust Bar */
        .rw-trust-bar {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding-top: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #94a3b8;
        }

        .rw-trust-star {
          color: #fbbf24;
          font-size: 14px;
          letter-spacing: 2px;
        }

        /* Responsive Breakpoints */
        @media (max-width: 1024px) {
          .rw-container {
            grid-template-columns: 1fr;
            padding: 24px 20px 60px;
          }
          .rw-showcase-col {
            order: 2;
            position: static;
          }
          .rw-header {
            padding: 16px 20px;
          }
          .rw-card {
            padding: 24px 20px;
          }
        }
      `}</style>
    </div>
  );
}
