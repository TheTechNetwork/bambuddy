"""
Bambu Lab printer discovery service using SSDP.

Bambu Lab printers advertise themselves via SSDP (Simple Service Discovery Protocol)
on the local network. This service listens for these advertisements and provides
a list of discovered printers.
"""

import asyncio
import logging
import re
import socket
import struct
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)

# SSDP multicast address - Bambu uses port 2021, not standard 1900
SSDP_ADDR = "239.255.255.250"
SSDP_PORT = 2021  # Bambu Lab uses non-standard port

# Bambu Lab SSDP search target
BAMBU_SEARCH_TARGET = "urn:bambulab-com:device:3dprinter:1"

# SSDP M-SEARCH message
SSDP_MSEARCH = (
    "M-SEARCH * HTTP/1.1\r\n"
    f"HOST: {SSDP_ADDR}:{SSDP_PORT}\r\n"
    'MAN: "ssdp:discover"\r\n'
    "MX: 3\r\n"
    f"ST: {BAMBU_SEARCH_TARGET}\r\n"
    "\r\n"
)


@dataclass
class DiscoveredPrinter:
    """Represents a discovered Bambu Lab printer."""

    serial: str
    name: str
    ip_address: str
    model: str | None = None
    discovered_at: str | None = None

    def to_dict(self) -> dict:
        return {
            "serial": self.serial,
            "name": self.name,
            "ip_address": self.ip_address,
            "model": self.model,
            "discovered_at": self.discovered_at,
        }


