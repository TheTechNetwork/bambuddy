"""Anonymous telemetry service for BamBuddy."""

import asyncio
import logging
import uuid
from datetime import datetime, timedelta

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import APP_VERSION
from backend.app.models.printer import Printer
from backend.app.models.settings import Settings

logger = logging.getLogger(__name__)

# Default telemetry server URL (can be overridden via settings)
DEFAULT_TELEMETRY_URL = "https://telemetry.bambuddy.cool"

# How often to send heartbeats (once per day)
HEARTBEAT_INTERVAL = timedelta(hours=24)

_last_heartbeat: datetime | None = None


async def get_or_create_installation_id(db: AsyncSession) -> str:
    """Get existing installation ID or create a new one."""
    result = await db.execute(select(Settings).where(Settings.key == "installation_id"))
    setting = result.scalar_one_or_none()

    if setting:
        return setting.value

    # Generate new UUID
    installation_id = str(uuid.uuid4())

    # Save to database
    new_setting = Settings(key="installation_id", value=installation_id)
    db.add(new_setting)
    await db.commit()

    logger.info(f"Generated new installation ID: {installation_id[:8]}...")
    return installation_id


async def is_telemetry_enabled(db: AsyncSession) -> bool:
    """Check if telemetry is enabled (opt-in model)."""
    result = await db.execute(select(Settings).where(Settings.key == "telemetry_enabled"))
    setting = result.scalar_one_or_none()

    # Default to disabled (opt-in model)
    if not setting:
        return False

    return setting.value.lower() == "true"


async def get_telemetry_url(db: AsyncSession) -> str:
    """Get telemetry server URL from settings."""
    result = await db.execute(select(Settings).where(Settings.key == "telemetry_url"))
    setting = result.scalar_one_or_none()

    return setting.value if setting else DEFAULT_TELEMETRY_URL


async def get_printer_model_counts(db: AsyncSession) -> dict[str, int]:
    """Get count of each printer model configured in BamBuddy."""
    result = await db.execute(select(Printer.model, func.count(Printer.id)).group_by(Printer.model))
    counts = {}
    for model, count in result.all():
        # Normalize model name (handle None/empty)
        model_name = model if model else "Unknown"
        counts[model_name] = count
    return counts


async def send_heartbeat(db: AsyncSession) -> bool:
    """Send anonymous heartbeat to telemetry server."""
    global _last_heartbeat

    try:
        # Check if telemetry is enabled
        if not await is_telemetry_enabled(db):
            logger.debug("Telemetry disabled, skipping heartbeat")
            return False

        # Rate limit: only send once per day
        if _last_heartbeat and datetime.now() - _last_heartbeat < HEARTBEAT_INTERVAL:
            logger.debug("Heartbeat already sent recently, skipping")
            return True

        installation_id = await get_or_create_installation_id(db)
        telemetry_url = await get_telemetry_url(db)
        printer_models = await get_printer_model_counts(db)

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{telemetry_url}/heartbeat",
                json={
                    "installation_id": installation_id,
                    "version": APP_VERSION,
                    "printer_models": printer_models,
                },
            )
            response.raise_for_status()

        _last_heartbeat = datetime.now()
        logger.info(f"Telemetry heartbeat sent to {telemetry_url}")
        return True

    except httpx.HTTPError as e:
        logger.debug(f"Telemetry heartbeat failed (network): {e}")
        return False
    except Exception as e:
        logger.debug(f"Telemetry heartbeat failed: {e}")
        return False


async def start_telemetry_loop(get_session):
    """Background task to send periodic heartbeats."""
    # Wait a bit before first heartbeat to let app initialize
    await asyncio.sleep(30)

    while True:
        try:
            async with get_session() as db:
                await send_heartbeat(db)
        except Exception as e:
            logger.debug(f"Telemetry loop error: {e}")

        # Check daily
        await asyncio.sleep(HEARTBEAT_INTERVAL.total_seconds())
