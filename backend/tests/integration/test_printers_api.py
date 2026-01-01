"""Integration tests for Printers API endpoints.

Tests the full request/response cycle for /api/v1/printers/ endpoints.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient


class TestPrintersAPI:
    """Integration tests for /api/v1/printers/ endpoints."""

    # ========================================================================
    # List endpoints
    # ========================================================================

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_list_printers_empty(self, async_client: AsyncClient):
        """Verify empty list is returned when no printers exist."""
        response = await async_client.get("/api/v1/printers/")

        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_list_printers_with_data(self, async_client: AsyncClient, printer_factory, db_session):
        """Verify list returns existing printers."""
        await printer_factory(name="Test Printer")

        response = await async_client.get("/api/v1/printers/")

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert any(p["name"] == "Test Printer" for p in data)

    # ========================================================================
    # Create endpoints
    # ========================================================================

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_create_printer(self, async_client: AsyncClient):
        """Verify printer can be created."""
        data = {
            "name": "New Printer",
            "serial_number": "00M09A111111111",
            "ip_address": "192.168.1.100",
            "access_code": "12345678",
            "is_active": True,
            "model": "X1C",
        }

        response = await async_client.post("/api/v1/printers/", json=data)

        assert response.status_code == 200
        result = response.json()
        assert result["name"] == "New Printer"
        assert result["serial_number"] == "00M09A111111111"
        assert result["model"] == "X1C"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_create_printer_duplicate_serial(self, async_client: AsyncClient, printer_factory, db_session):
        """Verify duplicate serial number is rejected."""
        await printer_factory(serial_number="00M09A222222222")

        data = {
            "name": "Duplicate Printer",
            "serial_number": "00M09A222222222",
            "ip_address": "192.168.1.101",
            "access_code": "12345678",
        }

        response = await async_client.post("/api/v1/printers/", json=data)

        # Should fail due to duplicate serial
        assert response.status_code in [400, 409, 422, 500]

    # ========================================================================
    # Get single endpoint
    # ========================================================================

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_get_printer(self, async_client: AsyncClient, printer_factory, db_session):
        """Verify single printer can be retrieved."""
        printer = await printer_factory(name="Get Test Printer")

        response = await async_client.get(f"/api/v1/printers/{printer.id}")

        assert response.status_code == 200
        result = response.json()
        assert result["id"] == printer.id
        assert result["name"] == "Get Test Printer"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_get_printer_not_found(self, async_client: AsyncClient):
        """Verify 404 for non-existent printer."""
        response = await async_client.get("/api/v1/printers/9999")

        assert response.status_code == 404

    # ========================================================================
    # Update endpoints
    # ========================================================================

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_update_printer_name(self, async_client: AsyncClient, printer_factory, db_session):
        """Verify printer name can be updated."""
        printer = await printer_factory(name="Original Name")

        response = await async_client.patch(f"/api/v1/printers/{printer.id}", json={"name": "Updated Name"})

        assert response.status_code == 200
        assert response.json()["name"] == "Updated Name"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_update_printer_active_status(self, async_client: AsyncClient, printer_factory, db_session):
        """Verify printer active status can be updated."""
        printer = await printer_factory(is_active=True)

        response = await async_client.patch(f"/api/v1/printers/{printer.id}", json={"is_active": False})

        assert response.status_code == 200
        assert response.json()["is_active"] is False

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_update_printer_auto_archive(self, async_client: AsyncClient, printer_factory, db_session):
        """Verify auto_archive setting can be updated."""
        printer = await printer_factory(auto_archive=True)

        response = await async_client.patch(f"/api/v1/printers/{printer.id}", json={"auto_archive": False})

        assert response.status_code == 200
        assert response.json()["auto_archive"] is False

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_update_nonexistent_printer(self, async_client: AsyncClient):
        """Verify updating non-existent printer returns 404."""
        response = await async_client.patch("/api/v1/printers/9999", json={"name": "New Name"})

        assert response.status_code == 404

    # ========================================================================
    # Delete endpoints
    # ========================================================================

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_delete_printer(self, async_client: AsyncClient, printer_factory, db_session):
        """Verify printer can be deleted."""
        printer = await printer_factory()
        printer_id = printer.id

        response = await async_client.delete(f"/api/v1/printers/{printer_id}")

        assert response.status_code == 200

        # Verify deleted
        response = await async_client.get(f"/api/v1/printers/{printer_id}")
        assert response.status_code == 404

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_delete_nonexistent_printer(self, async_client: AsyncClient):
        """Verify deleting non-existent printer returns 404."""
        response = await async_client.delete("/api/v1/printers/9999")

        assert response.status_code == 404

    # ========================================================================
    # Status endpoint
    # ========================================================================

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_get_printer_status(
        self, async_client: AsyncClient, printer_factory, mock_printer_manager, db_session
    ):
        """Verify printer status can be retrieved."""
        printer = await printer_factory()

        response = await async_client.get(f"/api/v1/printers/{printer.id}/status")

        assert response.status_code == 200
        result = response.json()
        assert "connected" in result
        assert "state" in result

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_get_printer_status_not_found(self, async_client: AsyncClient):
        """Verify 404 for status of non-existent printer."""
        response = await async_client.get("/api/v1/printers/9999/status")

        assert response.status_code == 404

    # ========================================================================
    # Test connection endpoint
    # ========================================================================


class TestPrinterDataIntegrity:
    """Tests for printer data integrity."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_printer_stores_all_fields(self, async_client: AsyncClient, printer_factory, db_session):
        """Verify printer stores all fields correctly."""
        printer = await printer_factory(
            name="Full Test Printer",
            serial_number="00M09A444444444",
            ip_address="192.168.1.150",
            model="P1S",
            is_active=True,
            auto_archive=False,
        )

        response = await async_client.get(f"/api/v1/printers/{printer.id}")

        assert response.status_code == 200
        result = response.json()
        assert result["name"] == "Full Test Printer"
        assert result["serial_number"] == "00M09A444444444"
        assert result["ip_address"] == "192.168.1.150"
        assert result["model"] == "P1S"
        assert result["is_active"] is True
        assert result["auto_archive"] is False

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_printer_update_persists(self, async_client: AsyncClient, printer_factory, db_session):
        """CRITICAL: Verify printer updates persist."""
        printer = await printer_factory(name="Original", is_active=True)

        # Update
        await async_client.patch(f"/api/v1/printers/{printer.id}", json={"name": "Updated", "is_active": False})

        # Verify persistence
        response = await async_client.get(f"/api/v1/printers/{printer.id}")
        result = response.json()
        assert result["name"] == "Updated"
        assert result["is_active"] is False

    # ========================================================================
    # Refresh status endpoint
    # ========================================================================

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_refresh_status_not_found(self, async_client: AsyncClient):
        """Verify 404 for non-existent printer."""
        response = await async_client.post("/api/v1/printers/99999/refresh-status")
        assert response.status_code == 404

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_refresh_status_not_connected(self, async_client: AsyncClient, printer_factory):
        """Verify 400 when printer is not connected."""
        printer = await printer_factory(name="Disconnected Printer")

        with patch("backend.app.api.routes.printers.printer_manager") as mock_pm:
            mock_pm.request_status_update.return_value = False

            response = await async_client.post(f"/api/v1/printers/{printer.id}/refresh-status")

            assert response.status_code == 400
            assert "not connected" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_refresh_status_success(self, async_client: AsyncClient, printer_factory):
        """Verify successful refresh request."""
        printer = await printer_factory(name="Connected Printer")

        with patch("backend.app.api.routes.printers.printer_manager") as mock_pm:
            mock_pm.request_status_update.return_value = True

            response = await async_client.post(f"/api/v1/printers/{printer.id}/refresh-status")

            assert response.status_code == 200
            assert response.json()["status"] == "refresh_requested"
            mock_pm.request_status_update.assert_called_once_with(printer.id)


