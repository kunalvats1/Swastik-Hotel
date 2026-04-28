from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import uuid
import asyncio
import json as jsonlib
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, WebSocket, WebSocketDisconnect
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr


# ---------- Config ----------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 7  # 7 days for mobile convenience

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@swastik.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("swastik")

# ---------- Static room data ----------
AC_ROOMS = {"103", "104", "107"}
ALL_ROOMS = ["101", "102", "103", "104", "105", "106", "107"]

# Pricing config (admin can override per-booking, with +100 increments above base)
PRICING = {
    "AC": {"base": 700, "default_12hr": 800, "default_24hr": 1200},
    "NON_AC": {"base": 400, "default_12hr": 500, "default_24hr": 900},
}


def room_type(room_no: str) -> str:
    return "AC" if room_no in AC_ROOMS else "NON_AC"


# ---------- DB ----------
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


# ---------- Auth helpers ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS),
        "iat": datetime.now(timezone.utc),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------- Models ----------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: str


class LoginResponse(BaseModel):
    user: UserOut
    access_token: str
    token_type: str = "bearer"


class BookingCreate(BaseModel):
    room_no: str
    customer_name: str
    aadhar_id: str
    phone: str
    partner_name: Optional[str] = None
    partner_aadhar: Optional[str] = None
    aadhar_front_b64: str  # base64 image string (data URI ok)
    aadhar_back_b64: str
    partner_aadhar_front_b64: Optional[str] = None
    partner_aadhar_back_b64: Optional[str] = None
    duration_hours: Literal[12, 24]
    rate: int  # final rate admin agreed
    notes: Optional[str] = None


class BookingOut(BaseModel):
    id: str
    room_no: str
    room_type: str
    customer_name: str
    aadhar_id: str
    phone: str
    partner_name: Optional[str] = None
    partner_aadhar: Optional[str] = None
    duration_hours: int
    rate: int
    check_in: str
    check_out_due: str
    checked_out_at: Optional[str] = None
    status: str  # active | completed
    notes: Optional[str] = None
    created_by: str
    created_at: str


class BookingDetail(BookingOut):
    aadhar_front_b64: str
    aadhar_back_b64: str
    partner_aadhar_front_b64: Optional[str] = None
    partner_aadhar_back_b64: Optional[str] = None


class RoomStatus(BaseModel):
    room_no: str
    room_type: str
    base_price: int
    default_12hr: int
    default_24hr: int
    is_occupied: bool
    current_booking: Optional[BookingOut] = None


# ---------- Sanitizers ----------
def _booking_public(doc: dict) -> dict:
    """Strip _id and large base64 fields for list/response."""
    if not doc:
        return doc
    return {
        "id": doc["id"],
        "room_no": doc["room_no"],
        "room_type": doc["room_type"],
        "customer_name": doc["customer_name"],
        "aadhar_id": doc["aadhar_id"],
        "phone": doc["phone"],
        "partner_name": doc.get("partner_name"),
        "partner_aadhar": doc.get("partner_aadhar"),
        "duration_hours": doc["duration_hours"],
        "rate": doc["rate"],
        "check_in": doc["check_in"],
        "check_out_due": doc["check_out_due"],
        "checked_out_at": doc.get("checked_out_at"),
        "status": doc["status"],
        "notes": doc.get("notes"),
        "created_by": doc["created_by"],
        "created_at": doc["created_at"],
    }


def _booking_detail(doc: dict) -> dict:
    base = _booking_public(doc)
    base.update({
        "aadhar_front_b64": doc.get("aadhar_front_b64", ""),
        "aadhar_back_b64": doc.get("aadhar_back_b64", ""),
        "partner_aadhar_front_b64": doc.get("partner_aadhar_front_b64"),
        "partner_aadhar_back_b64": doc.get("partner_aadhar_back_b64"),
    })
    return base


