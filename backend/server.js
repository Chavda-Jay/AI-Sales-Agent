// ============================================================
// AI SALES AGENT - BACKEND SERVER
// This is the "brain" of the system. It:
//   1. Receives a customer message from the frontend
//   2. Sends it to Claude along with the business config
//   3. Gets back a reply + intent score + segment
//   4. Sends that back to the frontend
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'openai/gpt-oss-120b'; // current free Groq model (llama-3.3-70b-versatile was deprecated)

// Load business config from the JSON file (edit business-config.json, not this file)
function loadConfig() {
  const raw = fs.readFileSync(path.join(__dirname, 'business-config.json'), 'utf-8');
  return JSON.parse(raw);
}

// In-memory conversation store (for demo only).
// In production this becomes a real database table (see database/schema.sql)
const conversations = {};

// Detects the customer's language by checking the Unicode script used.
// This is more reliable than asking the AI to guess the language itself.
function detectLanguage(text) {
  if (/[\u0A80-\u0AFF]/.test(text)) return 'Gujarati — reply ONLY in Gujarati script (ગુજરાતી)';
  if (/[\u0900-\u097F]/.test(text)) return 'Hindi — reply ONLY in Hindi (Devanagari) script';
  return 'English or Hinglish (Roman script) — if the customer mixed Hindi words in Roman letters, reply the same natural Hinglish way; if they wrote plain English, reply in plain English';
}

app.post('/api/chat', async (req, res) => {
  try {
    const { customerId, message } = req.body;
    if (!customerId || !message) {
      return res.status(400).json({ error: 'customerId and message are required' });
    }

    const config = loadConfig();
    const catalogText = config.catalog
      .map(p => `${p.name} — ₹${p.price} — ${p.note}`)
      .join('\n');

    if (!conversations[customerId]) conversations[customerId] = [];
    const history = conversations[customerId];

    const detectedLang = detectLanguage(message);

    const systemPrompt = `You are an AI B2C sales agent for the Indian brand "${config.brandName}".
Product catalog:
${catalogText}

Policies: ${config.policies}

Language rule (very important, follow exactly):
- The customer's current message language has been detected as: ${detectedLang}
- Write your "reply" field in that exact language/script. Do not translate to a different language than instructed.
- Keep it natural and native-sounding, not a literal word-for-word translation.

Rules:
- Never invent prices, stock, delivery dates or offers not listed above.
- Be helpful, concise, human, persuasive without being pushy.
- Ask only necessary questions to narrow a recommendation.

After reading the conversation, respond with ONLY a raw JSON object (no markdown fences) with exactly:
{
  "reply": "the customer-facing chat message",
  "intent_score": integer 0-100,
  "segment": "COLD" | "WARM" | "HOT" | "CUSTOMER",
  "reasoning": "one short sentence",
  "objection": "short phrase or null",
  "recommended_product": "product name or null",
  "next_action": "short recommended action"
}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message },
    ];

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    const data = await groqResponse.json();

    if (data.error) {
      console.error('Groq error:', data.error);
      return res.status(500).json({ error: data.error.message || 'Groq API error' });
    }

    let raw = (data.choices?.[0]?.message?.content || '').trim();
    raw = raw.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      parsed = {
        reply: raw || 'Sorry, thoda issue aa gaya. Please try again.',
        intent_score: 0,
        segment: 'COLD',
        reasoning: 'Could not parse AI response',
        objection: null,
        recommended_product: null,
        next_action: null,
      };
    }

    history.push({ role: 'user', content: message });
    history.push({ role: 'assistant', content: JSON.stringify(parsed) });

    // TODO (Phase 3): instead of console.log, INSERT this into the
    // `conversations` and `customers` tables in your real database.
    console.log(`[${customerId}] score=${parsed.intent_score} segment=${parsed.segment}`);

    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server.' });
  }
});

app.get('/api/config', (req, res) => {
  try {
    const config = loadConfig();
    res.json(config);
  } catch (e) {
    res.status(500).json({ error: 'Could not load business config' });
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ AI Sales Agent backend running at http://localhost:${PORT}`);
});