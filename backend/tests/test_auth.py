import os

os.environ.setdefault("TEST_DATABASE_URL", "sqlite:///./test_auth.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key")

from fastapi.testclient import TestClient

from app.main import app
from app.db.session import SessionLocal
from app.models.user import User

client = TestClient(app)


def reset_db():
    db = SessionLocal()
    try:
        db.query(User).delete()
        db.commit()
    finally:
        db.close()


def test_register_and_login_success():
    reset_db()
    payload = {
        "full_name": "Alice Carter",
        "email": "alice@example.com",
        "password": "StrongPass!123",
        "password_confirm": "StrongPass!123",
    }

    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["user"]["email"] == "alice@example.com"

    login = client.post(
        "/api/auth/login",
        json={"email": "alice@example.com", "password": "StrongPass!123"},
    )
    assert login.status_code == 200, login.text
    assert login.json()["user"]["email"] == "alice@example.com"
    assert "access_token" in login.json()


def test_duplicate_email_registration_is_rejected():
    reset_db()
    payload = {
        "full_name": "Bob Smith",
        "email": "bob@example.com",
        "password": "StrongPass!123",
        "password_confirm": "StrongPass!123",
    }
    first = client.post("/api/auth/register", json=payload)
    assert first.status_code == 201

    second = client.post("/api/auth/register", json=payload)
    assert second.status_code == 400
    assert second.json()["detail"] == "Email already registered."


def test_invalid_registration_input_is_rejected():
    reset_db()
    response = client.post(
        "/api/auth/register",
        json={
            "full_name": "A",
            "email": "invalid-email",
            "password": "short",
            "password_confirm": "different",
        },
    )
    assert response.status_code == 422


def test_login_with_invalid_credentials_is_generic():
    reset_db()
    register = client.post(
        "/api/auth/register",
        json={
            "full_name": "Charlie Brown",
            "email": "charlie@example.com",
            "password": "StrongPass!123",
            "password_confirm": "StrongPass!123",
        },
    )
    assert register.status_code == 201

    login = client.post(
        "/api/auth/login",
        json={"email": "charlie@example.com", "password": "WrongPass!123"},
    )
    assert login.status_code == 401
    assert login.json()["detail"] == "Invalid email or password."


def test_protected_route_requires_authentication():
    reset_db()
    response = client.get("/api/users/me")
    assert response.status_code == 401


def test_profile_retrieval_and_update_for_authenticated_user():
    reset_db()
    register = client.post(
        "/api/auth/register",
        json={
            "full_name": "Diana Ross",
            "email": "diana@example.com",
            "password": "StrongPass!123",
            "password_confirm": "StrongPass!123",
        },
    )
    token = register.json()["tokens"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    me = client.get("/api/users/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email"] == "diana@example.com"

    updated = client.patch(
        "/api/users/me",
        headers=headers,
        json={"full_name": "Diana Smith"},
    )
    assert updated.status_code == 200
    assert updated.json()["full_name"] == "Diana Smith"


def test_logout_revokes_session():
    reset_db()
    register = client.post(
        "/api/auth/register",
        json={
            "full_name": "Ethan Hunt",
            "email": "ethan@example.com",
            "password": "StrongPass!123",
            "password_confirm": "StrongPass!123",
        },
    )
    access_token = register.json()["tokens"]["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    logout = client.post("/api/auth/logout", headers=headers)
    assert logout.status_code == 200

    me = client.get("/api/users/me", headers=headers)
    assert me.status_code == 401
