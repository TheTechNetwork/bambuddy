"""
Printer discovery API endpoints.

Provides endpoints for discovering Bambu Lab printers on the local network.
"""

import logging

from fastapi import APIRouter
from pydantic import BaseModel

from backend.app.services.discovery import discovery_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/discovery", tags=["discovery"])


class DiscoveryStatus(BaseModel):
    """Discovery status response."""

    running: bool


class DiscoveredPrinterResponse(BaseModel):
    """Discovered printer response."""

    serial: str
    name: str
    ip_address: str
    model: str | None = None
    discovered_at: str | None = None


@router.get("/status", response_model=DiscoveryStatus)
async def get_discovery_status():
    """Get the current discovery status."""
    return DiscoveryStatus(running=discovery_service.is_running)


@router.post("/start", response_model=DiscoveryStatus)
async def start_discovery(duration: float = 10.0):
    """Start printer discovery.

    Args:
        duration: Discovery duration in seconds (default 10)
    """
    await discovery_service.start(duration=duration)
    return DiscoveryStatus(running=discovery_service.is_running)


@router.post("/stop", response_model=DiscoveryStatus)
async def stop_discovery():
    """Stop printer discovery."""
    await discovery_service.stop()
    return DiscoveryStatus(running=discovery_service.is_running)


@router.get("/printers", response_model=list[DiscoveredPrinterResponse])
async def get_discovered_printers():
    """Get list of discovered printers."""
    return [
        DiscoveredPrinterResponse(
            serial=p.serial,
            name=p.name,
            ip_address=p.ip_address,
            model=p.model,
            discovered_at=p.discovered_at,
        )
        for p in discovery_service.discovered_printers
    ]
