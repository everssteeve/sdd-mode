"""Point d'entrée FastAPI — squelette livré par `aiad-sdd new fastapi-aiad`.

@intent INTENT-001
@spec SPEC-001-1-bootstrap
@verified-by tests/test_main.py
"""

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(
    title="{{name}}",
    description="{{description}}",
    version="0.1.0",
)


class GreetResponse(BaseModel):
    message: str


@app.get("/", response_model=GreetResponse)
def racine() -> GreetResponse:
    """Endpoint de santé minimal."""
    return GreetResponse(message="Bonjour, AIAD.")


@app.get("/sante", response_model=GreetResponse)
def sante() -> GreetResponse:
    """Healthcheck pour load balancers / Kubernetes."""
    return GreetResponse(message="ok")