class TestPrintControlAPI:
    """Integration tests for print control endpoints (stop, pause, resume)."""

    # ========================================================================
    # Stop print endpoint
    # ========================================================================

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_stop_print_not_found(self, async_client: AsyncClient):
        """Verify 404 for non-existent printer."""
        response = await async_client.post("/api/v1/printers/99999/print/stop")
        assert response.status_code == 404

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_stop_print_not_connected(self, async_client: AsyncClient, printer_factory):
        """Verify error when printer is not connected."""
        printer = await printer_factory(name="Disconnected Printer")

        with patch("backend.app.api.routes.printers.printer_manager") as mock_pm:
            mock_pm.get_client.return_value = None

            response = await async_client.post(f"/api/v1/printers/{printer.id}/print/stop")

            assert response.status_code == 400
            assert "not connected" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_stop_print_success(self, async_client: AsyncClient, printer_factory):
        """Verify successful stop print request."""
        printer = await printer_factory(name="Printing Printer")

        mock_client = MagicMock()
        mock_client.stop_print.return_value = True

        with patch("backend.app.api.routes.printers.printer_manager") as mock_pm:
            mock_pm.get_client.return_value = mock_client

            response = await async_client.post(f"/api/v1/printers/{printer.id}/print/stop")

            assert response.status_code == 200
            assert response.json()["success"] is True
            mock_client.stop_print.assert_called_once()

    # ========================================================================
    # Pause print endpoint
    # ========================================================================

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_pause_print_not_found(self, async_client: AsyncClient):
        """Verify 404 for non-existent printer."""
        response = await async_client.post("/api/v1/printers/99999/print/pause")
        assert response.status_code == 404

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_pause_print_not_connected(self, async_client: AsyncClient, printer_factory):
        """Verify error when printer is not connected."""
        printer = await printer_factory(name="Disconnected Printer")

        with patch("backend.app.api.routes.printers.printer_manager") as mock_pm:
            mock_pm.get_client.return_value = None

            response = await async_client.post(f"/api/v1/printers/{printer.id}/print/pause")

            assert response.status_code == 400
            assert "not connected" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_pause_print_success(self, async_client: AsyncClient, printer_factory):
        """Verify successful pause print request."""
        printer = await printer_factory(name="Printing Printer")

        mock_client = MagicMock()
        mock_client.pause_print.return_value = True

        with patch("backend.app.api.routes.printers.printer_manager") as mock_pm:
            mock_pm.get_client.return_value = mock_client

            response = await async_client.post(f"/api/v1/printers/{printer.id}/print/pause")

            assert response.status_code == 200
            assert response.json()["success"] is True
            mock_client.pause_print.assert_called_once()

    # ========================================================================
    # Resume print endpoint
    # ========================================================================

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_resume_print_not_found(self, async_client: AsyncClient):
        """Verify 404 for non-existent printer."""
        response = await async_client.post("/api/v1/printers/99999/print/resume")
        assert response.status_code == 404

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_resume_print_not_connected(self, async_client: AsyncClient, printer_factory):
        """Verify error when printer is not connected."""
        printer = await printer_factory(name="Disconnected Printer")

        with patch("backend.app.api.routes.printers.printer_manager") as mock_pm:
            mock_pm.get_client.return_value = None

            response = await async_client.post(f"/api/v1/printers/{printer.id}/print/resume")

            assert response.status_code == 400
            assert "not connected" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_resume_print_success(self, async_client: AsyncClient, printer_factory):
        """Verify successful resume print request."""
        printer = await printer_factory(name="Paused Printer")

        mock_client = MagicMock()
        mock_client.resume_print.return_value = True

        with patch("backend.app.api.routes.printers.printer_manager") as mock_pm:
            mock_pm.get_client.return_value = mock_client

            response = await async_client.post(f"/api/v1/printers/{printer.id}/print/resume")

            assert response.status_code == 200
            assert response.json()["success"] is True
            mock_client.resume_print.assert_called_once()