# ---------- WebSocket Manager ----------
class ConnectionManager:
    def __init__(self):
        self.active: List[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self.active.append(ws)

    async def disconnect(self, ws: WebSocket):
        async with self._lock:
            if ws in self.active:
                self.active.remove(ws)

    async def broadcast(self, message: dict):
        async with self._lock:
            conns = list(self.active)
        for ws in conns:
            try:
                await ws.send_text(jsonlib.dumps(message))
            except Exception:
                try:
                    await ws.close()
                except Exception:
                    pass
                async with self._lock:
                    if ws in self.active:
                        self.active.remove(ws)


manager = ConnectionManager()


# ---------- App & Router ----------
app = FastAPI(title="Swastik Hotel API")
api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"message": "Swastik Hotel API", "ok": True}


# ---------- Auth Endpoints ----------
@api.post("/auth/login", response_model=LoginResponse)
async def login(payload: LoginRequest):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], user["email"])
    return {
        "user": {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]},
        "access_token": token,
        "token_type": "bearer",
    }


@api.get("/auth/me", response_model=UserOut)
async def me(current: dict = Depends(get_current_user)):
    return {"id": current["id"], "email": current["email"], "name": current["name"], "role": current["role"]}


@api.post("/auth/logout")
async def logout(current: dict = Depends(get_current_user)):
    # Stateless JWT - client just discards token
    return {"ok": True}


# ---------- Room Endpoints ----------
@api.get("/rooms")
async def list_rooms(current: dict = Depends(get_current_user)) -> List[RoomStatus]:
    # Find current active bookings
    active_cursor = db.bookings.find({"status": "active"}, {"_id": 0})
    active_by_room = {}
    async for b in active_cursor:
        active_by_room[b["room_no"]] = b

    rooms: List[RoomStatus] = []
    for rn in ALL_ROOMS:
        rt = room_type(rn)
        prices = PRICING[rt]
        active_b = active_by_room.get(rn)
        rooms.append(RoomStatus(
            room_no=rn,
            room_type=rt,
            base_price=prices["base"],
            default_12hr=prices["default_12hr"],
            default_24hr=prices["default_24hr"],
            is_occupied=bool(active_b),
            current_booking=BookingOut(**_booking_public(active_b)) if active_b else None,
        ))
    return rooms


@api.get("/rooms/pricing")
async def get_pricing(current: dict = Depends(get_current_user)):
    return PRICING


# ---------- Booking Endpoints ----------
@api.post("/bookings", response_model=BookingOut)
async def create_booking(payload: BookingCreate, current: dict = Depends(get_current_user)):
    if payload.room_no not in ALL_ROOMS:
        raise HTTPException(status_code=400, detail="Invalid room number")
    rt = room_type(payload.room_no)
    base = PRICING[rt]["base"]
    if payload.rate < base:
        raise HTTPException(status_code=400, detail=f"Rate cannot be below base {base}")
    if (payload.rate - base) % 100 != 0:
        raise HTTPException(status_code=400, detail="Rate must be base + multiples of 100")

    # Check room availability
    existing = await db.bookings.find_one({"room_no": payload.room_no, "status": "active"})
    if existing:
        raise HTTPException(status_code=409, detail=f"Room {payload.room_no} is currently occupied")

    now = datetime.now(timezone.utc)
    due = now + timedelta(hours=payload.duration_hours)
    doc = {
        "id": str(uuid.uuid4()),
        "room_no": payload.room_no,
        "room_type": rt,
        "customer_name": payload.customer_name.strip(),
        "aadhar_id": payload.aadhar_id.strip().replace(" ", ""),
        "phone": payload.phone.strip(),
        "partner_name": (payload.partner_name or "").strip() or None,
        "partner_aadhar": ((payload.partner_aadhar or "").strip().replace(" ", "")) or None,
        "aadhar_front_b64": payload.aadhar_front_b64,
        "aadhar_back_b64": payload.aadhar_back_b64,
        "partner_aadhar_front_b64": payload.partner_aadhar_front_b64,
        "partner_aadhar_back_b64": payload.partner_aadhar_back_b64,
        "duration_hours": payload.duration_hours,
        "rate": payload.rate,
        "check_in": now.isoformat(),
        "check_out_due": due.isoformat(),
        "checked_out_at": None,
        "status": "active",
        "notes": payload.notes,
        "created_by": current["email"],
        "created_at": now.isoformat(),
    }
    await db.bookings.insert_one(doc)

    public = _booking_public(doc)
    # Broadcast event
    await manager.broadcast({"type": "booking_created", "booking": public})
    return public


