'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

const BACKEND_URL = "http://localhost:3001/api/chat";
const HEALTH_URL = "http://localhost:3001/api/health";

const stages = [
  "New Visitor",
  "Interested",
  "Considering",
  "Ready to Buy",
  "Special Offer",
  "Order Placed",
  "Purchased"
];

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
  if (imgSrc) {
      return <img src={imgSrc} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  }
  if (n.includes('jacket') || n.includes('hoodie')) return '🧥';
  if (n.includes('dress')) return '👗';
  if (n.includes('bag')) return '👜';
  if (n.includes('watch')) return '⌚';
  return '📦';
}

function segColor(seg) {
  if (seg === 'HOT') return 'var(--hot)';
  if (seg === 'WARM') return 'var(--warm)';
  if (seg === 'CUSTOMER') return 'var(--cust)';
  return 'var(--cold)';
}

export default function Home() {
  const [config, setConfig] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');
  
  // Profile state
  const [score, setScore] = useState(0);
  const [segment, setSegment] = useState('AWAITING');
  const [reasoning, setReasoning] = useState('Waiting for first message...');
  const [objection, setObjection] = useState('...');
  const [recProduct, setRecProduct] = useState('...');
  const [nextAction, setNextAction] = useState('...');
  
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  const [customerId] = useState(() => "demo-customer-" + Date.now());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (!isTyping) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isTyping]);

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const r = await fetch(HEALTH_URL);
        if (r.ok) {
          setBackendStatus('ok');
        } else {
          setBackendStatus('err');
        }
      } catch (e) {
        setBackendStatus('err');
      }
    };
    checkBackend();

    const loadBrandAndGreet = async () => {
      try {
        const res = await fetch("http://localhost:3001/api/config");
        const data = await res.json();
        setConfig(data);
        const firstTwo = data.catalog.slice(0, 3).map(p => p.name).join(', ');
        setMessages([
          {
            text: `Hi! Welcome to ${data.brandName} 👋 We have ${firstTwo} and more. What are you looking for today?`,
            who: 'agent'
          }
        ]);
      } catch (e) {
        setMessages([
          {
            text: "Hi! Welcome to our store 👋 What are you looking for today? (Could not load business config ❌ check backend)",
            who: 'agent'
          }
        ]);
      }
    };
    loadBrandAndGreet();
  }, []);

  const updateProfile = (newScore, newSegment, newReasoning, newObjection, newRec, newNext) => {
    const s = Math.max(0, Math.min(100, newScore || 0));
    setScore(s);
    setSegment(newSegment || 'COLD');
    setReasoning(newReasoning || '...');
    setObjection(newObjection || 'None detected');
    setRecProduct(newRec || '...');
    setNextAction(newNext || '...');
    
    let idx = 0;
    if (newSegment === 'CUSTOMER') idx = 6;
    else if (s >= 80) idx = 4;
    else if (s >= 60) idx = 3;
    else if (s >= 40) idx = 2;
    else if (s >= 20) idx = 1;
    setCurrentStageIndex(prev => Math.max(prev, idx));
  };

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text) return;
    setMessages(prev => [...prev, { text, who: 'user' }]);
    setInputValue('');
    setIsTyping(true);

    try {
      const res = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, message: text })
      });
      const data = await res.json();
      setIsTyping(false);
      
      if (data.error) {
        setMessages(prev => [...prev, { text: '❌ ' + data.error, who: 'sys' }]);
      } else {
        setMessages(prev => {
          const newMsgs = [...prev, { text: data.reply, who: 'agent' }];
          if (data.order_ready) {
            newMsgs.push({
              isOrder: true,
              orderId: data.order_id,
              product: data.order_product,
              amount: data.order_amount,
              who: 'agent'
            });
          }
          return newMsgs;
        });
        updateProfile(data.intent_score, data.segment, data.reasoning, data.objection, data.recommended_product, data.next_action);
      }
    } catch (e) {
      setIsTyping(false);
      setMessages(prev => [...prev, { text: '❌ Could not reach backend. Is server.js running on port 3001?', who: 'sys' }]);
    }
  };

  const circumference = 314;
  const offset = circumference - (score / 100) * circumference;
  const badgeBg = segColor(segment);
  const badgeColor = segment === 'WARM' ? '#000000' : '#ffffff';

  return (
    <>
      <nav className="navbar">
        <div className="nav-brand">
          <div style={{ background: 'var(--primary)', width: '20px', height: '20px', borderRadius: '4px' }}></div>
          {config?.brandName || 'Urban Threads'} <span>Agent</span>
        </div>
      </nav>

      <div className="wrap">
        <div className="eyebrow">Live Prototype</div>
      <h1 id="brandTitle">{config ? `${config.brandName} – AI Sales Agent` : 'AI Sales & Marketing Agent'}</h1>
      <p className="sub" id="brandSub">{config ? `Live AI sales conversation for ${config.brandName}. Every reply is generated from the real product catalog and policies below.` : 'Real-time customer conversation, intent scoring, and lead classification – powered by your own backend.'}</p>
      
      <div className="products-strip" id="productsStrip">
        {config?.catalog.map((p, i) => (
          <div className="product-chip" key={i}>
            <div className="icon">{iconFor(p.name)}</div>
            <div className="pname">{p.name}</div>
            <div className="pprice">₹{p.price}</div>
          </div>
        ))}
      </div>

      <div className="stage-strip" id="stageStrip">
        {stages.map((s, i) => {
          let className = 'stage';
          if (i === currentStageIndex) className += ' active';
          else if (i < currentStageIndex) className += ' passed';
          return <div className={className} key={i}>{s}</div>;
        })}
      </div>

      <div className="grid">
        <div className="card chatcard">
          <div className="chat-header">Live Conversation</div>
            <div className="messages" id="chatbox">
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
                        <div className="receipt-row"><span>Item</span><span className="receipt-val">{m.product || 'Unknown Item'}</span></div>
                      </div>
                      <div className="receipt-total"><span>Total</span><span>₹{m.amount || '0'}</span></div>
                    </div>
                  );
                }
                return <div key={i} className={`bubble ${m.who}`}>{m.text}</div>;
              })}
              {isTyping && (
                <div className="typing">Agent is typing...</div>
              )}
            </div>
            <div ref={messagesEndRef} />
          <div className="input-area">
            <div className="inputrow">
              <input 
                id="input"
                ref={inputRef}
                placeholder="Type as a customer... e.g. 'jeans is available ?'" 
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !isTyping) handleSend() }}
                disabled={isTyping}
                autoFocus
              />
              <button id="sendBtn" onClick={handleSend} disabled={isTyping || !inputValue.trim()}>Send</button>
            </div>
          </div>
          <div className="conn" id="conn">
            <span className={`status-dot ${backendStatus === 'ok' ? 'ok' : backendStatus === 'err' ? 'err' : ''}`} id="dot"></span>
            <span id="connText">{backendStatus === 'ok' ? 'Backend connected @ localhost:3001' : backendStatus === 'err' ? 'Backend not reachable - make sure "npm start" is running in the backend folder' : 'Checking backend...'}</span>
          </div>
        </div>

        <div className="card profile">
          <h2>Customer Profile</h2>
          <div className={`gauge-wrap ${segment === 'HOT' ? 'intent-hot' : segment === 'WARM' ? 'intent-warm' : segment === 'CUSTOMER' ? 'intent-cust' : ''}`}>
            <div className="score-num" id="scoreNum">{score}</div>
            <div className="score-label">Intent Score</div>
            <div className="badge" id="segmentBadge" style={{ background: badgeBg, color: badgeColor }}>{segment}</div>
          </div>

          <div className="fields-container">

          <div className="field">
            <div className="label">Live Intent Score</div>
            <div className="desc">Analyzed from customer tone & phrasing</div>
          </div>
          <div className="field">
            <div className="label">AI Reasoning</div>
            <div className="val" id="reasoningVal">{reasoning}</div>
          </div>
          <div className="field">
            <div className="label">Detected Objection</div>
            <div className="val" id="objectionVal">{objection}</div>
          </div>
          <div className="field">
            <div className="label">Recommended Product</div>
            <div className="val" id="recProductVal">{recProduct}</div>
          </div>
          <div className="field" style={{ border: 'none', marginBottom: 0 }}>
            <div className="label">Next Best Action</div>
            <div className="val" id="nextActionVal">{nextAction}</div>
          </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
