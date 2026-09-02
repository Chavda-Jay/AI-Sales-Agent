'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const rawApi = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const API_BASE = rawApi.replace(/\/+$/, '');
const BACKEND_URL = `${API_BASE}/api/chat`;
const HEALTH_URL = `${API_BASE}/api/health`;

function iconFor(name) {
  const n = name.toLowerCase();
  let imgSrc = '';
  if (n.includes('jean')) imgSrc = '/images/slim_jeans.jpg';
  else if (n.includes('t-shirt') || n.includes('tshirt') || n.includes('cotton shirt')) imgSrc = '/images/mens_tshirt.jpg';
  else if (n.includes('shirt')) imgSrc = '/images/formal_shirt.jpg';
  else if (n.includes('sneaker') || n.includes('shoe')) imgSrc = '/images/casual_sneakers.jpg';
  else if (n.includes('tv') || n.includes('smart')) imgSrc = '/images/smart_tv.jpg';
  else if (n.includes('refrigerator')) imgSrc = '/images/refrigerator.jpg';
  else if (n.includes('mixer') || n.includes('grinder')) imgSrc = '/images/mixer.jpg';
  else if (n.includes('earphone') || n.includes('bluetooth')) imgSrc = '/images/earphones.jpg';
  else if (n.includes('hoodie')) imgSrc = '/images/winter_hoodie.jpg';
  else if (n.includes('kurta')) imgSrc = '/images/kurta_set.jpg';
  else if (n.includes('jacket')) imgSrc = '/images/denim_jacket.jpg';
  else if (n.includes('belt')) imgSrc = '/images/leather_belt.jpg';
  else if (n.includes('chino') || n.includes('pants')) imgSrc = '/images/chino_pants.jpg';
  else if (n.includes('aviator') || n.includes('sunglass')) imgSrc = '/images/aviator_sunglasses.jpg';
  else if (n.includes('saree') || n.includes('silk')) imgSrc = '/images/silk_saree.jpg';
  if (imgSrc) {
    return <img src={imgSrc} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '48px', height: '48px', opacity: 0.5, margin: 'auto' }}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
  );
}

