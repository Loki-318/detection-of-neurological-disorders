import pytest
import requests
import os

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def auth_token(api_client):
    """Get auth token for demo user or create new test user"""
    # Try demo user first
    try:
        response = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "demo@neuroscan.ai", "password": "Demo1234!"},
        )
        if response.status_code == 200:
            return response.json()["token"]
    except:
        pass

    # Create new test user
    import uuid
    test_email = f"test_{uuid.uuid4().hex[:8]}@neuroscan.ai"
    response = api_client.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": test_email, "password": "Test1234!", "name": "Test User"},
    )
    assert response.status_code == 200
    return response.json()["token"]


@pytest.fixture
def auth_headers(auth_token):
    """Headers with Bearer token"""
    return {"Authorization": f"Bearer {auth_token}"}
