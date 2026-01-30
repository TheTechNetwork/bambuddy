"""MQTT Smart Plug Service for subscribing to external MQTT topics and extracting power/energy data.

This service enables integration with Shelly, Zigbee2MQTT, and other MQTT-based energy monitoring devices.
"""

import json
import logging
import threading
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

import paho.mqtt.client as mqtt

logger = logging.getLogger(__name__)


@dataclass
class SmartPlugMQTTData:
    """Latest data received from an MQTT smart plug."""

    plug_id: int
    power: float | None = None  # Current power in watts
    energy: float | None = None  # Energy in kWh (today)
    state: str | None = None  # "ON" or "OFF"
    last_seen: datetime = field(default_factory=datetime.utcnow)


class MQTTSmartPlugService:
    """Subscribes to MQTT topics for smart plug energy monitoring."""

    # Consider plug unreachable if no message received in this time
    REACHABLE_TIMEOUT_MINUTES = 5

    def __init__(self):
        self.client: mqtt.Client | None = None
        self.connected = False
        self._lock = threading.Lock()
        # topic -> list of plug_ids (multiple plugs can subscribe to same topic with different paths)
        self.subscriptions: dict[str, list[int]] = {}
        # plug_id -> (topic, power_path, energy_path, state_path, multiplier)
        self.plug_configs: dict[int, tuple[str, str | None, str | None, str | None, float]] = {}
        # plug_id -> latest data
        self.plug_data: dict[int, SmartPlugMQTTData] = {}
        self._configured = False
        self._broker = ""
        self._port = 1883
        self._username = ""
        self._password = ""
        self._use_tls = False

    def is_configured(self) -> bool:
        """Check if the MQTT service is configured and connected."""
        return self._configured and self.connected

    def has_broker_settings(self) -> bool:
        """Check if broker settings are available (even if not connected yet)."""
        return bool(self._broker)

    async def configure(self, settings: dict) -> bool:
        """Configure MQTT connection from settings.

        Uses the same broker settings as the MQTT relay service.
        Returns True if connection was successful or MQTT is disabled.
        """
        enabled = settings.get("mqtt_enabled", False)

        if not enabled:
            await self.disconnect()
            self._configured = False
            logger.debug("MQTT smart plug service disabled (MQTT relay not enabled)")
            return True

        broker = settings.get("mqtt_broker", "")
        port = settings.get("mqtt_port", 1883)
        username = settings.get("mqtt_username", "")
        password = settings.get("mqtt_password", "")
        use_tls = settings.get("mqtt_use_tls", False)

        if not broker:
            logger.warning("MQTT smart plug service: no broker configured")
            self._configured = False
            return False

        # Check if settings changed
        settings_changed = (
            self._broker != broker
            or self._port != port
            or self._username != username
            or self._password != password
            or self._use_tls != use_tls
        )

        self._broker = broker
        self._port = port
        self._username = username
        self._password = password
        self._use_tls = use_tls
        self._configured = True

        # Disconnect and reconnect if settings changed
        if settings_changed and self.client:
            await self.disconnect()

        # Connect if not already connected
        if not self.client or not self.connected:
            return await self._connect()

        return True

    async def _connect(self) -> bool:
        """Establish MQTT connection."""
        import asyncio
        import ssl

        try:
            # Create client with callback API version 2
            self.client = mqtt.Client(
                callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
                client_id=f"bambuddy-smartplug-{id(self)}",
                protocol=mqtt.MQTTv311,
            )

            # Set up callbacks
            self.client.on_connect = self._on_connect
            self.client.on_disconnect = self._on_disconnect
            self.client.on_message = self._on_message

            # Configure authentication
            if self._username:
                self.client.username_pw_set(self._username, self._password)

            # Configure TLS
            if self._use_tls:
                self.client.tls_set(cert_reqs=ssl.CERT_NONE)
                self.client.tls_insecure_set(True)

            # Connect with timeout
            try:
                await asyncio.wait_for(
                    asyncio.to_thread(self.client.connect_async, self._broker, self._port, 60),
                    timeout=3.0,
                )
            except TimeoutError:
                logger.warning(f"MQTT smart plug connection to {self._broker}:{self._port} timed out")
                return False

            self.client.loop_start()

            # Wait briefly for connection
            await asyncio.sleep(1.0)

            if self.connected:
                logger.info(f"MQTT smart plug service connected to {self._broker}:{self._port}")
                # Resubscribe to all topics
                self._resubscribe_all()
                return True
            else:
                logger.warning(f"MQTT smart plug connection pending to {self._broker}:{self._port}")
                return True  # Connection is async

        except Exception as e:
            logger.error(f"MQTT smart plug connection failed: {e}")
            self.connected = False
            return False

    def _on_connect(
        self,
        client: mqtt.Client,
        userdata: Any,
        flags: dict,
        reason_code: int | mqtt.ReasonCode,
        properties: mqtt.Properties | None = None,
    ):
        """Callback when connected to broker."""
        rc = reason_code if isinstance(reason_code, int) else reason_code.value
        if rc == 0:
            self.connected = True
            logger.info("MQTT smart plug service connected successfully")
            # Resubscribe to all topics
            self._resubscribe_all()
        else:
            self.connected = False
            logger.error(f"MQTT smart plug connection failed: {reason_code}")

    def _on_disconnect(
        self,
        client: mqtt.Client,
        userdata: Any,
        flags_or_rc: dict | int | mqtt.ReasonCode,
        reason_code: int | mqtt.ReasonCode | None = None,
        properties: mqtt.Properties | None = None,
    ):
        """Callback when disconnected from broker."""
        self.connected = False
        rc = reason_code if reason_code is not None else flags_or_rc
        rc_val = rc if isinstance(rc, int) else getattr(rc, "value", 0)
        if rc_val != 0:
            logger.warning(f"MQTT smart plug service disconnected: {rc}")
        else:
            logger.info("MQTT smart plug service disconnected cleanly")

    def _on_message(self, client: mqtt.Client, userdata: Any, msg: mqtt.MQTTMessage):
        """Handle incoming MQTT message, extract data using JSON path."""
        topic = msg.topic

        with self._lock:
            plug_ids = self.subscriptions.get(topic, [])
            if not plug_ids:
                return

            # Parse JSON payload
            try:
                payload = json.loads(msg.payload.decode("utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError) as e:
                logger.debug(f"MQTT smart plug: failed to parse message on {topic}: {e}")
                return

            # Process for each subscribed plug
            for plug_id in plug_ids:
                config = self.plug_configs.get(plug_id)
                if not config:
                    continue

                _, power_path, energy_path, state_path, multiplier = config

                # Extract values
                power = None
                energy = None
                state = None

                if power_path:
                    raw_power = self._extract_json_path(payload, power_path)
                    if raw_power is not None:
                        try:
                            power = float(raw_power) * multiplier
                        except (ValueError, TypeError):
                            pass

                if energy_path:
                    raw_energy = self._extract_json_path(payload, energy_path)
                    if raw_energy is not None:
                        try:
                            energy = float(raw_energy) * multiplier
                        except (ValueError, TypeError):
                            pass

                if state_path:
                    raw_state = self._extract_json_path(payload, state_path)
                    if raw_state is not None:
                        # Normalize state to ON/OFF
                        state_str = str(raw_state).upper()
                        if state_str in ("ON", "1", "TRUE"):
                            state = "ON"
                        elif state_str in ("OFF", "0", "FALSE"):
                            state = "OFF"
                        else:
                            state = state_str

                # Update plug data
                if plug_id in self.plug_data:
                    data = self.plug_data[plug_id]
                    if power is not None:
                        data.power = power
                    if energy is not None:
                        data.energy = energy
                    if state is not None:
                        data.state = state
                    data.last_seen = datetime.utcnow()
                else:
                    self.plug_data[plug_id] = SmartPlugMQTTData(
                        plug_id=plug_id,
                        power=power,
                        energy=energy,
                        state=state,
                        last_seen=datetime.utcnow(),
                    )

                logger.debug(f"MQTT smart plug {plug_id}: power={power}, energy={energy}, state={state}")

    def _extract_json_path(self, data: dict, path: str) -> Any:
        """Extract value using dot notation (e.g., 'power_l1' or 'data.power').

        Supports simple dot notation for nested objects.
        """
        if not path:
            return None

        parts = path.split(".")
        current = data

        for part in parts:
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return None

        return current

    def _resubscribe_all(self):
        """Resubscribe to all registered topics after reconnection."""
        if not self.client or not self.connected:
            return

        with self._lock:
            for topic in self.subscriptions:
                try:
                    self.client.subscribe(topic, qos=1)
                    logger.debug(f"MQTT smart plug: resubscribed to {topic}")
                except Exception as e:
                    logger.error(f"MQTT smart plug: failed to resubscribe to {topic}: {e}")

    def subscribe(
        self,
        plug_id: int,
        topic: str,
        power_path: str | None = None,
        energy_path: str | None = None,
        state_path: str | None = None,
        multiplier: float = 1.0,
    ):
        """Subscribe to a topic for a plug."""
        with self._lock:
            # Store configuration
            self.plug_configs[plug_id] = (topic, power_path, energy_path, state_path, multiplier)

            # Add to subscriptions
            if topic not in self.subscriptions:
                self.subscriptions[topic] = []
                # Actually subscribe if connected
                if self.client and self.connected:
                    try:
                        self.client.subscribe(topic, qos=1)
                        logger.info(f"MQTT smart plug {plug_id}: subscribed to {topic}")
                    except Exception as e:
                        logger.error(f"MQTT smart plug: failed to subscribe to {topic}: {e}")

            if plug_id not in self.subscriptions[topic]:
                self.subscriptions[topic].append(plug_id)

            # Initialize data entry
            if plug_id not in self.plug_data:
                self.plug_data[plug_id] = SmartPlugMQTTData(plug_id=plug_id)

    def unsubscribe(self, plug_id: int):
        """Unsubscribe when plug is deleted/updated."""
        with self._lock:
            # Get the topic for this plug
            config = self.plug_configs.pop(plug_id, None)
            if not config:
                return

            topic = config[0]

            # Remove from subscriptions
            if topic in self.subscriptions:
                if plug_id in self.subscriptions[topic]:
                    self.subscriptions[topic].remove(plug_id)

                # If no more plugs on this topic, unsubscribe
                if not self.subscriptions[topic]:
                    del self.subscriptions[topic]
                    if self.client and self.connected:
                        try:
                            self.client.unsubscribe(topic)
                            logger.info(f"MQTT smart plug: unsubscribed from {topic}")
                        except Exception as e:
                            logger.error(f"MQTT smart plug: failed to unsubscribe from {topic}: {e}")

            # Remove data
            self.plug_data.pop(plug_id, None)

    def get_plug_data(self, plug_id: int) -> SmartPlugMQTTData | None:
        """Get latest data for a plug (called by status endpoint)."""
        with self._lock:
            return self.plug_data.get(plug_id)

    def is_reachable(self, plug_id: int) -> bool:
        """Check if a plug has received data recently."""
        data = self.get_plug_data(plug_id)
        if not data:
            return False

        timeout = timedelta(minutes=self.REACHABLE_TIMEOUT_MINUTES)
        return datetime.utcnow() - data.last_seen < timeout

    async def disconnect(self):
        """Disconnect from MQTT broker."""
        if self.client:
            try:
                self.client.loop_stop()
                self.client.disconnect()
            except Exception as e:
                logger.debug(f"MQTT smart plug disconnect error (ignored): {e}")
            finally:
                self.client = None
                self.connected = False


# Global instance
mqtt_smart_plug_service = MQTTSmartPlugService()