@api.get("/bookings")
async def list_bookings(
    status: Optional[str] = None,
    limit: int = 100,
    current: dict = Depends(get_current_user),
) -> List[BookingOut]:
    q = {}
    if status in ("active", "completed"):
        q["status"] = status
    cursor = db.bookings.find(q, {"_id": 0}).sort("created_at", -1).limit(limit)
    out = []
    async for b in cursor:
        out.append(_booking_public(b))
    return out


@api.get("/bookings/search")
async def search_bookings(
    q: str,
    field: Literal["name", "aadhar", "phone", "any"] = "any",
    current: dict = Depends(get_current_user),
):
    q = q.strip()
    if not q:
        return []
    norm = q.replace(" ", "")
    queries = []
    if field in ("name", "any"):
        queries.append({"customer_name": {"$regex": q, "$options": "i"}})
        queries.append({"partner_name": {"$regex": q, "$options": "i"}})
    if field in ("aadhar", "any"):
        queries.append({"aadhar_id": {"$regex": norm, "$options": "i"}})
        queries.append({"partner_aadhar": {"$regex": norm, "$options": "i"}})
    if field in ("phone", "any"):
        queries.append({"phone": {"$regex": q, "$options": "i"}})
    mongo_q = {"$or": queries} if queries else {}
    cursor = db.bookings.find(mongo_q, {"_id": 0}).sort("created_at", -1).limit(200)
    out = []
    async for b in cursor:
        out.append(_booking_public(b))
    return out


@api.get("/bookings/{booking_id}", response_model=BookingDetail)
async def get_booking(booking_id: str, current: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    return _booking_detail(b)


@api.post("/bookings/{booking_id}/checkout", response_model=BookingOut)
async def checkout_booking(booking_id: str, current: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b["status"] != "active":
        raise HTTPException(status_code=400, detail="Booking already completed")
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"status": "completed", "checked_out_at": now_iso}},
    )
    b["status"] = "completed"
    b["checked_out_at"] = now_iso
    public = _booking_public(b)
    await manager.broadcast({"type": "booking_checked_out", "booking": public})
    return public


@api.get("/bookings/by-aadhar/{aadhar_id}")
async def history_by_aadhar(aadhar_id: str, current: dict = Depends(get_current_user)):
    norm = aadhar_id.strip().replace(" ", "")
    cursor = db.bookings.find(
        {"$or": [{"aadhar_id": norm}, {"partner_aadhar": norm}]}, {"_id": 0}
    ).sort("created_at", -1)
    out = []
    async for b in cursor:
        out.append(_booking_public(b))
    return out


# ---------- WebSocket ----------
@app.websocket("/api/ws")
async def ws_endpoint(websocket: WebSocket):
    # Token via query param (?token=...)
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4401)
        return
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            await websocket.close(code=4401)
            return
    except Exception:
        await websocket.close(code=4401)
        return

    await manager.connect(websocket)
    try:
        await websocket.send_text(jsonlib.dumps({"type": "connected"}))
        while True:
            # Keep alive; ignore client messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception:
        await manager.disconnect(websocket)


# ---------- Startup ----------
@app.on_event("startup")
async def startup():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.bookings.create_index("id", unique=True)
    await db.bookings.create_index("aadhar_id")
    await db.bookings.create_index("phone")
    await db.bookings.create_index([("room_no", 1), ("status", 1)])

    # Seed admin
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if existing is None:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": ADMIN_EMAIL,
            "name": "Admin",
            "role": "admin",
            "password_hash": hash_password(ADMIN_PASSWORD),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Seeded admin user: {ADMIN_EMAIL}")
    elif not verify_password(ADMIN_PASSWORD, existing["password_hash"]):
        await db.users.update_one(
            {"email": ADMIN_EMAIL},
            {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}},
        )
        logger.info("Updated admin password from env")


@app.on_event("shutdown")
async def shutdown():
    client.close()


# ---------- CORS & Mount ----------
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
