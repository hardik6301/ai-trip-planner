# Travora — AI Trip Planner

**Live:** [https://travora-ai-app.vercel.app](https://travora-ai-app.vercel.app)  
**Repo:** [hardik6301/ai-trip-planner](https://github.com/hardik6301/ai-trip-planner)

Travora is a full-stack AI travel SaaS. Users describe a trip, Gemini generates a day-by-day itinerary, and Pro users can edit it by chat, track expenses, export to calendar, and download an offline travel pack.

Built as a portfolio / resume project demonstrating freemium SaaS patterns, real payments, and production auth.

---

## Features

### Free
- AI itinerary generation (Gemini 2.5 Flash)
- Save up to **5** trips (server-enforced)
- **3** day regenerations per trip
- PDF export, share links, WhatsApp share
- Google Maps links on activities
- Live weather + currency
- Real destination photos (Wikipedia / Wikimedia)
- Debounced Geoapify city autocomplete
- Dark / light theme

### Pro (₹199 one-time via Razorpay)
- Unlimited trips & regenerations
- **AI Chat Editor** — “Make Day 2 more relaxing”
- Expense tracker + category donut + AI spend insight
- Custom activity builder
- Google Calendar export (`.ics`)
- Offline travel pack (PDF with QR codes + map links)

---

## Tech stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router) |
| UI | Tailwind CSS v4, Lucide |
| Auth + DB | Supabase (Auth, Postgres, RLS, Storage) |
| AI | Google Gemini (`gemini-2.5-flash`) |
| Payments | Razorpay (test / live) |
| Maps | Google Maps links + Embed API (optional) |
| Places search | Geoapify autocomplete |
| Live data | Open-Meteo, Frankfurter |
| Hosting | Vercel |

---

## Local setup

```bash
git clone https://github.com/hardik6301/ai-trip-planner.git
cd ai-trip-planner
npm install
```

Create `.env.local` (never commit this file):

```bash
GEMINI_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
NEXT_PUBLIC_GEOAPIFY_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY=   # optional
```

Run Supabase SQL migrations in `supabase/migrations/` (including `012_expenses.sql`).

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 60-second demo script (interviews)

> Use a Pro account (or set `profiles.is_pro = true` in Supabase for demos).

1. **Home (0:00–0:15)** — Search “Bangkok”, pick dates/budget/vibe, generate. Show the loading skeleton.
2. **Results (0:15–0:25)** — Point out real hero photo, weather/currency, day cards, Maps button.
3. **AI Chat (0:25–0:40)** — Open orange chat FAB → “Make Day 2 more relaxing” → highlight flash on updated day.
4. **Pro tools (0:40–0:50)** — Save trip → Expense Tracker → add an expense → show donut. Or Calendar / Offline Pack from the budget card.
5. **Close (0:50–1:00)** — “Freemium limits are enforced in API routes, not just the UI. Auth is Supabase; payments are Razorpay.”

**One-liner for resume:**  
*Full-stack AI trip planner with Gemini itineraries, freemium gating, Razorpay unlock, chat-based editing, and expense analytics — deployed on Vercel.*

---

## Key folders

```text
app/(pages)/          # Home, results, my-trips, pricing, profile, expenses
app/api/              # Gemini, Razorpay, chat-editor, place-image, expenses
components/trips/     # Itinerary view, chat editor, saved trip wrapper
lib/                  # Gemini client, plan limits, Supabase helpers
supabase/migrations/  # Profiles, trips, expenses, RLS
utils/                # PDF, ICS, offline pack, maps, images
```

---

## Notes

- Pro is a **one-time** unlock, not a subscription (pricing UI matches this).
- Razorpay Indian accounts may block international cards — use test UPI `success@razorpay` in test mode.
- Supabase free email confirmation can be unreliable; disable confirm-email for demos or add custom SMTP.

---

## License

Private portfolio project — All rights reserved.
