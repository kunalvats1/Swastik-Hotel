# Swastik Hotel Booking Management — PRD

## Overview
Mobile admin/receptionist app for **Hotel Swastik** (7 rooms). Built with Expo (React Native, expo-router) + FastAPI + MongoDB + Cloudinary. Multiple admin devices stay in sync via WebSocket live updates.

## Rooms
| Room | Type   |
|------|--------|
| 101  | Non-AC |
| 102  | Non-AC |
| 103  | AC     |
| 104  | AC     |
| 105  | Non-AC |
| 106  | Non-AC |
| 107  | AC     |

## Pricing
- **AC** — Base ₹700, default 12hr ₹800, default 24hr ₹1200
- **Non-AC** — Base ₹400, default 12hr ₹500, default 24hr ₹900
- Admin can adjust the rate up from base in **+₹100** increments per booking.

## Features
1. **JWT Login** — admin@swastik.com / admin123 (seeded)
2. **Dashboard** — bento grid for 7 rooms; tap Available room to start booking; tap Occupied room to view booking
3. **New Booking flow** — pick room → 12hr/24hr → rate editor (+₹100/-₹100) → customer (name, **strict 12-digit Aadhar**, **strict 10-digit phone**) → Aadhar front + back photo → optional partner → notes → confirm. **Inline validation banner** (works on web + APK).
4. **Bookings tab** — Active / History tabs, due/overdue indicators
5. **Search tab** — search by name / Aadhar / phone (or any)
6. **Booking detail** — full info, **photos served from Cloudinary**, two-tap **Check Out Guest** (works on web + APK), two-tap **Delete Booking** for completed records (also deletes photos from Cloudinary)
7. **Settings** — profile, live status, hotel info, sign out
8. **Real-time WebSocket** — `booking_created` / `booking_checked_out` events broadcast to all connected admin devices; **prominent live toast** at top of screen with 6s display
9. **Admin cleanup endpoint** — `DELETE /api/bookings/cleanup/older-than/{days}` bulk-deletes completed bookings older than N days (with Cloudinary photo cleanup)

## Storage Architecture
- **MongoDB** (Emergent-hosted) — booking metadata, user accounts, Cloudinary public_ids
- **Cloudinary** (free 25 GB) — Aadhar photos uploaded to `swastik/bookings/{booking_id}/{aadhar_front,aadhar_back,partner_front,partner_back}` with auto-quality + 1200px max width
- Aadhar IDs stored as 12-digit numeric strings (no spaces)
- Phones stored as 10-digit numeric strings
- Photos served as HTTPS URLs; DB row stays under 2 KB per booking

## Tech Stack
- **Backend:** FastAPI + Motor (async MongoDB) + bcrypt + PyJWT + WebSockets + cloudinary
- **Frontend:** Expo SDK 54, expo-router, AsyncStorage, expo-image-picker, axios

## API Endpoints
- `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`
- `GET /api/rooms`, `GET /api/rooms/pricing`
- `POST /api/bookings` (uploads photos to Cloudinary)
- `GET /api/bookings?status=active|completed`
- `GET /api/bookings/{id}` (returns Cloudinary URLs)
- `POST /api/bookings/{id}/checkout`
- `DELETE /api/bookings/{id}` (deletes photos from Cloudinary too)
- `DELETE /api/bookings/cleanup/older-than/{days}` (admin bulk cleanup)
- `GET /api/bookings/search?q=...&field=name|aadhar|phone|any`
- `GET /api/bookings/by-aadhar/{aadhar}` (history matching customer or partner Aadhar)
- `WS /api/ws?token=<jwt>`

## Environment Variables (`/app/backend/.env`)
- `MONGO_URL`, `DB_NAME`, `JWT_SECRET`
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

## Deployment
- Use Emergent **Publish** button to generate APK
- Both owner and receptionist install the same APK; sign in with admin account
- Both devices share the same MongoDB + Cloudinary → automatic data consistency