class PrinterDiscoveryService:
    """Service for discovering Bambu Lab printers on the network."""

    def __init__(self):
        self._discovered: dict[str, DiscoveredPrinter] = {}
        self._running = False
        self._task: asyncio.Task | None = None

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def discovered_printers(self) -> list[DiscoveredPrinter]:
        return list(self._discovered.values())

    def clear(self):
        """Clear discovered printers."""
        self._discovered.clear()

    async def start(self, duration: float = 10.0):
        """Start discovery for a specified duration."""
        if self._running:
            return

        self._running = True
        self._discovered.clear()
        self._task = asyncio.create_task(self._discover(duration))

    async def stop(self):
        """Stop discovery."""
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None

    async def _discover(self, duration: float):
        """Run discovery for the specified duration.

        Bambu printers broadcast NOTIFY messages periodically on port 2021.
        We need to bind to that port and listen for broadcasts.
        """
        sock = None
        try:
            # Create UDP socket for SSDP
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

            # Try to set SO_REUSEPORT if available (Linux/macOS)
            try:
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)
            except (AttributeError, OSError):
                pass

            # Set non-blocking mode
            sock.setblocking(False)

            # Bind to the SSDP port to receive NOTIFY broadcasts from printers
            sock.bind(("", SSDP_PORT))

            # Join multicast group to receive multicast messages
            mreq = struct.pack("4sl", socket.inet_aton(SSDP_ADDR), socket.INADDR_ANY)
            sock.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, mreq)

            # Enable broadcast
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)

            logger.info(f"Starting SSDP discovery on port {SSDP_PORT} for Bambu Lab printers...")

            # Send initial M-SEARCH request to trigger responses
            try:
                sock.sendto(SSDP_MSEARCH.encode(), (SSDP_ADDR, SSDP_PORT))
            except Exception as e:
                logger.debug(f"M-SEARCH send error: {e}")

            start_time = asyncio.get_event_loop().time()
            last_send = start_time

            while self._running and (asyncio.get_event_loop().time() - start_time) < duration:
                # Try to receive data
                try:
                    data, addr = sock.recvfrom(4096)
                    message = data.decode("utf-8", errors="ignore")
                    logger.debug(f"Received from {addr[0]}: {message[:100]}...")
                    self._handle_response(message, addr[0])
                except BlockingIOError:
                    # No data available, that's fine
                    pass
                except Exception as e:
                    logger.debug(f"SSDP receive error: {e}")

                # Re-send M-SEARCH every 3 seconds
                now = asyncio.get_event_loop().time()
                if now - last_send >= 3.0:
                    try:
                        sock.sendto(SSDP_MSEARCH.encode(), (SSDP_ADDR, SSDP_PORT))
                        last_send = now
                    except Exception as e:
                        logger.debug(f"SSDP send error: {e}")

                await asyncio.sleep(0.1)

            logger.info(f"Discovery complete. Found {len(self._discovered)} printers.")

        except OSError as e:
            if e.errno == 98:  # Address already in use
                logger.warning(f"Port {SSDP_PORT} is in use, trying alternative discovery...")
                await self._discover_alternative(duration)
            else:
                logger.error(f"Discovery error: {e}")
        except Exception as e:
            logger.error(f"Discovery error: {e}")
        finally:
            self._running = False
            if sock:
                try:
                    sock.close()
                except Exception:
                    pass

    async def _discover_alternative(self, duration: float):
        """Alternative discovery using a random port (less reliable)."""
        sock = None
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.setblocking(False)
            sock.bind(("", 0))

            # Join multicast group
            mreq = struct.pack("4sl", socket.inet_aton(SSDP_ADDR), socket.INADDR_ANY)
            sock.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, mreq)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)

            logger.info("Using alternative discovery method...")

            start_time = asyncio.get_event_loop().time()
            last_send = start_time

            while self._running and (asyncio.get_event_loop().time() - start_time) < duration:
                try:
                    data, addr = sock.recvfrom(4096)
                    self._handle_response(data.decode("utf-8", errors="ignore"), addr[0])
                except BlockingIOError:
                    pass
                except Exception as e:
                    logger.debug(f"SSDP receive error: {e}")

                now = asyncio.get_event_loop().time()
                if now - last_send >= 2.0:
                    try:
                        sock.sendto(SSDP_MSEARCH.encode(), (SSDP_ADDR, SSDP_PORT))
                        last_send = now
                    except Exception:
                        pass

                await asyncio.sleep(0.1)

            logger.info(f"Alternative discovery complete. Found {len(self._discovered)} printers.")
        except Exception as e:
            logger.error(f"Alternative discovery error: {e}")
        finally:
            if sock:
                try:
                    sock.close()
                except Exception:
                    pass

    def _handle_response(self, response: str, ip_address: str):
        """Parse SSDP response and extract printer info."""
        # Check if it's a Bambu Lab printer response
        if BAMBU_SEARCH_TARGET not in response and "bambulab" not in response.lower():
            logger.debug(f"Ignoring non-Bambu response from {ip_address}")
            return

        # Extract USN (Unique Service Name) which contains the serial
        # Bambu format is just "USN: SERIALNUMBER" (no uuid: prefix)
        usn_match = re.search(r"USN:\s*(?:uuid:)?([^\s\r\n]+)", response, re.IGNORECASE)
        if not usn_match:
            logger.debug(f"No USN found in response from {ip_address}")
            return

        serial = usn_match.group(1).strip()

        # Extract device name from LOCATION or DevName header
        name = serial  # Default to serial if no name found
        name_match = re.search(r"DevName\.bambu\.com:\s*(.+?)(?:\r\n|\n|$)", response, re.IGNORECASE)
        if name_match:
            name = name_match.group(1).strip()

        # Try to extract model from DevModel header
        model = None
        model_match = re.search(r"DevModel\.bambu\.com:\s*(.+?)(?:\r\n|\n|$)", response, re.IGNORECASE)
        if model_match:
            model = model_match.group(1).strip()

        # Also try NT header for model
        if not model:
            nt_match = re.search(r"NT:\s*urn:bambulab-com:device:([^:]+)", response, re.IGNORECASE)
            if nt_match:
                model = nt_match.group(1).strip()

        # Skip if already discovered
        if serial in self._discovered:
            return

        printer = DiscoveredPrinter(
            serial=serial,
            name=name,
            ip_address=ip_address,
            model=model,
            discovered_at=datetime.now().isoformat(),
        )

        self._discovered[serial] = printer
        logger.info(f"Discovered printer: {name} ({serial}) at {ip_address}")


# Global discovery service instance
discovery_service = PrinterDiscoveryService()