class TestAMSRefreshAPI:
    """Integration tests for AMS slot refresh endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_ams_refresh_not_found(self, async_client: AsyncClient):
        """Verify 404 for non-existent printer."""
        response = await async_client.post("/api/v1/printers/99999/ams/0/slot/0/refresh")
        assert response.status_code == 404

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_ams_refresh_not_connected(self, async_client: AsyncClient, printer_factory):
        """Verify error when printer is not connected."""
        printer = await printer_factory(name="Disconnected Printer")

        with patch("backend.app.api.routes.printers.printer_manager") as mock_pm:
            mock_pm.get_client.return_value = None

            response = await async_client.post(f"/api/v1/printers/{printer.id}/ams/0/slot/0/refresh")

            assert response.status_code == 400
            assert "not connected" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_ams_refresh_success(self, async_client: AsyncClient, printer_factory):
        """Verify successful AMS refresh request."""
        printer = await printer_factory(name="Printer with AMS")

        mock_client = MagicMock()
        mock_client.ams_refresh_tray.return_value = (True, "Refreshing AMS 0 tray 1")

        with patch("backend.app.api.routes.printers.printer_manager") as mock_pm:
            mock_pm.get_client.return_value = mock_client

            response = await async_client.post(f"/api/v1/printers/{printer.id}/ams/0/slot/1/refresh")

            assert response.status_code == 200
            result = response.json()
            assert result["success"] is True
            mock_client.ams_refresh_tray.assert_called_once_with(0, 1)

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_ams_refresh_filament_loaded(self, async_client: AsyncClient, printer_factory):
        """Verify error when filament is loaded (can't refresh while loaded)."""
        printer = await printer_factory(name="Printer with AMS")

        mock_client = MagicMock()
        mock_client.ams_refresh_tray.return_value = (False, "Please unload filament first")

        with patch("backend.app.api.routes.printers.printer_manager") as mock_pm:
            mock_pm.get_client.return_value = mock_client

            response = await async_client.post(f"/api/v1/printers/{printer.id}/ams/0/slot/0/refresh")

            assert response.status_code == 400
            assert "unload" in response.json()["detail"].lower()
