import os
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

# Load frontend env to get the public URL
load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "admin@swastik.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth_token(api_client):
    r = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def auth_client(api_client, auth_token):
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client
