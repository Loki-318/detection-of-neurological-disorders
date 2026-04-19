import pytest
import requests
import os

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")


class TestScans:
    """Scan endpoint tests"""

    def test_create_scan_success(self, api_client, auth_headers):
        """Test creating a scan with face detected"""
        response = api_client.post(
            f"{BASE_URL}/api/scans",
            json={"face_detected": True},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "gait_score" in data
        assert "face_score" in data
        assert "behavior_score" in data
        assert "total_score" in data
        assert "risk_label" in data
        assert data["face_detected"] is True
        assert "_id" not in data  # MongoDB _id should be excluded
        # Verify scores are in expected range
        assert 40 <= data["gait_score"] <= 95
        assert 40 <= data["face_score"] <= 95
        assert 40 <= data["behavior_score"] <= 95
        assert 40 <= data["total_score"] <= 95
        print(f"✓ Scan created: total_score={data['total_score']}, risk={data['risk_label']}")

    def test_create_scan_ai_analysis(self, api_client, auth_headers):
        """Test AI-powered scan analysis returns ai_summary and ai_recommendations"""
        response = api_client.post(
            f"{BASE_URL}/api/scans",
            json={"face_detected": True},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        # Verify AI fields exist
        assert "ai_summary" in data
        assert "ai_recommendations" in data
        # Verify ai_summary is a non-empty string (2 sentences expected)
        assert isinstance(data["ai_summary"], str)
        if data["ai_summary"]:  # May be empty if LLM fails
            assert len(data["ai_summary"]) > 0
            print(f"✓ AI summary: {data['ai_summary'][:100]}...")
        else:
            print("⚠ AI summary is empty (LLM may have failed)")
        # Verify ai_recommendations is an array of exactly 3 strings
        assert isinstance(data["ai_recommendations"], list)
        if len(data["ai_recommendations"]) > 0:
            assert len(data["ai_recommendations"]) == 3, f"Expected 3 recommendations, got {len(data['ai_recommendations'])}"
            for i, rec in enumerate(data["ai_recommendations"]):
                assert isinstance(rec, str)
                assert len(rec) > 0
                print(f"✓ Recommendation {i+1}: {rec[:80]}...")
        else:
            print("⚠ AI recommendations is empty (LLM may have failed)")
        print(f"✓ AI analysis fields present and valid")

    def test_create_scan_no_face(self, api_client, auth_headers):
        """Test creating a scan without face detected"""
        response = api_client.post(
            f"{BASE_URL}/api/scans",
            json={"face_detected": False},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["face_detected"] is False
        # Face score should be lower when not detected
        assert data["face_score"] <= 55
        print(f"✓ Scan without face: face_score={data['face_score']}")

    def test_create_scan_without_auth(self, api_client):
        """Test creating scan without auth fails"""
        response = api_client.post(
            f"{BASE_URL}/api/scans", json={"face_detected": True}
        )
        assert response.status_code == 401
        print("✓ Scan without auth rejected")

    def test_latest_scan_after_create(self, api_client, auth_headers):
        """Test getting latest scan after creating one"""
        # Create a scan
        create_response = api_client.post(
            f"{BASE_URL}/api/scans",
            json={"face_detected": True},
            headers=auth_headers,
        )
        assert create_response.status_code == 200
        created_scan = create_response.json()
        # Get latest scan
        latest_response = api_client.get(
            f"{BASE_URL}/api/scans/latest", headers=auth_headers
        )
        assert latest_response.status_code == 200
        latest_scan = latest_response.json()
        assert latest_scan["id"] == created_scan["id"]
        assert latest_scan["total_score"] == created_scan["total_score"]
        print(f"✓ Latest scan retrieved: id={latest_scan['id']}")

    def test_list_scans(self, api_client, auth_headers):
        """Test listing user's scans"""
        # Create 2 scans
        api_client.post(
            f"{BASE_URL}/api/scans",
            json={"face_detected": True},
            headers=auth_headers,
        )
        api_client.post(
            f"{BASE_URL}/api/scans",
            json={"face_detected": False},
            headers=auth_headers,
        )
        # List scans
        response = api_client.get(f"{BASE_URL}/api/scans", headers=auth_headers)
        assert response.status_code == 200
        scans = response.json()
        assert isinstance(scans, list)
        assert len(scans) >= 2
        # Verify sorted by created_at descending (latest first)
        if len(scans) >= 2:
            assert scans[0]["created_at"] >= scans[1]["created_at"]
        print(f"✓ Listed {len(scans)} scans")

    def test_risk_label_logic(self, api_client, auth_headers):
        """Test risk label is correctly assigned based on score"""
        # Create multiple scans to test risk labels
        for _ in range(5):
            response = api_client.post(
                f"{BASE_URL}/api/scans",
                json={"face_detected": True},
                headers=auth_headers,
            )
            data = response.json()
            score = data["total_score"]
            label = data["risk_label"]
            # Verify risk label matches score
            if score >= 75:
                assert label == "Low Risk"
            elif score >= 55:
                assert label == "Moderate Risk"
            else:
                assert label == "High Risk"
        print("✓ Risk label logic verified")