export default function Home() {
  const [config, setConfig] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [customerId] = useState(() => "demo-customer-" + Date.now());
  const [shopParam, setShopParam] = useState(null);
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

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, isChatOpen]);

  useEffect(() => {
    if (!isTyping && isChatOpen) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isTyping, isChatOpen]);

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const r = await fetch(HEALTH_URL);
        if (r.ok) setBackendStatus('ok');
        else setBackendStatus('err');
      } catch (e) {
        setBackendStatus('err');
      }
    };
    checkBackend();

    const loadBrandAndGreet = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const shop = params.get('shop');
        if (shop) setShopParam(shop);
        
        const fetchUrl = shop ? `${API_BASE}/api/config?shop=${shop}` : `${API_BASE}/api/config`;
        const res = await fetch(fetchUrl);
        const data = await res.json();
        setConfig(data);
        setMessages([
          {
            text: `Hi! Welcome to ${data.brandName} 👋 How can I help you today?`,
            who: 'agent',
            isGreeting: true
          }
        ]);
      } catch (e) {
        setMessages([
          {
            text: "Hi! Welcome to our store 👋 How can I help you today?",
            who: 'agent',
            isGreeting: true
          }
        ]);
      }
    };
    loadBrandAndGreet();
  }, []);

  useEffect(() => {
    if (!customerId) return;
    const pollHistory = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/chat/poll/${customerId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          const newMessages = [];
          data.messages.forEach(m => {
            if (m.role === 'user') {
              newMessages.push({ text: m.content, who: 'user' });
            } else if (m.role === 'assistant') {
              try {
                const parsed = JSON.parse(m.content);
                if (parsed.reply) {
                  newMessages.push({ text: parsed.reply, who: 'bot', receipt: parsed.order_ready, amount: parsed.order_amount, orderId: parsed.order_id, product: parsed.order_product });
                }
              } catch (e) {
                newMessages.push({ text: m.content, who: 'bot' });
              }
            }
          });

          setMessages(prev => {
            const prevChatCount = prev.filter(m => !m.isGreeting).length;
            if (newMessages.length > prevChatCount) {
              const greeting = prev.filter(m => m.isGreeting);
              const mappedMessages = newMessages.map(m => {
                if (m.who === 'bot') {
                  if (m.receipt) {
                    return { text: m.text, who: 'agent', isOrder: true, orderId: m.orderId, product: m.product, amount: m.amount };
                  }
                  return { text: m.text, who: 'agent' };
                }
                return m;
              });
              return [...greeting, ...mappedMessages];
            }
            return prev;
          });
        }
      } catch (e) { }
    };

    const intervalId = setInterval(pollHistory, 3000);
    return () => clearInterval(intervalId);
  }, [customerId]);

  const handleSendText = async (textToSend) => {
    const text = textToSend.trim();
    if (!text) return;
    setMessages(prev => [...prev, { text, who: 'user' }]);
    setIsTyping(true);

    try {
      const res = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, message: text, shop: shopParam })
      });
      const data = await res.json();
      setIsTyping(false);

      if (!res.ok) {
        const errorMsg = data.detail || data.error || 'Server error occurred.';
        setMessages(prev => [...prev, { text: '❌ ' + errorMsg, who: 'sys' }]);
      } else if (data.error) {
        setMessages(prev => [...prev, { text: '❌ ' + data.error, who: 'sys' }]);
      } else {
        setMessages(prev => {
          const newMsgs = [...prev, { text: data.reply, who: 'agent', requiresDetails: data.requires_details }];
          if (data.order_ready) {
            newMsgs.push({
              isOrder: true,
              orderId: data.order_id || 'ORD-' + Math.floor(1000 + Math.random() * 9000),
              product: data.order_product,
              amount: data.order_amount,
              who: 'agent'
            });
          }
          return newMsgs;
        });
      }
    } catch (e) {
      setIsTyping(false);
      setMessages(prev => [...prev, { text: '❌ Could not reach backend.', who: 'sys' }]);
    }
  };

  const handleSend = () => {
    handleSendText(inputValue);
    setInputValue('');
  };

  return (
    <>
      <nav className="navbar" style={{ justifyContent: 'space-between' }}>
        <div style={{ width: '100px' }}></div> {/* Spacer for centering nav-brand */}
        <div className="nav-brand">
          {config?.brandName || 'Store'}
        </div>
        <button 
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          style={{
            background: 'var(--panel2)', border: '1px solid var(--line)', color: 'var(--ivory)',
            cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 16px', borderRadius: '24px', fontWeight: 'bold', fontFamily: 'var(--font-heading)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}
          title="Toggle Theme"
        >
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </button>
      </nav>

      <div className="store-hero">
        <h1>{config ? `Welcome to ${config.brandName}` : 'Premium Store'}</h1>
        <p>Discover our exclusive collection of high-quality products. Expertly crafted for those who demand the best.</p>
      </div>

      <div className="store-grid">
        {config?.catalog.map((p, i) => (
          <div className="store-product" key={i}>
            <div className="store-product-img">
              {iconFor(p.name)}
            </div>
            <div className="store-product-info">
              <div className="store-product-name">{p.name}</div>
              <div className="store-product-price">₹{p.price}</div>
            </div>
          </div>
        ))}
      </div>

      <footer className="store-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <h2>{config?.brandName || 'Store'}</h2>
            <p>Premium quality products designed for those who appreciate the finer things in life. Step into luxury with our exclusive AI-powered storefront.</p>
          </div>

          <div className="footer-links">
            <h3>Shop</h3>
            <ul>
              <li><a href="#">New Arrivals</a></li>
              <li><a href="#">Best Sellers</a></li>
              <li><a href="#">Menswear</a></li>
              <li><a href="#">Accessories</a></li>
            </ul>
          </div>

          <div className="footer-links">
            <h3>Support</h3>
            <ul>
              <li><a href="#">Contact Us</a></li>
              <li><a href="#">Shipping & Returns</a></li>
              <li><a href="#">FAQ</a></li>
              <li><a href="#">Track Order</a></li>
            </ul>
          </div>

          <div className="footer-links">
            <h3>Legal</h3>
            <ul>
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Terms of Service</a></li>
              <li><a href="#">Cookie Policy</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <div>&copy; {new Date().getFullYear()} {config?.brandName || 'Urban Threads'}. All rights reserved.</div>
          <div>Powered by Advanced B2C AI Sales Agent</div>
        </div>
      </footer>

      <div className="chat-widget-container">
        {isChatOpen && (
          <div className="floating-chat-window">
            <div className="chat-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '50%', boxShadow: '0 0 10px #10b981' }}></div>
                <div style={{ color: 'white', fontWeight: 800, fontSize: '16px', letterSpacing: '0.02em' }}>Shopping Assistant</div>
              </div>
              <button className="close-chat" onClick={() => setIsChatOpen(false)}>×</button>
            </div>

            <div className="messages" id="chatbox" style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {messages.map((m, i) => {
                if (m.isOrder) {
                  return (
                    <div key={i} className="receipt-card">
                      <div className="receipt-header">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        Order Confirmed
                      </div>
                      <div className="receipt-body">
                        <div className="receipt-row"><span>Order ID</span><span className="receipt-val">{m.orderId}</span></div>
                        <div className="receipt-row"><span>Item</span><span className="receipt-val">{m.product || 'Item'}</span></div>
                      </div>
                      <div className="receipt-total"><span>Total</span><span>₹{m.amount || '0'}</span></div>
                    </div>
                  );
                }
                const displayText = (m.text || '').replace(/\\n/g, '\n').replace(/\|\s*\n\s*\|/g, '|\n|');
                const isLast = i === messages.length - 1;
                return (
                  <div key={i} className={`bubble ${m.who}`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayText}</ReactMarkdown>
                    {m.requiresDetails && isLast && (
                      <div className="order-details-form">
                        <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>Please provide order details</div>
                        <input type="text" id={`form-size-${i}`} placeholder="Size (e.g. S, M, L or N/A)" className="form-input" />
                        <input type="text" id={`form-color-${i}`} placeholder="Color preference" className="form-input" />
                        <input type="text" id={`form-name-${i}`} placeholder="Full Name" className="form-input" />
                        <input type="text" id={`form-phone-${i}`} placeholder="Phone Number" className="form-input" />
                        <button className="form-submit-btn" onClick={() => {
                          const size = document.getElementById(`form-size-${i}`).value;
                          const color = document.getElementById(`form-color-${i}`).value;
                          const name = document.getElementById(`form-name-${i}`).value;
                          const phone = document.getElementById(`form-phone-${i}`).value;
                          if (!name || !phone) { alert("Name and Phone are required to proceed."); return; }

                          // Hide the form by modifying this message in state
                          setMessages(prev => {
                            const updated = [...prev];
                            updated[i].requiresDetails = false;
                            return updated;
                          });

                          // Send the constructed text
                          const text = `My order details - Size: ${size || 'N/A'}, Color: ${color || 'N/A'}, Name: ${name}, Phone: ${phone}`;
                          handleSendText(text);
                        }}>Submit Details</button>
                      </div>
                    )}

                  </div>
                );
              })}
              {isTyping && (
                <div className="typing">Agent is typing...</div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="input-area">
              <div className="inputrow">
                <input
                  id="input"
                  ref={inputRef}
                  placeholder="Ask a question..."
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !isTyping) handleSend() }}
                  disabled={isTyping}
                  autoFocus
                />
                <button id="sendBtn" onClick={handleSend} disabled={isTyping || !inputValue.trim()}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {!isChatOpen && (
          <button className="chat-toggle-btn" onClick={() => setIsChatOpen(true)}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
          </button>
        )}
      </div>
    </>
  );
}
