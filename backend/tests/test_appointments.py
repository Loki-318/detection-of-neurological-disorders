import pytest
import requests
import os

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")


class TestAppointments:
    """Appointment endpoint tests"""

    def test_get_slots(self, api_client, auth_headers):
        """Test getting available appointment slots"""
        response = api_client.get(
            f"{BASE_URL}/api/appointments/slots", headers=auth_headers
        )
        assert response.status_code == 200
        slots = response.json()
        assert isinstance(slots, list)
        assert len(slots) == 25  # 5 days × 5 times
        # Verify slot structure
        slot = slots[0]
        assert "id" in slot
        assert "date" in slot
        assert "time" in slot
        assert "doctor" in slot
        assert "specialty" in slot
        print(f"✓ Retrieved {len(slots)} appointment slots")

    def test_slots_without_auth(self, api_client):
        """Test getting slots without auth fails"""
        response = api_client.get(f"{BASE_URL}/api/appointments/slots")
        assert response.status_code == 401
        print("✓ Slots without auth rejected")

    def test_book_appointment(self, api_client, auth_headers):
        """Test booking an appointment"""
        # Get slots first
        slots_response = api_client.get(
            f"{BASE_URL}/api/appointments/slots", headers=auth_headers
        )
        slots = slots_response.json()
        slot = slots[0]
        # Book the slot
        book_response = api_client.post(
            f"{BASE_URL}/api/appointments",
            json={
                "slot_id": slot["id"],
                "doctor": slot["doctor"],
                "date": slot["date"],
                "time": slot["time"],
            },
            headers=auth_headers,
        )
        assert book_response.status_code == 200
        booking = book_response.json()
        assert "id" in booking
        assert booking["slot_id"] == slot["id"]
        assert booking["doctor"] == slot["doctor"]
        assert booking["status"] == "confirmed"
        assert "_id" not in booking
        print(f"✓ Appointment booked: {booking['doctor']} on {booking['date']}")

    def test_book_without_auth(self, api_client):
        """Test booking without auth fails"""
        response = api_client.post(
            f"{BASE_URL}/api/appointments",
            json={
                "slot_id": "test",
                "doctor": "Dr. Test",
                "date": "Jan 1",
                "time": "9:00 AM",
            },
        )
        assert response.status_code == 401
        print("✓ Booking without auth rejected")

    def test_list_appointments_after_booking(self, api_client, auth_headers):
        """Test listing appointments after booking"""
        # Get slots and book one
        slots_response = api_client.get(
            f"{BASE_URL}/api/appointments/slots", headers=auth_headers
        )
        slot = slots_response.json()[0]
        book_response = api_client.post(
            f"{BASE_URL}/api/appointments",
            json={
                "slot_id": slot["id"],
                "doctor": slot["doctor"],
                "date": slot["date"],
                "time": slot["time"],
            },
            headers=auth_headers,
        )
        booking_id = book_response.json()["id"]
        # List appointments
        list_response = api_client.get(
            f"{BASE_URL}/api/appointments", headers=auth_headers
        )
        assert list_response.status_code == 200
        appointments = list_response.json()
        assert isinstance(appointments, list)
        assert len(appointments) >= 1
        # Verify our booking is in the list
        assert any(a["id"] == booking_id for a in appointments)
        # Verify sorted by created_at descending (latest first)
        if len(appointments) >= 2:
            assert appointments[0]["created_at"] >= appointments[1]["created_at"]
        print(f"✓ Listed {len(appointments)} appointments")

    def test_book_multiple_appointments(self, api_client, auth_headers):
        """Test booking multiple appointments"""
        slots_response = api_client.get(
            f"{BASE_URL}/api/appointments/slots", headers=auth_headers
        )
        slots = slots_response.json()
        # Book 3 different slots
        for i in range(3):
            slot = slots[i]
            response = api_client.post(
                f"{BASE_URL}/api/appointments",
                json={
                    "slot_id": slot["id"],
                    "doctor": slot["doctor"],
                    "date": slot["date"],
                    "time": slot["time"],
                },
                headers=auth_headers,
            )
            assert response.status_code == 200
        # Verify all bookings
        list_response = api_client.get(
            f"{BASE_URL}/api/appointments", headers=auth_headers
        )
        appointments = list_response.json()
        assert len(appointments) >= 3
        print(f"✓ Booked 3 appointments, total: {len(appointments)}")
