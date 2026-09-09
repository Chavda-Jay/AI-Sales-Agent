'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sora, Inter, JetBrains_Mono } from 'next/font/google';
import toast, { Toaster } from 'react-hot-toast';

const sora = Sora({ subsets: ['latin'], weight: ['400', '600', '800'] });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600'] });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'] });

const rawApi = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const API_BASE = rawApi.replace(/\/+$/, '');

export default function Signup() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
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

  // Form State
  const [formData, setFormData] = useState({
    business_name: '',
    owner_email: '',
    password: '',
    language: 'English + Hindi mix (Hinglish)',
    policies: 'No returns or refunds unless the product is damaged upon delivery. 3-5 days delivery.',
    catalog_items: [{ name: '', price: '', note: '', image_url: '' }]
  });

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

    const formDataUpload = new FormData();
    formDataUpload.append("file", file);

    const toastId = toast.loading("Uploading image...");
    try {
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: formDataUpload
      });
      const data = await res.json();
      if (res.ok && data.url) {
        const finalUrl = data.url.startsWith('http') ? data.url : API_BASE + data.url;
        handleProductChange(index, 'image_url', finalUrl);
        toast.success("Image uploaded", { id: toastId });
      } else {
        toast.error(data.detail || "Upload failed", { id: toastId });
      }
    } catch (err) {
      toast.error("Network error during upload", { id: toastId });
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
    if (!formData.business_name) newErrors.business_name = 'Business name is required';
    if (!formData.owner_email) newErrors.owner_email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.owner_email)) newErrors.owner_email = 'Invalid email format';
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};
    if (!formData.language) newErrors.language = 'Language preference is required';
    if (!formData.policies) newErrors.policies = 'Policies are required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = () => {
    const newErrors = {};
    const hasValidProduct = formData.catalog_items.some(item => item.name && item.price);
    if (!hasValidProduct) {
      newErrors.catalog = 'Please add at least one complete product (name and price)';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (step === 1 && validateStep1()) setStep(2);
    if (step === 2 && validateStep2()) setStep(3);
  };

  const prevStep = () => setStep(step - 1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep3()) return;
    
    setLoading(true);
    
    // Filter out incomplete products
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
        toast.success("Account created successfully!");
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      } else {
        toast.error(data.detail || "Failed to sign up");
        // If error seems to be about email or name, go to step 1
        if (data.detail && (data.detail.toLowerCase().includes("email") || data.detail.toLowerCase().includes("name") || data.detail.toLowerCase().includes("taken"))) {
           setStep(1);
           if (data.detail.toLowerCase().includes("email")) setErrors({owner_email: data.detail});
           if (data.detail.toLowerCase().includes("name") || data.detail.toLowerCase().includes("taken")) setErrors({business_name: data.detail});
        }
        setLoading(false);
      }
    } catch (err) {
      toast.error("Network error. Please check backend.");
      setLoading(false);
    }
  };

  return (
    <div className={`signup-page ${inter.className}`} style={{ position: 'relative' }}>
      <button 
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="theme-toggle-btn"
        title="Toggle Theme"
      >
        {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
      </button>
      <Toaster position="top-right" />
      <div className="signup-container">
        
        <div className="signup-header">
          <div className="signup-brand" style={sora.style}>
            <span style={{ color: 'var(--primary)' }}>AI</span> SALES AGENT
          </div>
          <h1 className="signup-title" style={sora.style}>Create your Store</h1>
          <p className="signup-subtitle">Join us and set up your AI sales assistant.</p>
        </div>

        <div className="progress-container">
          {[1, 2, 3].map((num) => (
            <div key={num} className={`progress-step ${step >= num ? 'active' : ''} ${step > num ? 'completed' : ''}`}>
              <div className="step-circle" style={jetbrains.style}>{num}</div>
            </div>
          ))}
          <div className="progress-line">
            <div className="progress-fill" style={{ width: `${((step - 1) / 2) * 100}%` }}></div>
          </div>
        </div>
        <p className="step-label" style={jetbrains.style}>
          STEP {step} OF 3: {step === 1 ? 'BASICS' : step === 2 ? 'DETAILS' : 'PRODUCTS'}
        </p>

        <form onSubmit={step === 3 ? handleSubmit : (e) => { e.preventDefault(); nextStep(); }} className="signup-form">
          
          {step === 1 && (
            <div className="form-step slide-in">
              <div className="input-group">
                <label className={jetbrains.className}>Business Name</label>
                <input
                  type="text"
                  name="business_name"
                  placeholder="e.g. Urban Threads"
                  value={formData.business_name}
                  onChange={handleChange}
                  className={`signup-input ${errors.business_name ? 'error-border' : ''}`}
                />
                {errors.business_name && <span className="error-text">{errors.business_name}</span>}
              </div>

              <div className="input-group">
                <label className={jetbrains.className}>Owner Email</label>
                <input
                  type="email"
                  name="owner_email"
                  placeholder="name@company.com"
                  value={formData.owner_email}
                  onChange={handleChange}
                  className={`signup-input ${errors.owner_email ? 'error-border' : ''}`}
                />
                {errors.owner_email && <span className="error-text">{errors.owner_email}</span>}
              </div>

              <div className="input-group">
                <label className={jetbrains.className}>Password</label>
                <input
                  type="password"
                  name="password"
                  placeholder="At least 8 characters"
                  value={formData.password}
                  onChange={handleChange}
                  className={`signup-input ${errors.password ? 'error-border' : ''}`}
                />
                {errors.password && <span className="error-text">{errors.password}</span>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="form-step slide-in">
              <div className="input-group">
                <label className={jetbrains.className}>AI Language Preference</label>
                <select
                  name="language"
                  value={formData.language}
                  onChange={handleChange}
                  className={`signup-select ${errors.language ? 'error-border' : ''}`}
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi</option>
                  <option value="English + Hindi mix (Hinglish)">Hinglish</option>
                  <option value="Gujarati">Gujarati</option>
                </select>
                {errors.language && <span className="error-text">{errors.language}</span>}
              </div>

              <div className="input-group">
                <label className={jetbrains.className}>Store Policies</label>
                <textarea
                  name="policies"
                  rows="4"
                  placeholder="Describe your return policy, shipping time, etc."
                  value={formData.policies}
                  onChange={handleChange}
                  className={`signup-input signup-textarea ${errors.policies ? 'error-border' : ''}`}
                />
                <p className="help-text">The AI will use these rules when answering customers.</p>
                {errors.policies && <span className="error-text">{errors.policies}</span>}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="form-step slide-in">
              <p className="section-desc">Add at least one product so your AI agent knows what to sell.</p>
              
              <div className="products-list">
                {formData.catalog_items.map((item, index) => (
                  <div key={index} className="product-card">
                    <div className="product-header">
                      <span className="product-title" style={sora.style}>Product {index + 1}</span>
                      {formData.catalog_items.length > 1 && (
                        <button type="button" onClick={() => removeProduct(index)} className="btn-remove">✕</button>
                      )}
                    </div>
                    
                    <div className="product-grid">
                      <div className="input-group">
                        <label className={jetbrains.className}>Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Cotton T-Shirt"
                          value={item.name}
                          onChange={(e) => handleProductChange(index, 'name', e.target.value)}
                          className="signup-input"
                        />
                      </div>
                      <div className="input-group">
                        <label className={jetbrains.className}>Price (₹)</label>
                        <input
                          type="number"
                          placeholder="e.g. 599"
                          value={item.price}
                          onChange={(e) => handleProductChange(index, 'price', e.target.value)}
                          className="signup-input"
                        />
                      </div>
                    </div>
                    <div className="input-group">
                      <label className={jetbrains.className}>Short Description</label>
                      <input
                        type="text"
                        placeholder="e.g. 100% cotton, available in M/L/XL"
                        value={item.note}
                        onChange={(e) => handleProductChange(index, 'note', e.target.value)}
                        className="signup-input"
                      />
                    </div>
                    <div className="input-group" style={{ marginTop: '12px' }}>
                      <div className="img-upload-row">
                        <label className={jetbrains.className}>Image URL / Upload (Optional)</label>
                        <label style={{ fontSize: '12px', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>
                          Upload Photo
                          <input type="file" accept="image/*" onChange={(e) => handleImageUpload(index, e)} style={{ display: 'none' }} />
                        </label>
                      </div>
                      <input
                        type="url"
                        placeholder="e.g. https://... or upload photo"
                        value={item.image_url || ''}
                        onChange={(e) => handleProductChange(index, 'image_url', e.target.value)}
                        className="signup-input"
                      />
                    </div>
                  </div>
                ))}
              </div>
              
              {errors.catalog && <div className="error-text" style={{ marginBottom: '16px' }}>{errors.catalog}</div>}
              
              <button type="button" onClick={addProduct} className="btn-secondary">
                + Add Another Product
              </button>
            </div>
          )}

          <div className="form-actions">
            {step > 1 && (
              <button type="button" onClick={prevStep} className="btn-back">
                Back
              </button>
            )}
            <button type="submit" disabled={loading} className={`btn-primary ${step === 1 ? 'full-width' : ''}`}>
              {step < 3 ? 'Continue' : loading ? 'Creating Store...' : 'Complete Signup'}
            </button>
          </div>
        </form>

        <div className="signup-footer">
          <p>
            Already have an account? <a href="/dashboard/login">Sign In</a>
          </p>
        </div>
      </div>

      <style jsx>{`
        .theme-toggle-btn {
          position: absolute;
          top: 24px;
          right: 24px;
          background: var(--panel2);
          border: 1px solid var(--line);
          color: var(--ivory);
          cursor: pointer;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 24px;
          font-weight: bold;
          font-family: var(--font-heading);
          box-shadow: var(--shadow-sm);
          transition: all 0.3s ease;
          z-index: 100;
        }
        .theme-toggle-btn:hover {
          background: var(--line);
          transform: translateY(-2px);
        }

        .signup-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          background: var(--bg);
          background-image: 
            radial-gradient(circle at 15% 50%, rgba(14, 165, 233, 0.08), transparent 25%),
            radial-gradient(circle at 85% 30%, rgba(139, 92, 246, 0.05), transparent 25%);
          color: var(--ivory);
        }
        
        .signup-container {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 40px;
          width: 100%;
          max-width: 500px;
          box-shadow: var(--shadow-lg);
        }

        .slide-in {
          animation: slideIn 0.3s ease-out forwards;
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateX(10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        .signup-header {
          text-align: center;
          margin-bottom: 32px;
        }
        
        .signup-brand {
          font-size: 18px;
          font-weight: 800;
          letter-spacing: 0.1em;
          margin-bottom: 16px;
        }
        
        .signup-title {
          font-size: 26px;
          font-weight: 600;
          margin: 0 0 8px 0;
          color: var(--primary);
        }
        
        .signup-subtitle {
          font-size: 14px;
          color: var(--muted);
          margin: 0;
        }

        .progress-container {
          display: flex;
          justify-content: space-between;
          position: relative;
          margin-bottom: 12px;
          width: 80%;
          margin-left: auto;
          margin-right: auto;
        }

        .progress-line {
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--progress-line);
          z-index: 1;
          transform: translateY(-50%);
        }

        .progress-fill {
          height: 100%;
          background: var(--primary);
          transition: width 0.3s ease;
        }

        .progress-step {
          position: relative;
          z-index: 2;
          background: var(--panel);
          padding: 0 4px;
        }

        .step-circle {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--bg);
          border: 2px solid rgba(248, 250, 252, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          color: var(--muted);
          transition: all 0.3s ease;
        }

        .progress-step.active .step-circle {
          border-color: var(--primary);
          color: var(--primary);
          background: rgba(14, 165, 233, 0.1);
        }

        .progress-step.completed .step-circle {
          background: var(--primary);
          border-color: var(--primary);
          color: #ffffff;
        }

        .step-label {
          text-align: center;
          font-size: 11px;
          letter-spacing: 0.1em;
          color: var(--primary);
          margin-bottom: 32px;
        }
        
        .signup-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-step {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .input-group label {
          font-size: 12px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .signup-input, .signup-select {
          width: 100%;
          background: var(--bg);
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 14px 16px;
          font-size: 14px;
          color: var(--ivory);
          outline: none;
          transition: all 0.2s ease;
        }

        .signup-select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          background-size: 16px;
          cursor: pointer;
        }

        .signup-select option {
          background: var(--panel);
          color: var(--ivory);
        }
        
        .signup-input:focus, .signup-select:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.2);
        }

        .signup-input::placeholder {
          color: rgba(148, 163, 184, 0.5);
        }

        .signup-textarea {
          resize: vertical;
          min-height: 80px;
          font-family: inherit;
        }

        .error-border {
          border-color: #E2543A !important;
        }

        .error-text {
          color: #E2543A;
          font-size: 12px;
          margin-top: 2px;
        }

        .help-text {
          color: var(--muted);
          font-size: 12px;
          margin: 0;
        }

        .section-desc {
          color: var(--muted);
          font-size: 14px;
          margin-bottom: 16px;
        }

        .products-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-height: 400px;
          overflow-y: auto;
          padding-right: 8px;
        }

        /* Custom scrollbar for products list */
        .products-list::-webkit-scrollbar {
          width: 6px;
        }
        .products-list::-webkit-scrollbar-track {
          background: rgba(248, 250, 252, 0.05);
          border-radius: 4px;
        }
        .products-list::-webkit-scrollbar-thumb {
          background: rgba(248, 250, 252, 0.2);
          border-radius: 4px;
        }

        .product-card {
          background: rgba(248, 250, 252, 0.03);
          border: 1px solid rgba(248, 250, 252, 0.08);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .product-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .product-title {
          font-size: 14px;
          color: var(--primary);
        }

        .btn-remove {
          background: transparent;
          border: none;
          color: var(--muted);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .btn-remove:hover {
          color: #E2543A;
          background: rgba(226, 84, 58, 0.1);
        }

        .product-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 12px;
        }

        .btn-secondary {
          background: transparent;
          border: 1px dashed rgba(248, 250, 252, 0.2);
          color: var(--muted);
          padding: 12px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
          margin-top: 8px;
        }

        .btn-secondary:hover {
          border-color: var(--primary);
          color: var(--primary);
          background: rgba(14, 165, 233, 0.05);
        }
        
        .form-actions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }

        .btn-primary {
          flex: 1;
          padding: 14px;
          border-radius: 8px;
          border: none;
          background: var(--primary);
          color: #ffffff;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(14, 165, 233, 0.25);
        }
        
        .btn-primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .btn-back {
          padding: 14px 24px;
          border-radius: 8px;
          border: 1px solid var(--line);
          background: transparent;
          color: var(--ivory);
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-back:hover {
          background: rgba(248, 250, 252, 0.05);
        }

        .full-width {
          width: 100%;
        }
        
        .signup-footer {
          margin-top: 32px;
          text-align: center;
          font-size: 14px;
          color: var(--muted);
        }

        .signup-footer a {
          color: var(--primary);
          text-decoration: none;
          font-weight: 600;
          margin-left: 4px;
        }

        .signup-footer a:hover {
          text-decoration: underline;
        }
        
        .img-upload-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        @media (max-width: 480px) {
          .signup-container {
            padding: 32px 20px;
          }
          
          .product-grid {
            grid-template-columns: 1fr;
          }
          
          .img-upload-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }
        }
      `}</style>
    </div>
  );
}
