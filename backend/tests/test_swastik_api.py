"""Backend API tests for Swastik Hotel booking system."""
import asyncio
import json
import os
import pytest
import requests
import uuid
import websockets

from conftest import BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD

# small base64 sample (1x1 png)
B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="


def _aadhar() -> str:
    return "".join([str((i * 7 + 3) % 10) for i in range(12)])  # deterministic 12-digit


# ---------------- Auth ----------------
class TestAuth:
    def test_login_success(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login",
                            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "access_token" in body and body["access_token"]
        assert body["user"]["email"] == ADMIN_EMAIL
        assert body["user"]["role"] == "admin"
        assert "_id" not in body["user"]

    def test_login_bad_password(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login",
                            json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_me_without_token(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 401

    def test_me_with_token(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == ADMIN_EMAIL
        assert "_id" not in body


# ---------------- Rooms ----------------
class TestRooms:
    def test_rooms_list_and_pricing(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/rooms", timeout=15)
        assert r.status_code == 200
        rooms = r.json()
        assert len(rooms) == 7
        room_map = {x["room_no"]: x for x in rooms}
        for rn in ["101", "102", "103", "104", "105", "106", "107"]:
            assert rn in room_map
        # AC rooms
        for rn in ["103", "104", "107"]:
            r0 = room_map[rn]
            assert r0["room_type"] == "AC"
            assert r0["base_price"] == 700
            assert r0["default_12hr"] == 800
            assert r0["default_24hr"] == 1200
        # Non-AC
        for rn in ["101", "102", "105", "106"]:
            r0 = room_map[rn]
            assert r0["room_type"] == "NON_AC"
            assert r0["base_price"] == 400
            assert r0["default_12hr"] == 500
            assert r0["default_24hr"] == 900
        # No _id field
        for r0 in rooms:
            assert "_id" not in r0

    def test_rooms_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/rooms", timeout=15)
        assert r.status_code == 401


# ---------------- Bookings ----------------
class TestBookings:
    created_ids = []
    test_aadhar = _aadhar()
    test_aadhar_partner = "987654321098"

    def _payload(self, room_no="101", aadhar=None, duration=12, rate=None):
        rt_ac = room_no in ("103", "104", "107")
        if rate is None:
            rate = 500 if not rt_ac else 800
        return {
            "room_no": room_no,
            "customer_name": "TEST_Customer",
            "aadhar_id": aadhar or self.test_aadhar,
            "phone": "9999988888",
            "partner_name": "TEST_Partner",
            "partner_aadhar": self.test_aadhar_partner,
            "aadhar_front_b64": B64,
            "aadhar_back_b64": B64,
            "partner_aadhar_front_b64": B64,
            "partner_aadhar_back_b64": B64,
            "duration_hours": duration,
            "rate": rate,
            "notes": "TEST_booking",
        }

    def test_a_create_booking_invalid_room(self, auth_client):
        p = self._payload(room_no="999")
        r = auth_client.post(f"{BASE_URL}/api/bookings", json=p, timeout=15)
        assert r.status_code == 400

    def test_b_create_booking_rate_below_base(self, auth_client):
        p = self._payload(room_no="101", rate=300)
        r = auth_client.post(f"{BASE_URL}/api/bookings", json=p, timeout=15)
        assert r.status_code == 400

    def test_c_create_booking_rate_not_increment(self, auth_client):
        p = self._payload(room_no="101", rate=450)  # 400 + 50
        r = auth_client.post(f"{BASE_URL}/api/bookings", json=p, timeout=15)
        assert r.status_code == 400

    def test_d_create_booking_invalid_duration(self, auth_client):
        p = self._payload(room_no="101")
        p["duration_hours"] = 10
        r = auth_client.post(f"{BASE_URL}/api/bookings", json=p, timeout=15)
        assert r.status_code == 422  # pydantic Literal violation

    def test_e_create_booking_success_non_ac(self, auth_client):
        # Cleanup: checkout any active booking on 101
        active = auth_client.get(f"{BASE_URL}/api/bookings?status=active", timeout=15).json()
        for b in active:
            if b["room_no"] == "101":
                auth_client.post(f"{BASE_URL}/api/bookings/{b['id']}/checkout", timeout=15)

        p = self._payload(room_no="101", rate=500, duration=12)
        r = auth_client.post(f"{BASE_URL}/api/bookings", json=p, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["room_no"] == "101"
        assert body["room_type"] == "NON_AC"
        assert body["status"] == "active"
        assert body["rate"] == 500
        assert "_id" not in body
        assert "aadhar_front_b64" not in body  # public response strips images
        TestBookings.created_ids.append(body["id"])

    def test_f_duplicate_room_blocked(self, auth_client):
        p = self._payload(room_no="101", rate=500, duration=12)
        r = auth_client.post(f"{BASE_URL}/api/bookings", json=p, timeout=15)
        assert r.status_code == 409

    def test_g_create_ac_booking_with_increment(self, auth_client):
        # cleanup 103
        active = auth_client.get(f"{BASE_URL}/api/bookings?status=active", timeout=15).json()
        for b in active:
            if b["room_no"] == "103":
                auth_client.post(f"{BASE_URL}/api/bookings/{b['id']}/checkout", timeout=15)
        p = self._payload(room_no="103", rate=900, duration=24)  # 700 + 200
        p["aadhar_id"] = "111122223333"
        r = auth_client.post(f"{BASE_URL}/api/bookings", json=p, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["room_type"] == "AC"
        assert body["rate"] == 900
        TestBookings.created_ids.append(body["id"])

    def test_h_list_active(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/bookings?status=active", timeout=15)
        assert r.status_code == 200
        ids = {b["id"] for b in r.json()}
        for cid in TestBookings.created_ids:
            assert cid in ids

    def test_i_get_booking_detail_has_images(self, auth_client):
        bid = TestBookings.created_ids[0]
        r = auth_client.get(f"{BASE_URL}/api/bookings/{bid}", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["aadhar_front_b64"] == B64
        assert body["aadhar_back_b64"] == B64
        assert "_id" not in body

    def test_j_search_by_name(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/bookings/search",
                            params={"q": "TEST_Customer", "field": "name"}, timeout=15)
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_k_search_by_aadhar(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/bookings/search",
                            params={"q": TestBookings.test_aadhar, "field": "aadhar"}, timeout=15)
        assert r.status_code == 200
        assert any(b["aadhar_id"] == TestBookings.test_aadhar for b in r.json())

    def test_l_search_by_phone(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/bookings/search",
                            params={"q": "9999988888", "field": "phone"}, timeout=15)
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_m_history_by_aadhar_partner(self, auth_client):
        # search using partner aadhar should also return bookings
        r = auth_client.get(f"{BASE_URL}/api/bookings/by-aadhar/{TestBookings.test_aadhar_partner}",
                            timeout=15)
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_n_checkout_booking(self, auth_client):
        bid = TestBookings.created_ids[0]
        r = auth_client.post(f"{BASE_URL}/api/bookings/{bid}/checkout", timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "completed"
        assert r.json()["checked_out_at"] is not None

        # GET to verify
        r2 = auth_client.get(f"{BASE_URL}/api/bookings/{bid}", timeout=15)
        assert r2.json()["status"] == "completed"

        # double-checkout should fail
        r3 = auth_client.post(f"{BASE_URL}/api/bookings/{bid}/checkout", timeout=15)
        assert r3.status_code == 400

    def test_o_duplicate_aadhar_different_room_allowed(self, auth_client):
        # After checkout on 101, can we book another room with same aadhar
        p = TestBookings._payload(self, room_no="102", rate=500, duration=12)
        # ensure 102 is free
        active = auth_client.get(f"{BASE_URL}/api/bookings?status=active", timeout=15).json()
        for b in active:
            if b["room_no"] == "102":
                auth_client.post(f"{BASE_URL}/api/bookings/{b['id']}/checkout", timeout=15)
        r = auth_client.post(f"{BASE_URL}/api/bookings", json=p, timeout=15)
        assert r.status_code == 200, r.text
        TestBookings.created_ids.append(r.json()["id"])

    def test_p_completed_filter(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/bookings?status=completed", timeout=15)
        assert r.status_code == 200
        assert any(b["id"] == TestBookings.created_ids[0] for b in r.json())

    def test_q_get_404(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/bookings/{uuid.uuid4()}", timeout=15)
        assert r.status_code == 404

    @classmethod
    def teardown_class(cls):
        # Cleanup: checkout any remaining active and remove from db not possible without admin api;
        # Mark active TEST bookings as completed
        try:
            tok_r = requests.post(f"{BASE_URL}/api/auth/login",
                                  json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
            tok = tok_r.json()["access_token"]
            h = {"Authorization": f"Bearer {tok}"}
            for bid in cls.created_ids:
                requests.post(f"{BASE_URL}/api/bookings/{bid}/checkout", headers=h, timeout=15)
        except Exception:
            pass


# ---------------- WebSocket ----------------
class TestWebSocket:
    def _ws_url(self, token):
        u = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")
        return f"{u}/api/ws?token={token}"

    def test_ws_no_token_rejected(self):
        async def run():
            url = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws"
            try:
                async with websockets.connect(url, open_timeout=10) as ws:
                    await ws.recv()
                return None
            except websockets.exceptions.InvalidStatus as e:
                return e.response.status_code
            except websockets.exceptions.ConnectionClosed as e:
                return e.code
            except Exception as e:
                return str(e)
        result = asyncio.run(run())
        # Either close code 4401 or HTTP rejection. Acceptable: 4401, 401, 403
        assert result in (4401, 401, 403) or "4401" in str(result), f"got {result!r}"

    def test_ws_invalid_token_rejected(self):
        async def run():
            try:
                async with websockets.connect(self._ws_url("bad.token.here"), open_timeout=10) as ws:
                    await ws.recv()
                return None
            except websockets.exceptions.ConnectionClosed as e:
                return e.code
            except Exception as e:
                return str(e)
        result = asyncio.run(run())
        # Either FastAPI close 4401 or ingress HTTP 403/401 rejection are valid
        assert result == 4401 or "4401" in str(result) or "403" in str(result) or "401" in str(result), f"got {result!r}"

    def test_ws_broadcast_on_create(self, auth_token, auth_client):
        # Cleanup 105 first
        active = auth_client.get(f"{BASE_URL}/api/bookings?status=active", timeout=15).json()
        for b in active:
            if b["room_no"] == "105":
                auth_client.post(f"{BASE_URL}/api/bookings/{b['id']}/checkout", timeout=15)

        async def run():
            received = []
            async with websockets.connect(self._ws_url(auth_token), open_timeout=10) as ws:
                # first msg - connected
                first = await asyncio.wait_for(ws.recv(), timeout=5)
                received.append(json.loads(first))
                # Now create a booking via REST in parallel
                async def make_booking():
                    await asyncio.sleep(0.4)
                    payload = {
                        "room_no": "105",
                        "customer_name": "TEST_WS_Customer",
                        "aadhar_id": "121212121212",
                        "phone": "8888877777",
                        "aadhar_front_b64": B64,
                        "aadhar_back_b64": B64,
                        "duration_hours": 12,
                        "rate": 500,
                    }
                    return requests.post(
                        f"{BASE_URL}/api/bookings",
                        json=payload,
                        headers={"Authorization": f"Bearer {auth_token}",
                                 "Content-Type": "application/json"},
                        timeout=15,
                    )

                booking_task = asyncio.create_task(asyncio.to_thread(
                    requests.post,
                    f"{BASE_URL}/api/bookings",
                    json={
                        "room_no": "105",
                        "customer_name": "TEST_WS_Customer",
                        "aadhar_id": "121212121212",
                        "phone": "8888877777",
                        "aadhar_front_b64": B64,
                        "aadhar_back_b64": B64,
                        "duration_hours": 12,
                        "rate": 500,
                    },
                    headers={"Authorization": f"Bearer {auth_token}",
                             "Content-Type": "application/json"},
                    timeout=15,
                ))

                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=10)
                    received.append(json.loads(msg))
                except asyncio.TimeoutError:
                    pass
                resp = await booking_task
                return received, resp.status_code
        received, rest_status = asyncio.run(run())
        assert rest_status == 200
        assert any(m.get("type") == "connected" for m in received)
        assert any(m.get("type") == "booking_created" for m in received), f"received: {received}"
