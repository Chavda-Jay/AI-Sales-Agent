'use client';

import React from 'react';
import Link from 'next/link';

export default function MarketplaceHome() {
  return (
    <div className="marketplace-bg">
      <div className="marketplace-container">
        
        {/* Header */}
        <header className="mk-header">
          <div className="mk-logo">AISALES.IO</div>
          <nav className="mk-nav">
            <a href="#" className="mk-nav-link active">Explore</a>
            <a href="#" className="mk-nav-link">Features</a>
            <a href="#" className="mk-nav-link">Pricing</a>
            <a href="#" className="mk-nav-link">Support</a>
          </nav>
          <button className="mk-get-started">Get Started</button>
        </header>

        {/* Hero */}
        <section className="mk-hero">
          <h1>Explore Connected AI Stores</h1>
          <p>Discover and shop from leading businesses utilizing our advanced AI Sales Agents for 24/7 engagement.</p>
        </section>

        {/* Store Cards */}
        <section className="mk-grid">
          
          {/* Card 1: Clothing */}
          <div className="mk-card mk-glow-purple">
            <div className="mk-card-top">
              <h2>Urban Threads</h2>
              <span className="mk-badge">Clothing</span>
            </div>
            <div className="mk-card-img" style={{ backgroundImage: 'url(/images/formal_shirt.jpg)' }}>
              <div className="mk-img-overlay">
                <h3>Urban<br/>Threads</h3>
              </div>
            </div>
            <div className="mk-card-body">
              <div className="mk-brand-info">
                <div className="mk-brand-icon">
                  <svg viewBox="0 0 24 24" fill="white" width="16" height="16"><path d="M12 2L2 22h20L12 2z"/></svg>
                </div>
                <span className="mk-brand-name">Urban Threads</span>
                <div className="mk-rating">★ 4.8</div>
              </div>
              <div className="mk-tags">
                <span className="mk-tag">Apparel & Fashion</span>
              </div>
              <p className="mk-desc">Discover modern apparel, accessories, and AI-driven fashion advice.</p>
            </div>
            <div className="mk-card-footer">
              <div className="mk-status">
                <div className="mk-dot"></div> Live AI Support
              </div>
              <Link href="/store?shop=clothing" className="mk-chat-btn">Chat with AI</Link>
            </div>
          </div>

          {/* Card 2: Electronics */}
          <div className="mk-card mk-glow-blue">
            <div className="mk-card-top">
              <h2>Electronic Hub</h2>
              <span className="mk-badge">Gadgets</span>
            </div>
            <div className="mk-card-img" style={{ backgroundImage: 'url(/images/smart_tv.jpg)' }}>
              <div className="mk-img-overlay mk-overlay-blue">
                <svg viewBox="0 0 24 24" fill="white" width="48" height="48" style={{opacity: 0.5}}><path d="M4 6h16v12H4z"/></svg>
              </div>
            </div>
            <div className="mk-card-body">
              <div className="mk-brand-info">
                <div className="mk-brand-icon mk-icon-blue">
                  <svg viewBox="0 0 24 24" fill="white" width="16" height="16"><circle cx="12" cy="12" r="8"/></svg>
                </div>
                <span className="mk-brand-name">Electronic Hub</span>
                <div className="mk-rating">★ 4.8</div>
              </div>
              <div className="mk-tags">
                <span className="mk-tag">Tech & Gadgets</span>
              </div>
              <p className="mk-desc">Your source for cutting-edge electronics and smart devices, always supported by our AI experts.</p>
            </div>
            <div className="mk-card-footer">
              <div className="mk-status">
                <div className="mk-dot mk-dot-green"></div> Live AI Support
              </div>
              <Link href="/store?shop=electronics" className="mk-chat-btn mk-btn-blue">Chat with AI</Link>
            </div>
          </div>

          {/* Card 3: Beauty (Demo) */}
          <div className="mk-card mk-glow-pink">
            <div className="mk-card-top">
              <h2>Cosmetic Haven</h2>
              <span className="mk-badge">Beauty</span>
            </div>
            <div className="mk-card-img" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500&q=80)' }}>
              <div className="mk-img-overlay mk-overlay-pink">
                <svg viewBox="0 0 24 24" fill="white" width="48" height="48" style={{opacity: 0.5}}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
              </div>
            </div>
            <div className="mk-card-body">
              <div className="mk-brand-info">
                <div className="mk-brand-icon mk-icon-pink">
                  <svg viewBox="0 0 24 24" fill="white" width="16" height="16"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9z"/></svg>
                </div>
                <span className="mk-brand-name">Cosmetic Haven</span>
                <div className="mk-rating">★ 4.8</div>
              </div>
              <div className="mk-tags">
                <span className="mk-tag">Beauty & Skincare</span>
              </div>
              <p className="mk-desc">Curated beauty essentials, premium skincare, and personalized beauty recommendations from our AI.</p>
            </div>
            <div className="mk-card-footer">
              <div className="mk-status">
                <div className="mk-dot mk-dot-green"></div> Live AI Support
              </div>
              <Link href="/store?shop=beauty" className="mk-chat-btn mk-btn-pink">Chat with AI</Link>
            </div>
          </div>

        </section>
      </div>
    </div>
  );
}
