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
  const [customerId, setCustomerId] = useState('');
  const [mounted, setMounted] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [shopParam, setShopParam] = useState(null);
  const [refParam, setRefParam] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [cart, setCart] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [toastMsg, setToastMsg] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [accountTab, setAccountTab] = useState('wallet');
  const [accountData, setAccountData] = useState(null);
  const [isAccountLoading, setIsAccountLoading] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', delivery_address: '' });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUpdatingConsent, setIsUpdatingConsent] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const isSendingRef = useRef(false);
  const [showVipModal, setShowVipModal] = useState(false);
  const [vipForm, setVipForm] = useState({
    name: '',
    phone: '',
    city: '',
    consent_whatsapp: true
  });
  const [isOnboardingSubmitting, setIsOnboardingSubmitting] = useState(false);

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

  const fetchAccountData = async (cidOverride) => {
    const targetCid = cidOverride || customerId;
    if (!shopParam || !targetCid) return;
    try {
      setIsAccountLoading(true);
      const res = await fetch(`${API_BASE}/api/store/me?shop=${shopParam}&customerId=${targetCid}`);
      if (res.ok) {
        const data = await res.json();
        setAccountData(data);
        if (data.wallet?.balance !== undefined) {
          setWalletBalance(data.wallet.balance);
        }
        if (data.profile) {
          setProfileForm({
            name: data.profile.name || '',
            phone: data.profile.phone || '',
            delivery_address: data.profile.delivery_address || ''
          });
          if (data.profile.name && typeof window !== 'undefined') {
            localStorage.setItem(`ai_store_onboarded_${shopParam}`, 'true');
            localStorage.setItem('ai_customer_name', data.profile.name);
            if (data.profile.phone) localStorage.setItem('ai_customer_phone', data.profile.phone);
            if (data.profile.city) localStorage.setItem('ai_customer_city', data.profile.city);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load account data", err);
    } finally {
      setIsAccountLoading(false);
    }
  };

  useEffect(() => {
    if (isAccountOpen) {
      fetchAccountData();
    }
  }, [isAccountOpen]);

  useEffect(() => {
    if (shopParam && customerId) {
      fetchAccountData();
    }
  }, [shopParam, customerId]);

  useEffect(() => {
    if (shopParam && typeof window !== 'undefined') {
      const isAlreadyOnboarded = localStorage.getItem(`ai_store_onboarded_${shopParam}`);
      const savedName = localStorage.getItem('ai_customer_name') || '';
      const savedPhone = localStorage.getItem('ai_customer_phone') || '';
      const savedCity = localStorage.getItem('ai_customer_city') || '';
      if (savedName || savedPhone || savedCity) {
        setVipForm(p => ({
          ...p,
          name: p.name || savedName,
          phone: p.phone || savedPhone,
          city: p.city || savedCity
        }));
      }
      if (!isAlreadyOnboarded && !accountData?.profile?.name) {
        const timer = setTimeout(() => {
          setShowVipModal(true);
        }, 600);
        return () => clearTimeout(timer);
      }
    }
  }, [shopParam, accountData?.profile?.name]);

  const handleVipOnboard = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!vipForm.name || !vipForm.name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    const cleanPhone = (vipForm.phone || '').trim().replace(/^\+91/, '');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      toast.error("Please enter a valid 10-digit Indian phone number");
      return;
    }

    // Direct switch for known demo profiles
    if (cleanPhone === '8898547456' || vipForm.name.trim() === 'Radhe') {
      const radheId = 'demo-customer-1791961381312';
      setCustomerId(radheId);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ai_store_customer_id', radheId);
        localStorage.setItem(`ai_store_onboarded_${shopParam}`, 'true');
        localStorage.setItem('ai_customer_name', 'Radhe');
      }
      setShowVipModal(false);
      await fetchAccountData(radheId);
      toast.success("Welcome back Radhe! VIP session restored.");
      return;
    }

    if (cleanPhone === '8875412545' || vipForm.name.trim() === 'Shyam') {
      const shyamId = 'demo-customer-1791959899392';
      setCustomerId(shyamId);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ai_store_customer_id', shyamId);
        localStorage.setItem(`ai_store_onboarded_${shopParam}`, 'true');
        localStorage.setItem('ai_customer_name', 'Shyam');
      }
      setShowVipModal(false);
      await fetchAccountData(shyamId);
      toast.success("Welcome back Shyam! Warm session restored.");
      return;
    }

    // Ensure non-demo ID for new onboarding to prevent 403 demo-edit restrictions
    let activeCid = customerId;
    if (!activeCid || /^demo-customer-\d+$/.test(activeCid)) {
      activeCid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : ("cust-" + Date.now());
      setCustomerId(activeCid);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ai_store_customer_id', activeCid);
      }
    }

    try {
      setIsOnboardingSubmitting(true);
      const res = await fetch(`${API_BASE}/api/store/onboard?shop=${shopParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: activeCid,
          name: vipForm.name.trim(),
          phone: cleanPhone,
          city: vipForm.city?.trim() || '',
          delivery_address: vipForm.city?.trim() || '',
          consent_whatsapp: vipForm.consent_whatsapp
        })
      });
      const data = await res.json();
      if (res.ok) {
        const bonusMsg = data.welcome_bonus_awarded && data.welcome_bonus_amount > 0
          ? `🎉 Welcome ${vipForm.name}! ₹${Math.round(data.welcome_bonus_amount)} added to your wallet!`
          : `🎉 Welcome ${vipForm.name}! Your account is ready!`;
        toast.success(bonusMsg, { duration: 4000 });
        if (typeof window !== 'undefined') {
          localStorage.setItem(`ai_store_onboarded_${shopParam}`, 'true');
          localStorage.setItem('ai_customer_name', vipForm.name.trim());
          localStorage.setItem('ai_customer_phone', cleanPhone);
          if (vipForm.city) localStorage.setItem('ai_customer_city', vipForm.city.trim());
        }
        setShowVipModal(false);
        if (data.customer) {
          setWalletBalance(data.customer.wallet_balance || 0);
        }
        await fetchAccountData(activeCid);

        // Personalize AI greeting
        const bonusGranted = data.welcome_bonus_awarded && data.welcome_bonus_amount > 0;
        const greetingBalanceText = bonusGranted
          ? ` Your ₹${Math.round(data.welcome_bonus_amount)} welcome shopping balance is ready in your wallet.`
          : '';
        setMessages([
          {
            text: `Namaste ${vipForm.name.trim()} ji! Welcome to ${config?.brandName || 'our store'} 👋${greetingBalanceText} How can I help you today?`,
            who: 'agent',
            isGreeting: true
          }
        ]);
      } else {
        toast.error(data.detail || "Failed to activate VIP Pass");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to connect to store. Please try again.");
    } finally {
      setIsOnboardingSubmitting(false);
    }
  };

  const handleFillDemo = (type) => {
    if (type === 'radhe') {
      const radheId = 'demo-customer-1791961381312';
      setCustomerId(radheId);
      if (typeof window !== 'undefined') localStorage.setItem('ai_store_customer_id', radheId);
      setVipForm(p => ({
        ...p,
        name: 'Radhe',
        phone: '8898547456',
        city: 'Ahmedabad',
        consent_whatsapp: true
      }));
    } else if (type === 'shyam') {
      const shyamId = 'demo-customer-1791959899392';
      setCustomerId(shyamId);
      if (typeof window !== 'undefined') localStorage.setItem('ai_store_customer_id', shyamId);
      setVipForm(p => ({
        ...p,
        name: 'Shyam',
        phone: '8875412545',
        city: 'Surat',
        consent_whatsapp: true
      }));
    } else if (type === 'new') {
      const freshId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : ("cust-" + Date.now());
      setCustomerId(freshId);
      if (typeof window !== 'undefined') localStorage.setItem('ai_store_customer_id', freshId);
      setVipForm(p => ({
        ...p,
        name: 'Aarav Sharma',
        phone: '9876543210',
        city: 'Mumbai',
        consent_whatsapp: true
      }));
    }
  };

  const handleSwitchDemoAccount = (extId) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai_store_customer_id', extId);
    }
    setCustomerId(extId);
    toast.success("Switched account session!");
  };

  const handleStartFreshAccount = () => {
    const freshId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : ("cust-" + Date.now());
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai_store_customer_id', freshId);
      localStorage.removeItem(`ai_store_onboarded_${shopParam}`);
    }
    setCustomerId(freshId);
    setAccountData(null);
    setWalletBalance(0);
    setProfileForm({ name: '', phone: '', delivery_address: '' });
    setVipForm({ name: '', phone: '', city: '', consent_whatsapp: true });
    setIsAccountOpen(false);
    setShowVipModal(true);
  };

  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    if (!shopParam || !customerId) return;
    if (accountData?.profile?.is_legacy) {
      toast.error("Editing is disabled for demo accounts");
      return;
    }
    
    if (profileForm.phone && profileForm.phone.trim()) {
      const cleanPhone = profileForm.phone.trim();
      if (!/^(\+91)?[6-9]\d{9}$/.test(cleanPhone)) {
        toast.error("Please enter a valid 10-digit Indian phone number");
        return;
      }
    }

    try {
      setIsSavingProfile(true);
      const res = await fetch(`${API_BASE}/api/store/me/profile?shop=${shopParam}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          name: profileForm.name,
          phone: profileForm.phone,
          delivery_address: profileForm.delivery_address
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Profile updated successfully!");
        fetchAccountData();
      } else {
        toast.error(data.detail || "Failed to update profile");
      }
    } catch (err) {
      toast.error("Network error updating profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleToggleConsent = async () => {
    if (!shopParam || !customerId || isUpdatingConsent) return;
    const currentConsent = accountData?.profile?.consent_whatsapp && !accountData?.profile?.opted_out;
    const newConsent = !currentConsent;
    
    try {
      setIsUpdatingConsent(true);
      const res = await fetch(`${API_BASE}/api/store/me/consent?shop=${shopParam}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          promotional_messages: newConsent
        })
      });
      if (res.ok) {
        toast.success(newConsent ? "Subscribed to WhatsApp updates!" : "Unsubscribed from promotional messages");
        fetchAccountData();
      } else {
        toast.error("Failed to update preferences");
      }
    } catch (err) {
      toast.error("Network error updating preferences");
    } finally {
      setIsUpdatingConsent(false);
    }
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
    setMounted(true);
    if (typeof window !== 'undefined') {
      let stored = localStorage.getItem('ai_store_customer_id');
      if (!stored) {
        stored = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : ("cust-" + Date.now());
        localStorage.setItem('ai_store_customer_id', stored);
      }
      setCustomerId(stored);
    }

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
          if (data.order_ready || data.walletBalance !== undefined) {
            fetchAccountData();
          }
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
    const newId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : ("cust-" + Date.now());
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
      <nav className="navbar" suppressHydrationWarning>
        <div className="nav-spacer" suppressHydrationWarning></div>
        <div className="nav-brand" style={{ textAlign: 'center' }} suppressHydrationWarning>
          {mounted ? (config?.brandName || 'Store') : 'Store'}
        </div>
        <div className="nav-actions" suppressHydrationWarning>
          <button 
            className="nav-account-btn"
            onClick={() => { setIsAccountOpen(true); setIsCartOpen(false); setIsWishlistOpen(false); }}
            title="My Account"
            suppressHydrationWarning
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <span className="nav-account-label" suppressHydrationWarning>
              {mounted && accountData?.profile?.name ? accountData.profile.name.split(' ')[0] : 'Account'}
            </span>
            {mounted && walletBalance > 0 && (
              <span className="nav-wallet-pill" suppressHydrationWarning>
                ₹{walletBalance}
              </span>
            )}
          </button>
          <button 
            className="nav-cart-btn"
            onClick={() => { setIsWishlistOpen(true); setIsAccountOpen(false); setIsCartOpen(false); }}
            title="Wishlist"
            style={{ position: 'relative' }}
            suppressHydrationWarning
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill={mounted && wishlist.length > 0 ? "#ef4444" : "none"} stroke={mounted && wishlist.length > 0 ? "#ef4444" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            {mounted && wishlist.length > 0 && <span className="cart-badge">{wishlist.length}</span>}
          </button>
          <button 
            className="nav-cart-btn"
            onClick={() => { setIsCartOpen(true); setIsAccountOpen(false); setIsWishlistOpen(false); }}
            style={{ position: 'relative' }}
            suppressHydrationWarning
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
            {mounted && cart.length > 0 && <span className="cart-badge">{cart.length}</span>}
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

      {/* VIP Member Pass Onboarding Modal */}
      {showVipModal && (
        <div className="vip-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowVipModal(false); }}>
          <div className="vip-modal-card">
            <div className="vip-card-glow"></div>
            
            {(() => {
              const welcomeBonus = Number(config?.welcome_bonus_amount ?? 100);
              return (
                <>
                  <div className="vip-badge-pill">
                    <span>{welcomeBonus > 0 ? "🎁" : "✨"}</span> {welcomeBonus > 0 ? "SPECIAL WELCOME GIFT" : "VIP MEMBER PASS"}
                  </div>

                  <div className="vip-modal-header">
                    <h2>{welcomeBonus > 0 ? `Claim Your ₹${welcomeBonus} Shopping Pass` : "Create Your Member Account"}</h2>
                    <p>
                      {welcomeBonus > 0 
                        ? `Enter your details to instantly activate your ₹${welcomeBonus} wallet credit & personal AI assistant for ${config?.brandName || 'our Store'}.`
                        : `Enter your details to activate your member profile & personal AI assistant for ${config?.brandName || 'our Store'}.`
                      }
                    </p>
                  </div>

                  <form onSubmit={handleVipOnboard}>
                    <div className="vip-form-group">
                      <label className="vip-form-label">Full Name *</label>
                      <div className="vip-input-wrap">
                        <span className="vip-input-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        </span>
                        <input 
                          type="text" 
                          className="vip-input" 
                          placeholder="Radhe Sharma" 
                          value={vipForm.name}
                          onChange={(e) => setVipForm(p => ({ ...p, name: e.target.value }))}
                          maxLength={80}
                          required
                        />
                      </div>
                    </div>

                    <div className="vip-form-group">
                      <label className="vip-form-label">WhatsApp Mobile Number *</label>
                      <div className="vip-input-wrap">
                        <span className="vip-input-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                        </span>
                        <span className="vip-phone-prefix">+91</span>
                        <input 
                          type="tel" 
                          className="vip-input vip-input-phone" 
                          placeholder="98765 43210" 
                          value={vipForm.phone}
                          onChange={(e) => setVipForm(p => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                          maxLength={10}
                          required
                        />
                      </div>
                    </div>

                    <div className="vip-form-group">
                      <label className="vip-form-label">City / Delivery Town <span style={{ fontWeight: 400, color: '#8b949e', fontSize: '12px' }}>(Optional)</span></label>
                      <div className="vip-input-wrap">
                        <span className="vip-input-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        </span>
                        <input 
                          type="text" 
                          className="vip-input" 
                          placeholder="Ahmedabad, Mumbai, Surat" 
                          value={vipForm.city}
                          onChange={(e) => setVipForm(p => ({ ...p, city: e.target.value }))}
                          maxLength={80}
                        />
                      </div>
                    </div>

                    <label className="vip-consent-check">
                      <input 
                        type="checkbox" 
                        checked={vipForm.consent_whatsapp}
                        onChange={(e) => setVipForm(p => ({ ...p, consent_whatsapp: e.target.checked }))}
                      />
                      <span className="vip-consent-text">
                        {welcomeBonus > 0
                          ? `Send order tracking, delivery updates, and ₹${welcomeBonus} wallet notifications via WhatsApp.`
                          : `Send order tracking, delivery updates, and member notifications via WhatsApp.`
                        }
                      </span>
                    </label>

                    <div className="vip-actions">
                      <button 
                        type="submit" 
                        className="vip-claim-btn"
                        onClick={handleVipOnboard}
                        disabled={isOnboardingSubmitting}
                      >
                        {isOnboardingSubmitting ? (
                          <>Activating Profile...</>
                        ) : (
                          <>{welcomeBonus > 0 ? `Get ₹${welcomeBonus} Off` : "Activate Account"}</>
                        )}
                      </button>
                      <button 
                        type="button" 
                        className="vip-skip-btn"
                        onClick={() => setShowVipModal(false)}
                      >
                        Skip for now & browse store
                      </button>
                    </div>
                  </form>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Customer Hub: My Account Drawer */}
      <div 
        className={`account-drawer-overlay ${isAccountOpen ? 'open' : ''}`} 
        onClick={() => setIsAccountOpen(false)}
      ></div>
      <div className={`account-drawer ${isAccountOpen ? 'open' : ''}`}>
        <div className="account-drawer-header">
          <h2 className="account-drawer-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            My Account
          </h2>
          <button className="account-close-btn" onClick={() => setIsAccountOpen(false)} title="Close">✕</button>
        </div>

        {/* 3 Tabs */}
        <div className="account-tabs">
          <button 
            className={`account-tab-btn ${accountTab === 'wallet' ? 'active' : ''}`}
            onClick={() => setAccountTab('wallet')}
          >
            💰 Wallet & Referrals
          </button>
          <button 
            className={`account-tab-btn ${accountTab === 'orders' ? 'active' : ''}`}
            onClick={() => setAccountTab('orders')}
          >
            📦 My Orders {accountData?.orders?.length > 0 && `(${accountData.orders.length})`}
          </button>
          <button 
            className={`account-tab-btn ${accountTab === 'profile' ? 'active' : ''}`}
            onClick={() => setAccountTab('profile')}
          >
            👤 Profile
          </button>
        </div>

        <div className="account-drawer-body">
          {isAccountLoading && !accountData ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
              Loading your account details...
            </div>
          ) : (
            <>
              {/* TAB 1: WALLET & REFERRALS */}
              {accountTab === 'wallet' && (
                <>
                  {/* Unclaimed Welcome Pass Reminder (Only inside Account Drawer) */}
                  {(!accountData?.profile?.name || Number(accountData?.wallet?.balance || walletBalance || 0) === 0) && (
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(5, 150, 105, 0.05))',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '14px',
                      padding: '14px 16px',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>🎁</span> ₹100 Welcome Pass Unclaimed
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
                          Complete your profile details to unlock ₹100 welcome shopping credits.
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => { setIsAccountOpen(false); setShowVipModal(true); }}
                        style={{
                          background: 'linear-gradient(135deg, #10b981, #059669)',
                          color: '#ffffff',
                          border: 'none',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
                        }}
                      >
                        Claim ₹100 ⚡
                      </button>
                    </div>
                  )}

                  {/* Wallet Balance Hero Card */}
                  <div className="account-wallet-hero">
                    <div className="account-wallet-label">Available Wallet Credits</div>
                    <div className="account-wallet-amount">
                      ₹{Number(accountData?.wallet?.balance || walletBalance || 0).toLocaleString('en-IN')}
                    </div>
                    <div className="account-wallet-hint">
                      ✓ Instant discount applied automatically on your checkout orders.
                    </div>
                  </div>

                  {/* Referral Code & Sharing Card */}
                  <div className="account-card-box">
                    <div className="account-box-title">
                      <span>Refer Friends & Earn ₹100</span>
                      <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>Get ₹100 per friend</span>
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '10px' }}>
                      Share your personal referral link or code. When your friend places their first order, both of you get ₹100 wallet credits!
                    </div>

                    <div className="account-code-row">
                      <div className="account-code-pill">
                        {accountData?.referral?.code || 'Generating...'}
                      </div>
                      <button 
                        className="account-btn-sm"
                        onClick={() => {
                          if (accountData?.referral?.code) {
                            navigator.clipboard.writeText(accountData.referral.code);
                            setCopiedCode(true);
                            toast.success("Referral code copied!");
                            setTimeout(() => setCopiedCode(false), 2000);
                          }
                        }}
                      >
                        {copiedCode ? "Copied! ✓" : "Copy Code"}
                      </button>
                      <button 
                        className="account-btn-sm"
                        onClick={() => {
                          if (accountData?.referral?.share_url) {
                            navigator.clipboard.writeText(accountData.referral.share_url);
                            setCopiedLink(true);
                            toast.success("Store link copied!");
                            setTimeout(() => setCopiedLink(false), 2000);
                          }
                        }}
                      >
                        {copiedLink ? "Link Copied! ✓" : "Copy Link"}
                      </button>
                    </div>

                    {/* WhatsApp Direct Share Link */}
                    {accountData?.referral?.share_url && (
                      <a 
                        className="account-share-wa-btn"
                        href={`https://wa.me/?text=${encodeURIComponent(`Hey! Check out ${config?.brandName || 'this store'} and get ₹100 off using my referral link: ${accountData.referral.share_url}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.669-.699c.969.54 1.838.835 2.791.835 3.18 0 5.767-2.586 5.768-5.766 0-3.18-2.587-5.767-5.768-5.767zm9.969 5.768c0 5.509-4.491 10-10 10-1.782 0-3.454-.474-4.896-1.306l-6.104 1.6 1.637-5.975c-.943-1.488-1.493-3.242-1.493-5.119 0-5.509 4.491-10 10-10 5.509 0 10 4.491 10 10z"/>
                        </svg>
                        Share with Friends on WhatsApp
                      </a>
                    )}

                    {/* Referral Metrics */}
                    <div className="account-stats-row">
                      <div className="account-stat-cell">
                        <div className="account-stat-num">{accountData?.referral?.friends_invited || 0}</div>
                        <div className="account-stat-label">Friends Invited</div>
                      </div>
                      <div className="account-stat-cell">
                        <div className="account-stat-num">{accountData?.referral?.friends_converted || 0}</div>
                        <div className="account-stat-label">Orders Placed</div>
                      </div>
                      <div className="account-stat-cell">
                        <div className="account-stat-num">₹{accountData?.referral?.total_earned || 0}</div>
                        <div className="account-stat-label">Total Earned</div>
                      </div>
                    </div>

                    {/* Invites List */}
                    <div style={{ marginTop: '14px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#c9d1d9', marginBottom: '8px' }}>
                        Invite Status
                      </div>
                      {!accountData?.referral?.invites || accountData.referral.invites.length === 0 ? (
                        <div className="account-empty-state" style={{ padding: '16px' }}>
                          No friends invited yet. Share your link to start earning rewards!
                        </div>
                      ) : (
                        <div className="account-list">
                          {accountData.referral.invites.map((inv, idx) => (
                            <div key={idx} className="account-list-item">
                              <div>
                                <div style={{ fontWeight: 600, color: '#f0f6fc' }}>{inv.name}</div>
                                <div style={{ fontSize: '11px', color: '#8b949e' }}>{inv.date}</div>
                              </div>
                              <div>
                                {inv.status === 'earned' ? (
                                  <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                                    +₹{inv.reward} Earned
                                  </span>
                                ) : (
                                  <span style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#fbbf24', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}>
                                    Pending Order
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Wallet Activity Ledger */}
                  <div className="account-card-box">
                    <div className="account-box-title">
                      <span>Wallet Activity Ledger</span>
                    </div>
                    {!accountData?.wallet?.ledger || accountData.wallet.ledger.length === 0 ? (
                      <div className="account-empty-state">
                        No wallet activity yet. Place an order or refer a friend to get started!
                      </div>
                    ) : (
                      <div className="account-list">
                        {accountData.wallet.ledger.map((tx, idx) => {
                          const isCredit = Number(tx.amount) > 0;
                          return (
                            <div key={idx} className="account-list-item">
                              <div>
                                <div style={{ fontWeight: 600, color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>{tx.kind === 'referral_reward' ? '🎁 Referral Reward' : (tx.kind === 'order_discount' ? '🛒 Order Discount' : '💳 Adjustment')}</span>
                                </div>
                                <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '2px' }}>
                                  {tx.note || (isCredit ? 'Credit added' : 'Debit applied')} • {tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 800, fontSize: '14px', color: isCredit ? '#34d399' : '#f87171' }}>
                                  {isCredit ? `+₹${tx.amount}` : `-₹${Math.abs(tx.amount)}`}
                                </div>
                                <div style={{ fontSize: '10px', color: '#8b949e' }}>
                                  Bal: ₹{tx.balance_after}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* TAB 2: MY ORDERS */}
              {accountTab === 'orders' && (
                <div className="account-card-box">
                  <div className="account-box-title">
                    <span>Order History</span>
                  </div>

                  {!accountData?.orders || accountData.orders.length === 0 ? (
                    <div className="account-empty-state">
                      <div style={{ fontSize: '28px', marginBottom: '8px' }}>🛍️</div>
                      No orders placed yet.<br/>Chat with our AI Shopping Assistant to find genuine products and checkout seamlessly!
                    </div>
                  ) : (
                    <div className="account-list">
                      {accountData.orders.map((od, idx) => (
                        <div key={idx} className="account-list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, color: '#f0f6fc', fontSize: '14px' }}>
                              {od.product_name}
                            </span>
                            <span style={{ 
                              fontSize: '11px', 
                              fontWeight: 700, 
                              padding: '3px 8px', 
                              borderRadius: '6px',
                              background: od.status === 'Confirmed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                              color: od.status === 'Confirmed' ? '#34d399' : '#fbbf24'
                            }}>
                              {od.status}
                            </span>
                          </div>
                          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#8b949e' }}>
                            <span>Order #{od.id} • {od.date}</span>
                            <span style={{ fontWeight: 800, color: '#f0f6fc', fontSize: '14px' }}>
                              ₹{Number(od.amount).toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: PROFILE */}
              {accountTab === 'profile' && (
                <div className="account-card-box">
                  <div className="account-box-title">
                    <span>Profile & Preferences</span>
                  </div>

                  {accountData?.profile?.is_legacy && (
                    <div style={{ 
                      padding: '10px 12px', 
                      background: 'rgba(234, 179, 8, 0.1)', 
                      border: '1px solid rgba(234, 179, 8, 0.25)', 
                      borderRadius: '8px', 
                      color: '#fbbf24', 
                      fontSize: '12px', 
                      marginBottom: '16px',
                      lineHeight: 1.4
                    }}>
                      ℹ️ <strong>Demo Session:</strong> Profile editing is restricted for demo IDs to protect shared data. Place an order or start a new chat to register a full personal profile.
                    </div>
                  )}

                  <form onSubmit={handleSaveProfile}>
                    <div className="account-form-group">
                      <label className="account-form-label">Full Name</label>
                      <input 
                        type="text"
                        className="account-form-input"
                        placeholder="Your name"
                        disabled={accountData?.profile?.is_legacy || isSavingProfile}
                        value={profileForm.name}
                        onChange={(e) => setProfileForm(p => ({ ...p, name: e.target.value }))}
                        maxLength={80}
                      />
                    </div>

                    <div className="account-form-group">
                      <label className="account-form-label">Phone Number</label>
                      <input 
                        type="text"
                        className="account-form-input"
                        placeholder="10-digit phone number"
                        disabled={accountData?.profile?.is_legacy || isSavingProfile}
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                      />
                      {accountData?.profile?.is_legacy && (
                        <span style={{ fontSize: '11px', color: '#8b949e' }}>Phone number masked for privacy</span>
                      )}
                    </div>

                    <div className="account-form-group">
                      <label className="account-form-label">Delivery Address</label>
                      <textarea 
                        className="account-form-input"
                        rows="3"
                        placeholder="House / Flat No., Street, City, State, PIN"
                        disabled={accountData?.profile?.is_legacy || isSavingProfile}
                        value={profileForm.delivery_address}
                        onChange={(e) => setProfileForm(p => ({ ...p, delivery_address: e.target.value }))}
                        maxLength={300}
                        style={{ resize: 'vertical' }}
                      />
                    </div>

                    {!accountData?.profile?.is_legacy && (
                      <button 
                        type="submit" 
                        className="account-save-btn"
                        disabled={isSavingProfile}
                      >
                        {isSavingProfile ? "Saving Profile..." : "Save Profile Details"}
                      </button>
                    )}
                  </form>

                  {/* Promotional Consent Toggle */}
                  <div className="account-toggle-card">
                    <div className="account-toggle-info">
                      <div className="account-toggle-title">Receive Offers & WhatsApp Updates</div>
                      <div className="account-toggle-sub">
                        Get personalized order tracking, exclusive referral drops, and promotional discounts.
                      </div>
                    </div>
                    <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={Boolean(accountData?.profile?.consent_whatsapp && !accountData?.profile?.opted_out)}
                        onChange={handleToggleConsent}
                        disabled={isUpdatingConsent}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: (accountData?.profile?.consent_whatsapp && !accountData?.profile?.opted_out) ? '#10b981' : '#4b5563',
                        borderRadius: '24px', transition: '0.3s'
                      }}>
                        <span style={{
                          position: 'absolute', content: '""', height: '18px', width: '18px', left: (accountData?.profile?.consent_whatsapp && !accountData?.profile?.opted_out) ? '22px' : '3px', bottom: '3px',
                          backgroundColor: '#fff', borderRadius: '50%', transition: '0.3s'
                        }}></span>
                      </span>
                    </label>
                  </div>

                  {/* Quick Switch Demo Account Section */}
                  <div className="drawer-switch-section">
                    <div className="drawer-switch-title">⚡ Quick Switch Active Account (Demo)</div>
                    <div className="drawer-switch-btns">
                      <button 
                        type="button"
                        className={`drawer-switch-btn ${customerId === 'demo-customer-1791961381312' ? 'active' : ''}`}
                        onClick={() => handleSwitchDemoAccount('demo-customer-1791961381312')}
                      >
                        👔 Radhe (VIP • ₹100)
                      </button>
                      <button 
                        type="button"
                        className={`drawer-switch-btn ${customerId === 'demo-customer-1791959899392' ? 'active' : ''}`}
                        onClick={() => handleSwitchDemoAccount('demo-customer-1791959899392')}
                      >
                        📱 Shyam (Warm • ₹100)
                      </button>
                      <button 
                        type="button"
                        className="drawer-switch-btn"
                        onClick={handleStartFreshAccount}
                        title="Create or test a brand new shopper with ₹100 Welcome Pass"
                      >
                        ✨ + New Shopper Pass
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
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
