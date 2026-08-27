# AI Sales Agent — Starter Project (Clothing Store Example)

## Folder structure
```
ai-sales-agent/
├── backend/            → Node.js server that talks to Claude
│   ├── server.js        → main server file
│   ├── package.json     → list of dependencies
│   ├── .env.example     → copy this to .env and add your API key
│   └── business-config.json → edit THIS to change brand/products/policy
├── frontend/            → Next.js React application
│   ├── app/             → Application code (page.js, globals.css)
│   └── package.json     → list of dependencies
├── database/
│   └── schema.sql       → run this in Supabase to create your tables
└── docs/                → business notes, screenshots, demo recording etc.
```

## How to run it (step by step)

### 1. Open the backend folder
```bash
cd ai-sales-agent/backend
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Add your API key
- Copy `.env.example` and rename the copy to `.env`
- Open `.env` and paste your real Anthropic API key:
```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
PORT=3001
```

### 4. Start the backend server
```bash
uvicorn main:app --reload --port 3001
```
You should see: `✅ AI Sales Agent backend running at http://localhost:3001`

### 5. Open the frontend
- Open a new terminal and go to the `frontend` folder
- Run `npm install` (first time only)
- Run `npm run dev` to start the Next.js development server
- Open your browser to `http://localhost:3000`
- Start chatting — it will call your backend, which calls Claude

### 6. Customize for your client's business
- Open `backend/business-config.json`
- Change `brandName`, `catalog`, and `policies`
- Save the file, restart the backend (`Ctrl+C` then `npm start` again)
- No other code needs to change

## What to do next (matches the phased roadmap)
1. ✅ Phase 1 done: basic chat + AI scoring working locally (this project)
2. Connect `database/schema.sql` to a real Supabase project, and update
   `server.js` to save each conversation into the `conversations` table
   instead of just `console.log`
3. Deploy backend somewhere (Railway/Render) so it's live on the internet
4. Add WhatsApp (AiSensy/Interakt) once website version is validated
5. Build the CRM dashboard on top of the same database

## Important
- Never upload your real `.env` file to GitHub — it contains your secret API key
- This is a learning/demo-grade starter, not the full governed production
  system described in the feasibility report (no consent management,
  approval gates, or audit logs yet — those come in later phases)
