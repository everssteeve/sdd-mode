"""Tests squelette pour app.main.

@spec SPEC-001-1-bootstrap
"""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_racine_repond_bonjour():
    r = client.get("/")
    assert r.status_code == 200
    assert r.json() == {"message": "Bonjour, AIAD."}


def test_sante_repond_ok():
    r = client.get("/sante")
    assert r.status_code == 200
    assert r.json() == {"message": "ok"}
