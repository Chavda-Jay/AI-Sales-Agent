'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export default function MarketplaceHome() {
  const [stores, setStores] = useState([]);
  
  useEffect(() => {
    const rawApi = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const API_BASE = rawApi.replace(/\/+$/, '');
    fetch(`${API_BASE}/api/public/businesses`)
      .then(res => res.json())
      .then(data => setStores(data))
      .catch(err => console.error(err));
  }, []);
  return (
    <div className="marketplace-bg">
      <div className="marketplace-container">
        
        {/* Header */}
        <header className="mk-header">
          <div className="mk-logo">AI Sales Agent</div>
          <nav className="mk-nav" style={{ alignItems: 'center' }}>
            <a href="#stores" className="mk-nav-link active">Stores</a>
            <Link href="/dashboard/login" className="mk-nav-link">Log In</Link>
            <Link href="/signup" className="mk-get-started" style={{ textDecoration: 'none' }}>Create Store</Link>
          </nav>
        </header>

        {/* Hero */}
        <section className="mk-hero">
          <h1>Explore Connected AI Stores</h1>
          <p>Discover and shop from leading businesses utilizing our advanced AI Sales Agents for 24/7 engagement.</p>
        </section>

        {/* Store Cards — Dynamic */}
        <section className="mk-grid mk-grid-2" id="stores">
          {stores.map((store, index) => {
            const nameLower = store.name.toLowerCase();
            let category = 'generic';
            if (nameLower.includes('electronic') || nameLower.includes('tech') || nameLower.includes('mobile')) category = 'electronics';
            else if (nameLower.includes('grocery') || nameLower.includes('mart') || nameLower.includes('food') || nameLower.includes('fresh')) category = 'grocery';
            else if (nameLower.includes('cloth') || nameLower.includes('thread') || nameLower.includes('fashion') || nameLower.includes('wear')) category = 'apparel';

            let glowClass, iconClass, btnClass, defaultIcon, defaultBadge, defaultTag, bgStyle;
            
            if (category === 'electronics') {
              glowClass = 'mk-glow-blue'; iconClass = 'mk-icon-blue'; btnClass = 'mk-btn-blue';
              defaultIcon = '📺'; defaultBadge = 'Electronics'; defaultTag = 'Tech & Gadgets';
              bgStyle = { backgroundImage: `url('/images/electronics_banner.jpg')` };
            } else if (category === 'grocery') {
              glowClass = 'mk-glow-green'; iconClass = 'mk-icon-green'; btnClass = 'mk-btn-green';
              defaultIcon = '🛒'; defaultBadge = 'Grocery'; defaultTag = 'Daily Essentials';
              bgStyle = { background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' };
            } else if (category === 'apparel') {
              glowClass = 'mk-glow-purple'; iconClass = ''; btnClass = '';
              defaultIcon = '👕'; defaultBadge = 'Apparel'; defaultTag = 'Fashion & Clothing';
              bgStyle = { backgroundImage: `url('/images/clothing_banner.jpg')` };
            } else {
              glowClass = 'mk-glow-orange'; iconClass = 'mk-icon-orange'; btnClass = 'mk-btn-orange';
              defaultIcon = '🏪'; defaultBadge = 'Retail'; defaultTag = 'General Store';
              bgStyle = { background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' };
            }
            
            // Override with owner-uploaded banner if available
            if (store.banner_url) {
              bgStyle = { backgroundImage: `url('${store.banner_url}')`, backgroundSize: 'cover', backgroundPosition: 'center' };
            }
            
            return (
              <Link key={store.slug} href={`/store?shop=${store.slug}`} className={`mk-card ${glowClass}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="mk-card-top">
                  <h2>{store.name}</h2>
                  <span className="mk-badge">{defaultBadge}</span>
                </div>
                <div className="mk-card-img" style={bgStyle}>
                </div>
                <div className="mk-card-body">
                  <div className="mk-brand-info">
                    <div className={`mk-brand-icon ${iconClass}`} style={{ fontSize: '20px' }}>{defaultIcon}</div>
                    <span className="mk-brand-name">{store.name}</span>
                    <div className="mk-rating">★ 4.8</div>
                  </div>
                  <div className="mk-tags">
                    <span className="mk-tag">{defaultTag}</span>
                  </div>
                  <p className="mk-desc">Discover {store.name} powered by AI. 24/7 engagement and instant support in {store.language}.</p>
                  <div className="mk-products-preview">
                    <span>{store.product_count} Products</span>
                    <span>•</span>
                    <span>₹{store.min_price} – ₹{store.max_price}</span>
                  </div>
                </div>
                <div className="mk-card-footer">
                  <div className="mk-status">
                    <div className="mk-dot"></div> Live AI Support
                  </div>
                  <span className={`mk-chat-btn ${btnClass}`}>Chat with AI →</span>
                </div>
              </Link>
            );
          })}
        </section>

        {/* Call to Action for Businesses */}
        <section className="mk-cta-section">
          <h2>Are you a business owner?</h2>
          <p>
            Launch your own 24/7 AI Sales Agent in minutes. Automate customer support, capture leads, and sell products directly through chat.
          </p>
          <Link href="/signup" className="mk-get-started" style={{ textDecoration: 'none', display: 'inline-block' }}>
            Get Started for Free
          </Link>
        </section>

      </div>
    </div>
  );
}
