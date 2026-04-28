# Swastik Hotel Booking Management — PRD

## Overview
Mobile admin/receptionist app for **Hotel Swastik** (7 rooms). Built with Expo (React Native, expo-router) + FastAPI + MongoDB. Multiple admin devices stay in sync via WebSocket live updates.

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
3. **New Booking flow** — pick room → 12hr/24hr → rate editor (+₹100/-₹100) → customer (name, 12-digit Aadhar, 10-digit phone) → Aadhar front + back photo (camera/gallery) → optional partner (name, Aadhar, photos) → notes → confirm
4. **Bookings tab** — Active / History tabs with FlatList, due/overdue indicators, tap to view detail
5. **Search tab** — search by name / Aadhar / phone (or any), uses MongoDB regex
6. **Booking detail** — full info, Aadhar photos, "Check Out Guest" button to mark completed
7. **Settings** — profile, live status, hotel info, sign out
8. **Real-time live updates** — WebSocket `/api/ws?token=...` broadcasts `booking_created` / `booking_checked_out` events to all connected clients; toast notification appears at top of screen

## Tech Stack
- **Backend:** FastAPI + Motor (async MongoDB) + bcrypt + PyJWT + WebSockets
- **Frontend:** Expo SDK 54, expo-router (file-based), AsyncStorage, expo-image-picker, axios

## Storage
- All data on Emergent-hosted MongoDB (single source of truth for all devices)
- Aadhar photos stored as base64 inside booking document
- All `id` fields use UUID strings (no ObjectId leakage)
- Indexes: users.email (unique), bookings.aadhar_id, bookings.phone, bookings.(room_no, status)

## Real-time Architecture
- Backend keeps a `ConnectionManager` of authed WebSocket connections
- On booking create/checkout: `manager.broadcast({type, booking})`
- Frontend `LiveProvider` auto-reconnects every 3s on disconnect, dispatches events to all screens via React context; `LiveToast` shows banner

## Deployment
- Use Emergent **Publish** button (top-right) to generate APK / publish to stores
- Both owner and receptionist install the same APK; sign in with same admin account (or future per-staff accounts)
