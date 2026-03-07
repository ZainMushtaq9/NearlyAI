# NearlyAI

Hyperlocal Business Discovery Platform 🏪📍

## Features
- 🤖 AI Business Profile Generator (Gemini)
- 💬 AI Customer Query Bot per business
- 🗺️ Map-based nearby business search
- 🔍 Filters: city, area, category, rating, verified
- ⭐ Reviews & Ratings with auto-recalculation
- 🏷️ Deals & Promotions
- ❤️ Favourites
- ✅ Admin verification & badge system
- 📊 Owner analytics dashboard

## Tech Stack
- **Backend**: Express.js + SQLite
- **Frontend**: React + Vite
- **AI**: Google Gemini 1.5 Flash

## Quick Start

### Backend
```bash
cd nearlyai-backend
npm install
node src/utils/initDb.js
node src/utils/seedCategories.js
npm run dev
```

### Frontend
```bash
cd nearlyai-frontend
npm install
npm run dev
```

## API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register (customer/owner) |
| POST | /api/auth/login | Login |
| GET | /api/businesses | List/search businesses |
| GET | /api/businesses/nearby | Nearby search by lat/lng |
| POST | /api/businesses/ai/generate-profile | AI profile generator |
| POST | /api/businesses/:id/ai/query | AI customer Q&A |
| POST | /api/reviews | Leave review |
| POST | /api/deals | Create deal |
| POST | /api/favourites/:id | Toggle favourite |
| POST | /api/admin/verify/:id | Verify business |

## Team
- Zain Mushtaq

## License
MIT
