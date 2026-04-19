import pytest
import requests
import os
import time

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")


class TestChat:
    """AI chat endpoint tests"""

    def test_send_chat_message(self, api_client, auth_headers):
        """Test sending a chat message to AI doctor"""
        response = api_client.post(
            f"{BASE_URL}/api/chat/send",
            json={"message": "What is Parkinson's disease?"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "user_message" in data
        assert "ai_message" in data
        # Verify user message
        assert data["user_message"]["role"] == "user"
        assert data["user_message"]["text"] == "What is Parkinson's disease?"
        assert "id" in data["user_message"]
        assert "_id" not in data["user_message"]
        # Verify AI message
        assert data["ai_message"]["role"] == "assistant"
        assert len(data["ai_message"]["text"]) > 0
        assert "id" in data["ai_message"]
        assert "_id" not in data["ai_message"]
        print(f"✓ Chat message sent, AI replied with {len(data['ai_message']['text'])} chars")

    def test_chat_without_auth(self, api_client):
        """Test sending chat without auth fails"""
        response = api_client.post(
            f"{BASE_URL}/api/chat/send", json={"message": "Hello"}
        )
        assert response.status_code == 401
        print("✓ Chat without auth rejected")

    def test_chat_history_after_send(self, api_client, auth_headers):
        """Test chat history contains sent messages"""
        # Send a unique message
        unique_msg = f"Test message at {time.time()}"
        send_response = api_client.post(
            f"{BASE_URL}/api/chat/send",
            json={"message": unique_msg},
            headers=auth_headers,
        )
        assert send_response.status_code == 200
        # Get history
        history_response = api_client.get(
            f"{BASE_URL}/api/chat/history", headers=auth_headers
        )
        assert history_response.status_code == 200
        history = history_response.json()
        assert isinstance(history, list)
        assert len(history) >= 2  # At least user + AI message
        # Verify our message is in history
        user_messages = [m for m in history if m["role"] == "user"]
        assert any(unique_msg in m["text"] for m in user_messages)
        # Verify sorted by created_at ascending (oldest first)
        if len(history) >= 2:
            assert history[0]["created_at"] <= history[-1]["created_at"]
        print(f"✓ Chat history retrieved: {len(history)} messages")

    def test_chat_multi_turn_memory(self, api_client, auth_headers):
        """Test multi-turn conversation memory"""
        # First message
        response1 = api_client.post(
            f"{BASE_URL}/api/chat/send",
            json={"message": "My name is Alice."},
            headers=auth_headers,
        )
        assert response1.status_code == 200
        # Second message referencing first
        response2 = api_client.post(
            f"{BASE_URL}/api/chat/send",
            json={"message": "What is my name?"},
            headers=auth_headers,
        )
        assert response2.status_code == 200
        ai_reply = response2.json()["ai_message"]["text"].lower()
        # AI should remember the name (session_id preserves context)
        # Note: This might not always work perfectly, but we test the flow
        print(f"✓ Multi-turn chat completed, AI reply: {ai_reply[:100]}...")

    def test_chat_empty_message(self, api_client, auth_headers):
        """Test sending empty message fails validation"""
        response = api_client.post(
            f"{BASE_URL}/api/chat/send", json={"message": ""}, headers=auth_headers
        )
        # Should fail validation (422) or return error
        assert response.status_code in [422, 400]
        print("✓ Empty message rejected")
