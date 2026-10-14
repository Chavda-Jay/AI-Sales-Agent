'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import toast, { Toaster } from 'react-hot-toast';
import remarkGfm from 'remark-gfm';

const rawApi = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";
const API_BASE = rawApi.replace(/\/+$/, '');
const BACKEND_URL = `${API_BASE}/api/chat`;
const HEALTH_URL = `${API_BASE}/api/health`;

function iconFor(name) {
  const n = (name || '').toLowerCase();
  let imgSrc = '';
  // Electronics
  if (n.includes('ac') || n.includes('air conditioner') || n.includes('split ac')) imgSrc = '/images/split_ac.jpg';
  else if (n.includes('washing') || n.includes('machine')) imgSrc = '/images/washing_machine.jpg';
  else if (n.includes('microwave') || n.includes('oven')) imgSrc = '/images/microwave_oven.jpg';
  else if (n.includes('purifier') || n.includes('water')) imgSrc = '/images/water_purifier.jpg';
  else if (n.includes('soundbar') || n.includes('speaker') || n.includes('dolby')) imgSrc = '/images/soundbar.jpg';
  else if (n.includes('watch') || n.includes('series 9')) imgSrc = '/images/apple_watch.jpg';
  else if (n.includes('induction') || n.includes('cooktop')) imgSrc = '/images/induction_cooktop.jpg';
  else if (n.includes('drone') || n.includes('dji')) imgSrc = '/images/camera_drone.jpg';
  else if (n.includes('macbook')) imgSrc = '/images/macbook_pro.jpg';
  else if (n.includes('playstation') || n.includes('ps5')) imgSrc = '/images/ps5_console.jpg';
  else if (n.includes('dyson') || n.includes('airwrap')) imgSrc = '/images/dyson_airwrap.jpg';
  else if (n.includes('gopro') || n.includes('hero')) imgSrc = '/images/gopro_hero12.jpg';
  else if (n.includes('ipad')) imgSrc = '/images/ipad_air.jpg';
  else if (n.includes('air fryer') || n.includes('fryer')) imgSrc = '/images/air_fryer.jpg';
  else if (n.includes('logitech') || n.includes('mouse')) imgSrc = '/images/logitech_mouse.jpg';
  else if (n.includes('echo') || n.includes('alexa')) imgSrc = '/images/echo_dot.jpg';
  else if (n.includes('tv') || n.includes('smart')) imgSrc = '/images/samsung_tv.jpg';
  else if (n.includes('refrigerator') || n.includes('fridge')) imgSrc = '/images/lg_fridge.jpg';
  else if (n.includes('mixer') || n.includes('grinder')) imgSrc = '/images/mixer.jpg';
  else if (n.includes('earphone') || n.includes('bluetooth') || n.includes('boat')) imgSrc = '/images/earphones.jpg';
  // Apparel
  else if (n.includes('polo')) imgSrc = '/images/polo_tshirt.jpg';
  else if (n.includes('leather jacket') || n.includes('biker')) imgSrc = '/images/leather_jacket.jpg';
  else if (n.includes('running') || n.includes('sports shoes')) imgSrc = '/images/running_shoes.jpg';
  else if (n.includes('track')) imgSrc = '/images/track_pants.jpg';
  else if (n.includes('linen')) imgSrc = '/images/linen_shirt.jpg';
  else if (n.includes('blazer')) imgSrc = '/images/blazer.jpg';
  else if (n.includes('cargo')) imgSrc = '/images/cargo_pants.jpg';
  else if (n.includes('scarf')) imgSrc = '/images/winter_scarf.jpg';
  else if (n.includes('cap')) imgSrc = '/images/baseball_cap.jpg';
  else if (n.includes('jean')) imgSrc = '/images/slim_jeans.jpg';
  else if (n.includes('t-shirt') || n.includes('tshirt') || n.includes('cotton shirt')) imgSrc = '/images/cotton_tshirt.jpg';
  else if (n.includes('formal shirt') || n.includes('shirt')) imgSrc = '/images/formal_shirt.jpg';
  else if (n.includes('sneaker') || n.includes('shoe')) imgSrc = '/images/casual_sneakers.jpg';
  else if (n.includes('hoodie')) imgSrc = '/images/winter_hoodie.jpg';
  else if (n.includes('kurta')) imgSrc = '/images/mens_kurta.jpg';
  else if (n.includes('denim') || n.includes('jacket')) imgSrc = '/images/denim_jacket.jpg';
  else if (n.includes('belt')) imgSrc = '/images/leather_belt.jpg';
  else if (n.includes('chino') || n.includes('pants')) imgSrc = '/images/chino_pants.jpg';
  else if (n.includes('aviator') || n.includes('sunglass')) imgSrc = '/images/aviator_sunglasses.jpg';
  else if (n.includes('saree') || n.includes('silk')) imgSrc = '/images/silk_saree.jpg';

  if (imgSrc) {
    return <img src={imgSrc} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  }
  
  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e293b&color=fff&size=256&font-size=0.4`;
  return <img src={fallbackUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
}

function getProductMeta(product, index) {
  const ratings = [4.8, 4.9, 4.7, 4.9, 4.8, 4.6, 4.9, 4.7, 4.8, 4.5, 4.9, 4.7, 4.8, 4.6, 4.9, 4.7, 4.8, 4.6, 4.7, 4.8];
  const reviews = [248, 189, 312, 420, 156, 94, 280, 115, 172, 88, 310, 142, 219, 76, 305, 120, 194, 85, 110, 165];
  const badges = [
    '🔥 Bestseller', '⚡ 5-Star Rated', '✨ Top Pick', '🏷️ Deal of the Day',
    '🛡️ Official Warranty', '🚚 Free Shipping', '🔥 Trending', '⭐ Popular Choice'
  ];
  
  const rating = ratings[index % ratings.length];
  const reviewCount = reviews[index % reviews.length];
  const badge = badges[index % badges.length];
  const mrpMultiplier = 1.15 + ((index % 5) * 0.05);
  const mrp = Math.round(Number(product.price) * mrpMultiplier);
  const discountPercent = Math.round(((mrp - product.price) / mrp) * 100);

  return { rating, reviewCount, badge, mrp, discountPercent };
}

function getProductCategory(p, isElectronics) {
  const n = (p.name || '').toLowerCase();
  if (isElectronics) {
    if (n.includes('tv') || n.includes('soundbar') || n.includes('echo') || n.includes('earphone')) return 'TV & Audio';
    if (n.includes('macbook') || n.includes('ipad') || n.includes('mouse') || n.includes('watch')) return 'Computers & Wearables';
    if (n.includes('ac') || n.includes('refrigerator') || n.includes('washing') || n.includes('air fryer') || n.includes('purifier') || n.includes('induction') || n.includes('mixer')) return 'Home & Appliances';
    return 'Gadgets & Tech';
  } else {
    if (n.includes('t-shirt') || n.includes('shirt') || n.includes('polo')) return 'Shirts & Tops';
    if (n.includes('jeans') || n.includes('chino') || n.includes('track') || n.includes('cargo') || n.includes('pant')) return 'Pants & Trousers';
    if (n.includes('jacket') || n.includes('blazer') || n.includes('hoodie')) return 'Jackets & Blazers';
    if (n.includes('sneaker') || n.includes('shoe')) return 'Footwear';
    return 'Ethnic & Accessories';
  }
}

export default function Home() {
  const [config, setConfig] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [customerId, setCustomerId] = useState(() => {
    if (typeof window !== 'undefined') {
      let stored = localStorage.getItem('ai_store_customer_id');
      if (!stored) {
        stored = "demo-customer-" + Date.now();
        localStorage.setItem('ai_store_customer_id', stored);
      }
      return stored;
    }
    return "demo-customer-" + Date.now();
  });
  const [walletBalance, setWalletBalance] = useState(0);
  const [shopParam, setShopParam] = useState(null);
  const [refParam, setRefParam] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [cart, setCart] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [toastMsg, setToastMsg] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const isSendingRef = useRef(false);

  const toggleWishlist = async (product) => {
    const isWishlisted = wishlist.includes(product.id);
    if (isWishlisted) {
      setWishlist(prev => prev.filter(id => id !== product.id));
      await fetch(`${API_BASE}/api/wishlist/${product.id}?customerId=${customerId}`, { method: 'DELETE' });
      setToastMsg(`Removed ${product.name} from wishlist`);
    } else {
      setWishlist(prev => [...prev, product.id]);
      await fetch(`${API_BASE}/api/wishlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, catalogItemId: product.id })
      });
      setToastMsg(`Added ${product.name} to wishlist! ❤️`);
    }
    setTimeout(() => setToastMsg(null), 2500);
  };


  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 150);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, isChatOpen, isListening]);

  useEffect(() => {
    if (!isTyping && isChatOpen) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
    if (isChatOpen && window.innerWidth <= 768) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
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
        const ref = params.get('ref');
        if (shop) {
          setShopParam(shop);
          // dark theme only
        }
        if (ref) {
          setRefParam(ref);
          sessionStorage.setItem('ai_store_ref', ref);
        } else {
          const storedRef = sessionStorage.getItem('ai_store_ref');
          if (storedRef) setRefParam(storedRef);
        }
        
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
      try {
        const wRes = await fetch(`${API_BASE}/api/wishlist/${customerId}`);
        if (wRes.ok) {
          const wData = await wRes.json();
          setWishlist(wData.map(i => i.id));
        }
      } catch (e) {
        console.error("Wishlist load error", e);
      }
    };
    loadBrandAndGreet();
  }, [customerId]);

  useEffect(() => {
    if (!customerId) return;
    const pollHistory = async () => {
      // Skip polling while actively sending a message to prevent duplicates
      if (isSendingRef.current) return;
      try {
        const res = await fetch(`${API_BASE}/api/chat/poll/${customerId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.walletBalance !== undefined) {
          setWalletBalance(data.walletBalance);
        }
        if (data.messages && data.messages.length > 0) {
          const newMessages = [];
          data.messages.forEach(m => {
            if (m.role === 'user') {
              newMessages.push({ text: m.content, who: 'user' });
            } else if (m.role === 'assistant') {
              try {
                const parsed = JSON.parse(m.content);
                if (parsed.reply) {
                  newMessages.push({ text: parsed.reply, who: 'bot', receipt: parsed.order_ready, amount: parsed.order_amount, walletDiscount: parsed.wallet_discount_applied || 0, orderId: parsed.order_id, product: parsed.order_product, requiresDetails: parsed.requires_details, crossSellProduct: parsed.cross_sell_product || null, retention: parsed.retention || false, referralCode: parsed.referral_code });
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
                    return { text: m.text, who: 'agent', isOrder: true, orderId: m.orderId, product: m.product, amount: m.amount, walletDiscount: m.walletDiscount || 0, requiresDetails: m.requiresDetails, crossSellProduct: m.crossSellProduct, retention: m.retention, referralCode: m.referralCode };
                  }
                  return { text: m.text, who: 'agent', requiresDetails: m.requiresDetails, crossSellProduct: m.crossSellProduct, retention: m.retention, referralCode: m.referralCode };
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

    const intervalId = setInterval(pollHistory, 5000);
    return () => clearInterval(intervalId);
  }, [customerId]);

  const handleSendText = async (textToSend) => {
    const text = textToSend.trim();
    if (!text) return;
    isSendingRef.current = true;
    setMessages(prev => [...prev, { text, who: 'user' }]);
    setIsTyping(true);

    const MAX_RETRIES = 2;
    let lastError = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const activeRef = refParam || (typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('ref') || sessionStorage.getItem('ai_store_ref')) : null);
        const res = await fetch(BACKEND_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerId, message: text, shop: shopParam, ref: activeRef })
        });
        const data = await res.json();

        // Check if this is a rate-limit / traffic error that we should silently retry
        const replyText = (data.reply || '').toLowerCase();
        const isTrafficError = !res.ok || data.error ||
          replyText.includes('technical issue') || replyText.includes('high traffic') ||
          replyText.includes('phir bhejiye') || replyText.includes('wait a moment');

        if (isTrafficError && attempt < MAX_RETRIES) {
          const waitTime = (attempt + 1) * 3000; // 3s, 6s
          console.log(`[Auto-retry] Attempt ${attempt + 1} failed (traffic/rate-limit), retrying in ${waitTime / 1000}s...`);
          await new Promise(r => setTimeout(r, waitTime));
          continue;
        }

        setIsTyping(false);
        
        if (data.walletBalance !== undefined) {
          setWalletBalance(data.walletBalance);
        }

        if (!res.ok) {
          let errorMsg = data.detail || data.error || 'Server error occurred.';
          setMessages(prev => [...prev, { text: '❌ ' + errorMsg, who: 'sys' }]);
        } else if (data.error) {
          setMessages(prev => [...prev, { text: '❌ ' + data.error, who: 'sys' }]);
        } else {
          setMessages(prev => {
            const newMsgs = [...prev, { text: data.reply, who: 'agent', requiresDetails: data.requires_details, crossSellProduct: data.cross_sell_product || null }];
            if (data.order_ready) {
              newMsgs.push({
                isOrder: true,
                orderId: data.order_id || 'ORD-' + Math.floor(1000 + Math.random() * 9000),
                product: data.order_product,
                amount: data.order_amount,
                walletDiscount: data.wallet_discount_applied || 0,
                referralCode: data.referral_code,
                who: 'agent'
              });
            }
            return newMsgs;
          });
        }
        // Success or final error shown — break out of retry loop
        break;
      } catch (e) {
        lastError = e;
        if (attempt < MAX_RETRIES) {
          const waitTime = (attempt + 1) * 3000;
          console.log(`[Auto-retry] Network error, retrying in ${waitTime / 1000}s...`);
          await new Promise(r => setTimeout(r, waitTime));
          continue;
        }
        setIsTyping(false);
        setMessages(prev => [...prev, { text: '⚠️ Could not reach backend.', who: 'sys' }]);
      }
    }

    // Wait 3 seconds before allowing polling again to prevent duplicate from polling
    setTimeout(() => { isSendingRef.current = false; }, 3000);
  };

  const handleClearChat = async () => {
    const newId = "demo-customer-" + Date.now();
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai_store_customer_id', newId);
      sessionStorage.removeItem('ai_store_ref');
    }
    setCustomerId(newId);
    setWalletBalance(0);
    setRefParam(null);
    setMessages([
      {
        text: `Hi! Welcome to ${config?.brandName || 'our store'} 👋 How can I help you today?`,
        who: 'agent',
        isGreeting: true
      }
    ]);
    toast.success('Started a fresh chat session!');
  };

  const handleSend = () => {
    handleSendText(inputValue);
    setInputValue('');
  };

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const silenceTimerRef = useRef(null);

  const playBeep = (freq = 400, type = 'sine', dur = 0.1) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + dur);
    } catch(e) {}
  };

  const streamRef = useRef(null);

  const startListening = async () => {
    if (isListening) {
      // User tapped mic again while recording — stop and send
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      playBeep(600, 'sine', 0.15);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Pick a supported MIME type (Safari doesn't support webm)
      let mimeType = 'audio/webm';
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        } else {
          mimeType = ''; // Let browser decide
        }
      }

      const recorderOptions = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Set up AudioContext for silence detection
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      // CRITICAL: Mobile browsers suspend AudioContext until user gesture
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      // Use time-domain data (waveform) — works better on low-gain mobile mics
      let silenceStart = null; // null means we haven't started checking yet
      const GRACE_PERIOD = 3000; // 3 seconds before we start looking for silence
      const SILENCE_DURATION = 1800; // 1.8 seconds of silence to auto-stop
      const recordingStartTime = Date.now();

      const checkSilence = () => {
        if (mediaRecorder.state !== 'recording') return;

        // Use time-domain data — it measures actual waveform amplitude
        analyser.getByteTimeDomainData(dataArray);
        let maxAmplitude = 0;
        for (let i = 0; i < bufferLength; i++) {
          const amplitude = Math.abs(dataArray[i] - 128); // Center is 128
          if (amplitude > maxAmplitude) maxAmplitude = amplitude;
        }

        const elapsed = Date.now() - recordingStartTime;
        
        // Don't check for silence during grace period
        if (elapsed < GRACE_PERIOD) {
          silenceTimerRef.current = requestAnimationFrame(checkSilence);
          return;
        }

        // After grace period, detect voice vs silence
        // Amplitude > 5 means some voice detected (very sensitive for mobile)
        if (maxAmplitude > 5) {
          silenceStart = null; // Voice detected, reset silence timer
        } else {
          if (silenceStart === null) {
            silenceStart = Date.now();
          }
          if (Date.now() - silenceStart > SILENCE_DURATION) {
            // Silence detected for long enough — auto-stop and send
            mediaRecorder.stop();
            return;
          }
        }
        silenceTimerRef.current = requestAnimationFrame(checkSilence);
      };

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        playBeep(400, 'sine', 0.15);
        cancelAnimationFrame(silenceTimerRef.current);
        try { if (audioContext.state !== 'closed') audioContext.close(); } catch(e) {}
        
        const actualMime = mediaRecorder.mimeType || mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });
        
        // Don't send if audio is too small (just noise/click)
        if (audioBlob.size < 3000) {
          setIsListening(false);
          stream.getTracks().forEach(track => track.stop());
          streamRef.current = null;
          return;
        }
        
        setIsListening(false);
        setIsTyping(true); 
        
        // Map correct extension for Whisper API
        let ext = 'webm';
        if (actualMime.includes('mp4')) ext = 'm4a';
        else if (actualMime.includes('wav')) ext = 'wav';
        else if (actualMime.includes('ogg')) ext = 'ogg';

        const formData = new FormData();
        formData.append('file', audioBlob, `voice.${ext}`);
        
        try {
          const res = await fetch(`${API_BASE}/api/voice-to-text`, {
            method: 'POST',
            body: formData,
          });
          const data = await res.json();
          if (data.text && data.text.trim().length > 0) {
             const combined = inputValue ? inputValue + ' ' + data.text : data.text;
             setInputValue('');
             handleSendText(combined);
          } else {
             setIsTyping(false);
          }
        } catch (error) {
          console.error("Voice processing error", error);
          setIsTyping(false);
        }
        
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      };

      mediaRecorder.start();
      setIsListening(true);
      checkSilence();
    } catch (err) {
      alert("Microphone permission denied or not supported.");
      console.error(err);
    }
  };

  return (
    <>
      <Toaster position="top-center" />
      <nav className="navbar" style={{ justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}></div>
        <div className="nav-brand" style={{ textAlign: 'center' }}>
          {config?.brandName || 'Store'}
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
          <button 
            className="nav-cart-btn"
            onClick={() => setIsWishlistOpen(true)}
            title="Wishlist"
            style={{ position: 'relative' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill={wishlist.length > 0 ? "#ef4444" : "none"} stroke={wishlist.length > 0 ? "#ef4444" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            {wishlist.length > 0 && <span className="cart-badge">{wishlist.length}</span>}
          </button>
          <button 
            className="nav-cart-btn"
            onClick={() => setIsCartOpen(true)}
            style={{ position: 'relative' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
            {cart.length > 0 && <span className="cart-badge">{cart.length}</span>}
          </button>

        </div>
      </nav>
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className="toast-notification">
          {toastMsg}
        </div>
      )}

      {/* Sleek Modern Store Header (Clean, Premium & Product-Focused) */}
      {(() => {
        const brandNameLower = (config?.brandName || shopParam || '').toLowerCase();
        const isElectronics = brandNameLower.includes('electronic') || brandNameLower.includes('tech') || brandNameLower.includes('mobile');
        const defaultName = shopParam === 'urban-threads' ? 'Urban Threads Clothing' : 'Sharma Electronics';
        const brandDisplayName = config?.brandName || defaultName;

        return (
          <header className="store-header-banner">
            <div className="store-header-inner">
              <div className="store-header-badge">
                <span className="live-pulse-dot"></span>
                <span className="store-badge-text">{isElectronics ? 'Official Electronics Store' : 'Official Fashion Boutique'}</span>
                <span className="verified-check">✓ Verified AI Store</span>
              </div>
              <h1 className="store-header-title">{brandDisplayName}</h1>
              <p className="store-header-subtitle">
                {isElectronics 
                  ? 'Explore 20 authentic high-end electronics, smart appliances & gadgets with instant 24/7 AI shopping assistance.'
                  : 'Explore 20 curated trendiest fashion apparel, footwear & accessories tailored for your lifestyle.'}
              </p>
            </div>
          </header>
        );
      })()}

      {/* Trust & Guarantee Bar */}
      <div className="store-trust-bar">
        <div className="trust-item">
          <div className="trust-icon-box">⚡</div>
          <div>
            <div className="trust-title">Express Delivery</div>
            <div className="trust-sub">Dispatched within 24-48 hours</div>
          </div>
        </div>
        <div className="trust-item">
          <div className="trust-icon-box">🛡️</div>
          <div>
            <div className="trust-title">100% Brand Warranty</div>
            <div className="trust-sub">Authorized genuine products</div>
          </div>
        </div>
        <div className="trust-item">
          <div className="trust-icon-box">🔄</div>
          <div>
            <div className="trust-title">7-Day Easy Returns</div>
            <div className="trust-sub">Instant doorstep pickup</div>
          </div>
        </div>
        <div className="trust-item">
          <div className="trust-icon-box">🤖</div>
          <div>
            <div className="trust-title">AI Shopping Assistant</div>
            <div className="trust-sub">24/7 expert advice & deals</div>
          </div>
        </div>
      </div>

      {/* Search & Category Filter Section */}
      {(() => {
        const brandNameLower = (config?.brandName || shopParam || '').toLowerCase();
        const isElectronics = brandNameLower.includes('electronic') || brandNameLower.includes('tech') || brandNameLower.includes('mobile');
        const allCatalog = config?.catalog || [];

        const categoryCounts = {};
        allCatalog.forEach(p => {
          const cat = getProductCategory(p, isElectronics);
          categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        });

        const categoryTabs = [
          { key: 'All', label: 'All Items', count: allCatalog.length },
          ...Object.keys(categoryCounts).map(cat => ({
            key: cat,
            label: cat,
            count: categoryCounts[cat]
          }))
        ];

        const filteredCatalog = allCatalog.filter(p => {
          const matchesSearch = !searchQuery || 
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            (p.note && p.note.toLowerCase().includes(searchQuery.toLowerCase()));
          const matchesCategory = selectedCategory === 'All' || 
            getProductCategory(p, isElectronics) === selectedCategory;
          return matchesSearch && matchesCategory;
        });

        return (
          <>
            <div className="store-filter-section">
              <div className="store-search-box">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input 
                  type="text" 
                  placeholder={`Search among ${allCatalog.length} ${isElectronics ? 'gadgets, appliances & smart tech' : 'fashion items & apparel'}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="search-clear-btn" title="Clear search">✕</button>
                )}
              </div>

              <div className="store-category-tabs">
                {categoryTabs.map(cat => (
                  <button
                    key={cat.key}
                    className={`cat-pill ${selectedCategory === cat.key ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat.key)}
                  >
                    {cat.label} <span className="cat-count">({cat.count})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Products Grid */}
            {filteredCatalog.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                <div style={{ fontSize: '42px', marginBottom: '12px' }}>🔍</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>No products found</div>
                <p style={{ marginTop: '6px' }}>Try searching with a different keyword or reset filters.</p>
                <button 
                  onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
                  style={{ marginTop: '16px', background: '#3b82f6', border: 'none', color: '#fff', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="store-grid">
                {filteredCatalog.map((p, i) => {
                  const meta = getProductMeta(p, i);
                  return (
                    <div className="store-product" key={p.id || i}>
                      <div className="store-product-img">
                        <span className="product-badge-chip">{meta.badge}</span>
                        {p.image_url ? (
                          <img 
                            src={p.image_url} 
                            alt={p.name}
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=1e293b&color=fff&size=256&font-size=0.4`;
                            }}
                          />
                        ) : (
                          iconFor(p.name)
                        )}
                      </div>
                      <div className="store-product-info">
                        <div className="store-product-meta-row">
                          <div className="product-rating">
                            <span>★</span>
                            <span>{meta.rating}</span>
                            <span className="rating-reviews">({meta.reviewCount})</span>
                          </div>
                          <span className="stock-pill">● In Stock</span>
                        </div>

                        <div className="store-product-name" title={p.name}>{p.name}</div>

                        {p.note && (
                          <div className="store-product-snippet" title={p.note}>{p.note}</div>
                        )}

                        <div className="store-product-price-row">
                          <div className="store-product-price">₹{Number(p.price).toLocaleString('en-IN')}</div>
                          <div className="store-product-mrp">₹{meta.mrp.toLocaleString('en-IN')}</div>
                          <div className="store-product-discount">{meta.discountPercent}% OFF</div>
                        </div>

                        <div className="store-product-actions">
                          <button className="add-to-cart-btn" onClick={() => {
                            setCart(prev => [...prev, { ...p, selected: true }]);
                            setToastMsg(`Added ${p.name} to cart!`);
                            setTimeout(() => setToastMsg(null), 2500);
                          }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                            Add to Cart
                          </button>
                          <button 
                            onClick={() => toggleWishlist(p)}
                            className="store-wishlist-btn"
                            style={{ 
                              background: wishlist.includes(p.id) ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)', 
                              border: wishlist.includes(p.id) ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)', 
                              color: wishlist.includes(p.id) ? '#ef4444' : '#94a3b8'
                            }}
                            title={wishlist.includes(p.id) ? "Remove from wishlist" : "Add to wishlist"}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill={wishlist.includes(p.id) ? "#ef4444" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        );
      })()}

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

      {/* Cart Drawer */}
      <div className={`cart-drawer-overlay ${isCartOpen ? 'open' : ''}`} onClick={() => setIsCartOpen(false)}></div>
      <div className={`cart-drawer ${isCartOpen ? 'open' : ''}`}>
        <div className="cart-drawer-header">
          <h2>Your Cart</h2>
          <button className="close-cart-btn" onClick={() => setIsCartOpen(false)}>✕</button>
        </div>
        
        <div className="cart-drawer-body">
          {cart.length === 0 ? (
            <div className="empty-cart">
              <p>Your cart is empty.</p>
            </div>
          ) : (
            <div className="cart-items-list">
              {cart.map((item, idx) => (
                <div className="cart-item" key={idx} style={{ opacity: item.selected === false ? 0.6 : 1 }}>
                  <input 
                    type="checkbox" 
                    checked={item.selected !== false} 
                    onChange={(e) => {
                      setCart(prev => prev.map((c, i) => i === idx ? { ...c, selected: e.target.checked } : c));
                    }}
                    style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                  />
                  <div className="cart-item-img">
                    {item.image_url ? <img src={item.image_url} alt={item.name} /> : iconFor(item.name)}
                  </div>
                  <div className="cart-item-info">
                    <div className="cart-item-name" style={{ textDecoration: item.selected === false ? 'line-through' : 'none' }}>{item.name}</div>
                    <div className="cart-item-price">₹{Number(item.price).toLocaleString('en-IN')}</div>
                  </div>
                  <button className="cart-item-remove" onClick={() => {
                    setCart(prev => prev.filter((_, i) => i !== idx));
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="cart-drawer-footer">
            <div className="cart-total">
              <span>Total:</span>
              <span>₹{cart.filter(i => i.selected !== false).reduce((sum, item) => sum + Number(item.price), 0).toLocaleString('en-IN')}</span>
            </div>
            <button 
              className="checkout-ai-btn" 
              disabled={cart.filter(i => i.selected !== false).length === 0}
              style={{ opacity: cart.filter(i => i.selected !== false).length === 0 ? 0.5 : 1 }}
              onClick={() => {
                const selectedItems = cart.filter(i => i.selected !== false);
                if (selectedItems.length === 0) return;
                
                const items = selectedItems.map(item => item.name).join(', ');
                const textToSend = `I have ${selectedItems.length} items selected in my cart: ${items}. I am ready to checkout.`;
                
                setIsCartOpen(false);
                setIsChatOpen(true);
                handleSendText(textToSend);
              }}
            >
              Checkout with AI Agent
            </button>
          </div>
        )}
      </div>

      <div className={`cart-drawer-overlay ${isWishlistOpen ? 'open' : ''}`} onClick={() => setIsWishlistOpen(false)}></div>
      <div className={`cart-drawer ${isWishlistOpen ? 'open' : ''}`}>
        <div className="cart-drawer-header">
          <h2>Your Wishlist</h2>
          <button className="close-cart-btn" onClick={() => setIsWishlistOpen(false)}>✕</button>
        </div>
        <div className="cart-drawer-body">
          {wishlist.length === 0 ? (
            <div className="empty-cart">
              <p>Your wishlist is empty.</p>
            </div>
          ) : (
            <div className="cart-items-list">
              {(config?.catalog?.filter(p => wishlist.includes(p.id)) || []).map((item, idx) => (
                <div className="cart-item" key={idx}>
                  <div className="cart-item-img">
                    {item.image_url ? <img src={item.image_url} alt={item.name} /> : iconFor(item.name)}
                  </div>
                  <div className="cart-item-info">
                    <div className="cart-item-name">{item.name}</div>
                    <div className="cart-item-price">₹{Number(item.price).toLocaleString('en-IN')}</div>
                    <button 
                      className="add-to-cart-btn" 
                      style={{ padding: '6px 12px', fontSize: '12px', marginTop: '6px', width: 'fit-content' }}
                      onClick={() => {
                        setCart(prev => [...prev, { ...item, selected: true }]);
                        setToastMsg(`Added ${item.name} to cart!`);
                        setIsWishlistOpen(false);
                        setTimeout(() => setToastMsg(null), 2500);
                      }}>
                      Move to Cart
                    </button>
                  </div>
                  <button className="cart-item-remove" onClick={() => toggleWishlist(item)} title="Remove">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="chat-widget-container">
        {isChatOpen && (
          <div className="floating-chat-window">
            <div className="chat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '50%', boxShadow: '0 0 10px #10b981' }}></div>
                <div style={{ color: 'var(--ivory)', fontWeight: 800, fontSize: '16px', letterSpacing: '0.02em' }}>Shopping Assistant</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {walletBalance > 0 && (
                  <div style={{ padding: '4px 10px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '20px', color: '#10b981', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    💰 ₹{walletBalance}
                  </div>
                )}
                <button 
                  onClick={handleClearChat} 
                  title="Clear Chat History"
                  style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--hot)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
                <button className="close-chat" onClick={() => setIsChatOpen(false)}>×</button>
              </div>
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
                        {m.walletDiscount > 0 && (
                          <div className="receipt-row" style={{ color: '#10b981', fontWeight: 600 }}><span>Wallet Discount</span><span className="receipt-val">-₹{m.walletDiscount}</span></div>
                        )}
                      </div>
                      <div className="receipt-total"><span>Total</span><span>₹{m.amount || '0'}</span></div>
                      
                      {m.referralCode && (
                        <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                          <div style={{ fontWeight: 600, color: '#10b981', marginBottom: '8px', fontSize: '13px' }}>🎁 Refer & Earn — Share your link:</div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input type="text" readOnly value={`${window.location.origin}/store?shop=${shopParam}&ref=${m.referralCode}`} style={{ flex: 1, padding: '8px', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '4px', color: 'var(--ivory)', fontSize: '12px' }} />
                            <button onClick={(e) => { navigator.clipboard.writeText(`${window.location.origin}/store?shop=${shopParam}&ref=${m.referralCode}`); e.target.innerText = 'Copied!'; setTimeout(() => e.target.innerText = 'Copy', 2000); }} style={{ padding: '8px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Copy</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
                const displayText = (m.text || '').replace(/\\n/g, '\n').replace(/\|\s*\n\s*\|/g, '|\n|');
                const isLast = i === messages.length - 1;
                return (
                  <div key={i} className={`bubble ${m.who}`}>
                    {m.retention && (
                      <div style={{ fontSize: '11px', color: '#38bdf8', marginBottom: '6px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', padding: '2px 8px', borderRadius: '4px' }}>
                        <span>📲</span> WhatsApp / SMS Follow-up
                      </div>
                    )}
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayText}</ReactMarkdown>
                    {m.crossSellProduct && m.who === 'agent' && isLast && (
                      <button
                        className="cross-sell-chip"
                        onClick={() => {
                          setMessages(prev => {
                            const updated = [...prev];
                            updated[i] = { ...updated[i], crossSellProduct: null };
                            return updated;
                          });
                          handleSendText(`Yes, add ${m.crossSellProduct} too`);
                        }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          marginTop: '10px', padding: '8px 16px',
                          background: 'rgba(234, 179, 8, 0.15)',
                          border: '1px solid rgba(234, 179, 8, 0.4)',
                          borderRadius: '20px', cursor: 'pointer',
                          color: '#eab308', fontSize: '13px', fontWeight: 600,
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(234, 179, 8, 0.25)'; e.currentTarget.style.transform = 'scale(1.03)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(234, 179, 8, 0.15)'; e.currentTarget.style.transform = 'scale(1)'; }}
                      >
                        + Add {m.crossSellProduct}?
                      </button>
                    )}
                    {m.requiresDetails && isLast && (
                      <div className="order-details-form">
                        <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>Please provide order details</div>
                        <input type="text" id={`form-name-${i}`} placeholder="Full Name" className="form-input" />
                        <input type="text" id={`form-city-${i}`} placeholder="City" className="form-input" />
                        <input type="text" id={`form-phone-${i}`} placeholder="Phone Number" className="form-input" />
                        <textarea id={`form-address-${i}`} placeholder="Delivery Address" className="form-input" style={{ resize: 'vertical', minHeight: '60px' }}></textarea>
                        
                        <div style={{ marginTop: '12px', marginBottom: '16px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--ivory)', marginBottom: '10px' }}>Stay Updated? (Optional)</div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--muted)', marginBottom: '8px', cursor: 'pointer' }}>
                            <input type="checkbox" id={`form-consent-whatsapp-${i}`} defaultChecked={true} style={{ cursor: 'pointer', accentColor: '#10b981' }} />
                            Receive order updates & offers via WhatsApp
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--muted)', cursor: 'pointer' }}>
                            <input type="checkbox" id={`form-consent-email-${i}`} defaultChecked={true} style={{ cursor: 'pointer', accentColor: '#10b981' }} />
                            Receive offers via Email
                          </label>
                        </div>

                        <button className="form-submit-btn" onClick={() => {
                          const name = document.getElementById(`form-name-${i}`).value;
                          const city = document.getElementById(`form-city-${i}`).value;
                          const phone = document.getElementById(`form-phone-${i}`).value;
                          const address = document.getElementById(`form-address-${i}`).value;
                          if (!name || !city || !phone || !address) { alert("Name, City, Phone, and Address are required to proceed."); return; }

                          const consentWa = document.getElementById(`form-consent-whatsapp-${i}`).checked ? 'Yes' : 'No';
                          const consentEm = document.getElementById(`form-consent-email-${i}`).checked ? 'Yes' : 'No';

                          // Hide the form by modifying this message in state
                          setMessages(prev => {
                            const updated = [...prev];
                            updated[i].requiresDetails = false;
                            return updated;
                          });

                          let userMsg = `My name is ${name} and I am from ${city}. Phone number is ${phone}. Delivery address: ${address}.`;
                          if (consentWa === 'Yes') userMsg += ` I consent to WhatsApp updates.`;
                          if (consentEm === 'Yes') userMsg += ` I consent to Email updates.`;
                          handleSendText(userMsg);
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
                  onFocus={scrollToBottom}
                  placeholder={isListening ? "🔴 Listening... speak now" : "Ask a question..."}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !isTyping) handleSend() }}
                  disabled={isTyping}
                  autoFocus
                />
                <button 
                  className={`mic-btn ${isListening ? 'listening' : ''}`}
                  onClick={startListening} 
                  disabled={isTyping}
                  title="Speak"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="23"></line>
                    <line x1="8" y1="23" x2="16" y2="23"></line>
                  </svg>
                </button>
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
