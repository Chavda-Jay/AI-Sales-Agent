'use client';

import React from 'react';
import Link from 'next/link';

export default function MarketplaceHome() {
  return (
    <div className="marketplace-bg">
      <div className="marketplace-container">
        
        {/* Header */}
        <header className="mk-header">
          <div className="mk-logo">AI Sales Agent</div>
          <nav className="mk-nav">
            <a href="#stores" className="mk-nav-link active">Stores</a>
            <Link href="/dashboard" className="mk-nav-link">Dashboard</Link>
          </nav>
        </header>

        {/* Hero */}
        <section className="mk-hero">
          <h1>Explore Connected AI Stores</h1>
          <p>Discover and shop from leading businesses utilizing our advanced AI Sales Agents for 24/7 engagement.</p>
        </section>

        {/* Store Cards — only actual configs */}
        <section className="mk-grid mk-grid-2" id="stores">
          
          {/* Card 1: Urban Threads Clothing */}
          <Link href="/store?shop=clothing" className="mk-card mk-glow-purple" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="mk-card-top">
              <h2>Urban Threads</h2>
              <span className="mk-badge">Clothing</span>
            </div>
            <div className="mk-card-img" style={{ backgroundImage: 'url(/images/clothing_banner.jpg)' }}>
            </div>
            <div className="mk-card-body">
              <div className="mk-brand-info">
                <div className="mk-brand-icon">👕</div>
                <span className="mk-brand-name">Urban Threads Clothing</span>
                <div className="mk-rating">★ 4.8</div>
              </div>
              <div className="mk-tags">
                <span className="mk-tag">Apparel & Fashion</span>
              </div>
              <p className="mk-desc">Discover modern apparel — T-Shirts, Jeans, Sneakers, Kurtas, Sarees & more. AI-driven fashion advice with instant ordering.</p>
              <div className="mk-products-preview">
                <span>12 Products</span>
                <span>•</span>
                <span>₹499 – ₹2999</span>
              </div>
            </div>
            <div className="mk-card-footer">
              <div className="mk-status">
                <div className="mk-dot"></div> Live AI Support
              </div>
              <span className="mk-chat-btn">Chat with AI →</span>
            </div>
          </Link>

          {/* Card 2: Sharma Electronics */}
          <Link href="/store?shop=electronics" className="mk-card mk-glow-blue" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="mk-card-top">
              <h2>Sharma Electronics</h2>
              <span className="mk-badge">Electronics</span>
            </div>
            <div className="mk-card-img" style={{ backgroundImage: 'url(/images/electronics_banner.jpg)' }}>
            </div>
            <div className="mk-card-body">
              <div className="mk-brand-info">
                <div className="mk-brand-icon mk-icon-blue">📺</div>
                <span className="mk-brand-name">Sharma Electronics</span>
                <div className="mk-rating">★ 4.8</div>
              </div>
              <div className="mk-tags">
                <span className="mk-tag">Tech & Gadgets</span>
              </div>
              <p className="mk-desc">Smart TVs, Refrigerators, Mixer Grinders & Bluetooth Earphones. Expert AI support with EMI options.</p>
              <div className="mk-products-preview">
                <span>4 Products</span>
                <span>•</span>
                <span>₹1299 – ₹24999</span>
              </div>
            </div>
            <div className="mk-card-footer">
              <div className="mk-status">
                <div className="mk-dot"></div> Live AI Support
              </div>
              <span className="mk-chat-btn mk-btn-blue">Chat with AI →</span>
            </div>
          </Link>

        </section>
      </div>
    </div>
  );
}
