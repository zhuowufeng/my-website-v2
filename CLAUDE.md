# Sinmoniker — Chinese Name Generator for Foreigners

## Project Overview
A website where foreigners input their English name and get Chinese full names + nicknames (小名) with meanings in both Chinese and English.

**URL:** https://sinmoniker.zeabur.app
**GitHub:** https://github.com/zhuowufeng/my-website-v2
**Tech Stack:** Next.js 16 + TypeScript + Tailwind CSS 4 + PostgreSQL

## Core Features to Build

### 1. Landing Page (`app/page.tsx`)
- Replace the default Next.js template with a beautiful landing page
- Chinese modern aesthetic (ink wash style, minimalist, elegant)
- ALL text in English (targeting foreign users)
- Content: Hero section with value proposition, example name showcase, CTA button → /login
- Responsive design

### 2. Dashboard (`app/dashboard/page.tsx`) — NEW
- Protected route (requires login)
- Input field for English name
- Gender selector (Male / Female / Any)
- Generate button
- Results display area showing name cards
- Name history below
- ALL text in English

### 3. Name Card Component (`components/NameCard.tsx`) — NEW
- Shows: Chinese full name (large), nickname (小名), meaning in Chinese, meaning in English
- 🔊 Pronunciation button next to each name using Web Speech API
- Beautiful card design with Chinese elements
- Share button
- Loading skeleton state

### 4. Pronunciation Button (`components/PronounceButton.tsx`) — NEW
- Uses Web Speech API (SpeechSynthesisUtterance with lang='zh-CN')
- Click to play Chinese pronunciation of the name
- Visual feedback when playing (animation/icon change)

### 5. API: Generate Name (`app/api/generate-name/route.ts`) — NEW
- POST: receives { englishName, gender }
- Calls DeepSeek API to generate 3 Chinese name options
- Returns structured response with:
  - chineseName (e.g., "李明华")
  - nickname (e.g., "小华")
  - meaningCn (Chinese meaning explanation)
  - meaningEn (English translation of meaning)
  - pinyin (pronunciation guide)
- Rate limited: 50 requests/user/day
- Input sanitization
- Output sanitization (no HTML in AI output)

### 6. DeepSeek API Integration (`lib/deepseek.ts`) — NEW
```typescript
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const API_URL = 'https://api.deepseek.com/v1/chat/completions';
```
- Use `deepseek-chat` model
- Temperature: 0.8 (creative but not crazy)
- Prompt: "You are a Chinese name expert..." (in English, with strict output format)
- Prompt must be secured against injection
- Output must be structured JSON

## Data Models

### Database — needs new table
```sql
CREATE TABLE IF NOT EXISTS name_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  english_name VARCHAR(100) NOT NULL,
  gender VARCHAR(10) DEFAULT 'any',
  results JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Security
- DeepSeek API key only in server-side code (not exposed to client)
- Input sanitization: strip non-alphabetic characters, limit 50 chars
- Output sanitization: escape HTML in AI responses
- Rate limiting: check user.free_usage_today before each API call
- All API routes check authentication (user must be logged in)

## Authentication
- Currently: login/register system exists at /login
- User stored in localStorage after login (simple approach)
- API routes read user from request/session
- For simplicity: pass user ID in request header or cookie

## UI/UX Guidelines
- **Target audience:** English-speaking foreigners
- **Design:** Clean, modern, with subtle Chinese cultural elements
- **Colors:** Use dark teal (#1a3a4a), warm orange/amber (#c9753e), cream (#f5f0e8)
- **Typography:** Sans-serif for English, system fonts
- **All text on the site must be in English** (except generated Chinese names)
- Fast and responsive

## Files to Create
1. `app/page.tsx` — Landing page (REPLACE existing default)
2. `app/dashboard/page.tsx` — Dashboard page (NEW)
3. `app/dashboard/layout.tsx` — Dashboard layout (NEW)
4. `app/api/generate-name/route.ts` — Name generation API (NEW)
5. `app/api/name-history/route.ts` — History API (NEW)
6. `lib/deepseek.ts` — DeepSeek API wrapper (NEW)
7. `lib/sanitize.ts` — Input/output sanitization (NEW)
8. `lib/rate-limit.ts` — Rate limiting utility (NEW)
9. `models/NameHistory.js` — Name history DB model (NEW)
10. `components/NameCard.tsx` — Name result card (NEW)
11. `components/PronounceButton.tsx` — Pronunciation button (NEW)
12. `components/Header.tsx` — Site header with nav (NEW)

## Files to Modify
1. `app/globals.css` — Add custom styles (dark teal / cream theme)
2. `app/layout.tsx` — Update metadata (title, description for Sinmoniker)
3. `models/User.js` — Add function to get usage count
4. `models/User.js` — Add name_history table creation

## Important Notes
- Do NOT remove or break the existing login page at `app/login/page.js`
- Login redirects to `/dashboard` already — perfect
- The existing `lib/db.js` and `models/User.js` use raw SQL with pg — keep consistent
- Run `npm run build` at the end to verify everything compiles
- Do NOT commit .env.local to git
