import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")


class TestAuth:
    """Authentication endpoint tests"""

    def test_register_success(self, api_client):
        """Test user registration with valid data"""
        test_email = f"test_{uuid.uuid4().hex[:8]}@neuroscan.ai"
        response = api_client.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": test_email, "password": "Test1234!", "name": "Test User"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == test_email
        assert data["user"]["name"] == "Test User"
        assert "id" in data["user"]
        print(f"✓ Register success: {test_email}")

    def test_register_duplicate_email(self, api_client):
        """Test registration with duplicate email fails"""
        test_email = f"test_{uuid.uuid4().hex[:8]}@neuroscan.ai"
        # First registration
        response1 = api_client.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": test_email, "password": "Test1234!", "name": "Test User"},
        )
        assert response1.status_code == 200
        # Duplicate registration
        response2 = api_client.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": test_email, "password": "Test1234!", "name": "Test User"},
        )
        assert response2.status_code == 400
        assert "already registered" in response2.json()["detail"].lower()
        print("✓ Duplicate email rejected")

    def test_register_invalid_password(self, api_client):
        """Test registration with short password fails"""
        test_email = f"test_{uuid.uuid4().hex[:8]}@neuroscan.ai"
        response = api_client.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": test_email, "password": "123", "name": "Test User"},
        )
        assert response.status_code == 422
        print("✓ Short password rejected")

    def test_login_success(self, api_client):
        """Test login with valid credentials"""
        # Create user first
        test_email = f"test_{uuid.uuid4().hex[:8]}@neuroscan.ai"
        api_client.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": test_email, "password": "Test1234!", "name": "Test User"},
        )
        # Login
        response = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": test_email, "password": "Test1234!"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == test_email
        print(f"✓ Login success: {test_email}")

    def test_login_invalid_credentials(self, api_client):
        """Test login with wrong password fails"""
        response = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "nonexistent@test.com", "password": "wrongpass"},
        )
        assert response.status_code == 401
        assert "invalid" in response.json()["detail"].lower()
        print("✓ Invalid credentials rejected")

    def test_me_with_token(self, api_client, auth_token):
        """Test /auth/me with valid token"""
        response = api_client.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "email" in data
        assert "name" in data
        assert "_id" not in data  # MongoDB _id should be excluded
        assert "password_hash" not in data  # Password should be excluded
        print(f"✓ /auth/me success: {data['email']}")

    def test_me_without_token(self, api_client):
        """Test /auth/me without token fails"""
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("✓ /auth/me without token rejected")

    def test_me_with_invalid_token(self, api_client):
        """Test /auth/me with invalid token fails"""
        response = api_client.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": "Bearer invalid_token_xyz"},
        )
        assert response.status_code == 401
        print("✓ Invalid token rejected")
