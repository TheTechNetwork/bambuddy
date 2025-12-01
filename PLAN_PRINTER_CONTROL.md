# Full Printer Control - Implementation Plan

## Overview

Add a dedicated **Control Page** (`/control`) with full printer control capabilities, including:
- Live camera feed
- Print control (pause/resume/stop)
- Temperature control (bed, nozzle, chamber)
- Speed adjustment
- Fan control
- Light control
- Axis movement
- AMS visualization and operations

---

## Phase 1: Backend - MQTT Control Commands

### 1.1 Add Control Methods to `bambu_mqtt.py`

```python
# Print Control
async def pause_print(self) -> bool
async def resume_print(self) -> bool
# stop_print() already exists

# Temperature Control
async def set_bed_temperature(self, target: int) -> bool
async def set_nozzle_temperature(self, target: int, nozzle: int = 0) -> bool

# Speed Control
async def set_print_speed(self, mode: int) -> bool  # 1=silent, 2=standard, 3=sport, 4=ludicrous

# Fan Control
async def set_part_fan(self, speed: int) -> bool  # 0-255
async def set_aux_fan(self, speed: int) -> bool   # 0-255
async def set_chamber_fan(self, speed: int) -> bool  # 0-255

# Light Control
async def set_chamber_light(self, on: bool) -> bool

# Movement Control
async def home_axes(self, axes: str = "XYZ") -> bool
async def move_axis(self, axis: str, distance: float, speed: int = 3000) -> bool
async def disable_motors(self) -> bool

# AMS Control
async def ams_load_filament(self, tray_id: int) -> bool
async def ams_unload_filament(self) -> bool

# G-code
async def send_gcode(self, gcode: str) -> bool
```

### 1.2 MQTT Command Formats

| Command | JSON Payload |
|---------|-------------|
| Pause | `{"print": {"sequence_id": "0", "command": "pause"}}` |
| Resume | `{"print": {"sequence_id": "0", "command": "resume"}}` |
| Bed Temp | `{"print": {"sequence_id": "0", "command": "gcode_line", "param": "M140 S{temp}"}}` |
| Nozzle Temp | `{"print": {"sequence_id": "0", "command": "gcode_line", "param": "M104 S{temp}"}}` |
| Print Speed | `{"print": {"sequence_id": "0", "command": "print_speed", "param": "{1-4}"}}` |
| Fan (P1=part, P2=aux, P3=chamber) | `{"print": {"sequence_id": "0", "command": "gcode_line", "param": "M106 P{n} S{0-255}"}}` |
| Light On | `{"system": {"sequence_id": "0", "command": "ledctrl", "led_node": "chamber_light", "led_mode": "on", ...}}` |
| Home | `{"print": {"sequence_id": "0", "command": "gcode_line", "param": "G28 {axes}"}}` |
| Move | `{"print": {"sequence_id": "0", "command": "gcode_line", "param": "G91\nG0 {axis}{dist} F{speed}\nG90"}}` |
| AMS Load | `{"print": {"sequence_id": "0", "command": "ams_change_filament", "target": {tray_id}}}` |
| AMS Unload | `{"print": {"sequence_id": "0", "command": "ams_change_filament", "target": 255}}` |

### 1.3 Model-Specific Handling

- **P1/A1 series**: Use blocking temp commands (M109/M190) instead of M104/M140
- **H2D**: Handle dual nozzle targeting
- Store printer model in status for frontend to adapt UI

---

## Phase 2: Backend - Control API Endpoints

### 2.1 New Routes in `backend/app/api/routes/printer_control.py`

```python
# Print Control
POST /api/v1/printers/{id}/control/pause
POST /api/v1/printers/{id}/control/resume
POST /api/v1/printers/{id}/control/stop

# Temperature
POST /api/v1/printers/{id}/control/temperature/bed
  Body: {"target": 60}
POST /api/v1/printers/{id}/control/temperature/nozzle
  Body: {"target": 200, "nozzle": 0}

# Speed
POST /api/v1/printers/{id}/control/speed
  Body: {"mode": 2}  # 1-4

# Fans
POST /api/v1/printers/{id}/control/fan/part
  Body: {"speed": 255}  # 0-255
POST /api/v1/printers/{id}/control/fan/aux
POST /api/v1/printers/{id}/control/fan/chamber

# Light
POST /api/v1/printers/{id}/control/light
  Body: {"on": true}

# Movement
POST /api/v1/printers/{id}/control/home
  Body: {"axes": "XYZ"}  # optional, default all
POST /api/v1/printers/{id}/control/move
  Body: {"axis": "Z", "distance": 10, "speed": 600}
POST /api/v1/printers/{id}/control/motors/disable

# AMS
POST /api/v1/printers/{id}/control/ams/load
  Body: {"tray_id": 0}
POST /api/v1/printers/{id}/control/ams/unload

# G-code (advanced)
POST /api/v1/printers/{id}/control/gcode
  Body: {"command": "G28"}
```

### 2.2 Safety Confirmations

Commands that need confirmation token (generated and validated server-side):
- `stop` - Aborts print
- `home` while printing - Could cause issues
- `move` while printing - Dangerous
- `motors/disable` - Causes position loss

Flow:
1. Frontend calls endpoint without token
2. Backend returns `{"requires_confirmation": true, "token": "abc123", "warning": "This will abort..."}`
3. Frontend shows confirmation dialog
4. Frontend calls again with `{"confirm_token": "abc123"}`
5. Backend validates token and executes

---

## Phase 3: Backend - Camera Streaming

### 3.1 Streaming Approach

Option A: **MJPEG Stream** (simpler)
- Backend captures RTSP frames via ffmpeg
- Serves as MJPEG stream at `/api/v1/printers/{id}/camera/stream`
- Frontend uses `<img src="...">` with streaming

Option B: **WebSocket Frames** (more control)
- Backend sends JPEG frames via WebSocket
- Frontend renders on canvas
- Allows frame rate control, pause/resume

**Recommended: Option A (MJPEG)** - Simpler, works in all browsers

### 3.2 Implementation

```python
# backend/app/api/routes/camera.py

@router.get("/printers/{printer_id}/camera/stream")
async def camera_stream(printer_id: int):
    """Stream camera as MJPEG"""
    printer = get_printer(printer_id)

    async def generate():
        process = await asyncio.create_subprocess_exec(
            'ffmpeg',
            '-rtsp_transport', 'tcp',
            '-i', f'rtsps://bblp:{printer.access_code}@{printer.ip_address}:{port}/streaming/live/1',
            '-f', 'mjpeg',
            '-q:v', '5',
            '-r', '15',  # 15 fps
            '-',
            stdout=asyncio.subprocess.PIPE
        )

        while True:
            frame = await read_jpeg_frame(process.stdout)
            if not frame:
                break
            yield (
                b'--frame\r\n'
                b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n'
            )

    return StreamingResponse(
        generate(),
        media_type='multipart/x-mixed-replace; boundary=frame'
    )

@router.get("/printers/{printer_id}/camera/snapshot")
async def camera_snapshot(printer_id: int):
    """Get single camera frame"""
    # Use existing camera.py capture_frame logic
```

### 3.3 Camera Ports by Model

| Model | Port | Protocol |
|-------|------|----------|
| X1/X1C/H2D | 322 | RTSPS |
| P1/P1S/P1P | 6000 | RTSPS |
| A1/A1 Mini | 6000 | RTSPS |

---

## Phase 4: Frontend - Control Page

### 4.1 Page Structure

```
/control
├── ControlPage.tsx           # Main page with printer tabs
├── components/
│   ├── CameraFeed.tsx        # Live video stream
│   ├── PrintControls.tsx     # Pause/Resume/Stop + progress
│   ├── TemperaturePanel.tsx  # Bed/Nozzle/Chamber controls
│   ├── SpeedControl.tsx      # Speed mode selector
│   ├── FanControls.tsx       # Part/Aux/Chamber fan sliders
│   ├── LightToggle.tsx       # Chamber light on/off
│   ├── MovementControls.tsx  # Home + XYZ jog buttons
│   ├── AMSPanel.tsx          # AMS visualization + load/unload
│   └── ConfirmDialog.tsx     # Safety confirmation modal
```

### 4.2 Layout (Desktop)

```
┌──────────────────────────────────────────────────────────────────┐
│  [Printer 1] [Printer 2] [Printer 3]                    tabs     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────┐  ┌────────────────────────────────┐│
│  │                         │  │  Print Status                  ││
│  │     Camera Feed         │  │  ┌────────────────────────┐    ││
│  │     (16:9 aspect)       │  │  │ State: RUNNING         │    ││
│  │                         │  │  │ File: benchy.3mf       │    ││
│  │                         │  │  │ Progress: ████████░░ 78%│   ││
│  │                         │  │  │ Layer: 156/200         │    ││
│  │                         │  │  │ Time: 45min remaining  │    ││
│  │                         │  │  └────────────────────────┘    ││
│  │                         │  │                                ││
│  │  [⏸ Pause] [■ Stop]     │  │  [⏸ Pause] [▶ Resume] [■ Stop]││
│  └─────────────────────────┘  └────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────┐  ┌────────────────────────────────┐│
│  │  Temperatures           │  │  Speed & Fans                  ││
│  │  ┌───────────────────┐  │  │  Speed: [Silent][Std][Sport][!]││
│  │  │ 🛏️ Bed             │  │  │                                ││
│  │  │ 60°C → 60°C       │  │  │  Part Fan:    ████████░░ 80%  ││
│  │  │ [-] [target] [+]  │  │  │  Aux Fan:     ░░░░░░░░░░  0%  ││
│  │  ├───────────────────┤  │  │  Chamber Fan: ████░░░░░░ 40%  ││
│  │  │ 🔥 Nozzle          │  │  └────────────────────────────────┘│
│  │  │ 205°C → 210°C     │  │                                    │
│  │  │ [-] [target] [+]  │  │  ┌────────────────────────────────┐│
│  │  ├───────────────────┤  │  │  Movement                      ││
│  │  │ 📦 Chamber: 35°C   │  │  │        [Y+]                   ││
│  │  └───────────────────┘  │  │  [X-]  [Home]  [X+]            ││
│  └─────────────────────────┘  │        [Y-]       [Z+][Z-]     ││
│                               │  [Disable Motors]              ││
│  ┌─────────────────────────┐  └────────────────────────────────┘│
│  │  💡 Light  [ON] / [OFF] │                                    │
│  └─────────────────────────┘                                    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │  AMS                                                         ││
│  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐    [Load] [Unload]             ││
│  │  │ 1  │ │ 2  │ │ 3  │ │ 4  │                                ││
│  │  │ 🔴 │ │ 🔵 │ │ ⚪ │ │ ⬛ │    Selected: Slot 1 (PLA Red)  ││
│  │  │80% │ │45% │ │100%│ │ -- │                                ││
│  │  └────┘ └────┘ └────┘ └────┘                                ││
│  └──────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

### 4.3 Mobile Layout

Stacked vertically:
1. Camera (full width)
2. Print controls
3. Temperatures (collapsible)
4. Speed/Fans (collapsible)
5. Movement (collapsible)
6. AMS (collapsible)

### 4.4 State Management

Use React Query for:
- Printer status (already exists, real-time via WebSocket)
- Control mutations with optimistic updates

```typescript
// Example mutation
const pausePrint = useMutation({
  mutationFn: (printerId: number) =>
    api.post(`/printers/${printerId}/control/pause`),
  onSuccess: () => {
    // Optimistic: printer status will update via WebSocket
  }
});
```

---

## Phase 5: Component Details

### 5.1 CameraFeed Component

```typescript
interface CameraFeedProps {
  printerId: number;
  enabled: boolean;
}

// Features:
// - MJPEG stream from /api/v1/printers/{id}/camera/stream
// - Fallback to static thumbnail if stream fails
// - Loading state with skeleton
// - Click to fullscreen
// - Optional: snapshot button
```

### 5.2 TemperaturePanel Component

```typescript
interface TemperaturePanelProps {
  printerId: number;
  bed: { current: number; target: number };
  nozzle: { current: number; target: number };
  nozzle2?: { current: number; target: number }; // H2D
  chamber?: number;
}

// Features:
// - Visual temperature bars (current vs target)
// - Input field or +/- buttons for target
// - Presets: Off (0), PLA (60/200), PETG (70/230), ABS (90/250)
// - Debounced API calls (don't spam on rapid clicks)
// - Disable controls during print (optional setting)
```

### 5.3 SpeedControl Component

```typescript
// Speed modes as toggle buttons:
// [Silent] [Standard] [Sport] [Ludicrous]
// Visual feedback for current mode
// Warning tooltip for Ludicrous mode
```

### 5.4 FanControls Component

```typescript
// Sliders for each fan (0-100%)
// Convert to 0-255 for API
// Real-time value display
// Disable chamber fan if not available (check model)
```

### 5.5 MovementControls Component

```typescript
// Grid layout:
//        [Y+10] [Y+1]
// [X-10] [X-1] [Home] [X+1] [X+10]
//        [Y-1] [Y-10]
//                    [Z+10] [Z+1] [Z-1] [Z-10]
//
// [Disable Motors] button with confirmation
// Warning: "Movement controls disabled during print" overlay
```

### 5.6 AMSPanel Component

```typescript
// Visual representation matching Bambu style:
// - 4 slots per AMS unit
// - Color-coded by filament
// - Percentage remaining
// - Active slot indicator (animated)
// - Click to select slot
// - [Load Selected] [Unload] buttons
// - Support for external spool indicator
```

---

## Phase 6: Safety Features

### 6.1 Confirmation Dialogs

Required for:
- **Stop Print**: "This will abort the current print. Are you sure?"
- **Home During Print**: "Homing during a print is not recommended. Continue?"
- **Move During Print**: "Manual movement during printing can damage your print. Continue?"
- **Disable Motors**: "This will disable motors and lose position. Home before next print."
- **High Temperatures**: Warning for temps > 260°C nozzle or > 100°C bed

### 6.2 State-Based Disabling

| Control | IDLE | RUNNING | PAUSE | FINISH |
|---------|------|---------|-------|--------|
| Pause | ❌ | ✅ | ❌ | ❌ |
| Resume | ❌ | ❌ | ✅ | ❌ |
| Stop | ❌ | ✅ | ✅ | ❌ |
| Temp Control | ✅ | ⚠️ | ✅ | ✅ |
| Speed | ❌ | ✅ | ❌ | ❌ |
| Fans | ✅ | ⚠️ | ✅ | ✅ |
| Movement | ✅ | ❌ | ⚠️ | ✅ |
| AMS Load | ✅ | ❌ | ❌ | ✅ |

⚠️ = Allowed with warning

---

## Phase 7: WebSocket Updates

### 7.1 Extended Status Data

Ensure these fields are included in printer status broadcasts:

```typescript
interface PrinterStatus {
  // Existing
  state: string;
  progress: number;
  remaining_time: number;
  temperatures: {...};

  // Add for control page
  print_speed_mode: number;      // 1-4
  fan_speeds: {
    part: number;      // 0-255
    aux: number;
    chamber: number;
  };
  light_state: boolean;
  ams_status: {
    units: [{
      id: number;
      trays: [{
        id: number;
        color: string;      // hex
        type: string;       // PLA, PETG, etc
        remaining: number;  // percentage
        active: boolean;
      }];
    }];
    current_tray: number;
  };
  position?: {
    x: number;
    y: number;
    z: number;
  };
}
```

---

## Implementation Order

1. **Backend MQTT commands** - Add all control methods
2. **Backend API endpoints** - Create control routes with safety
3. **Backend camera streaming** - MJPEG endpoint
4. **Frontend ControlPage** - Basic structure with tabs
5. **Frontend CameraFeed** - Live stream component
6. **Frontend PrintControls** - Pause/Resume/Stop
7. **Frontend TemperaturePanel** - Temp controls
8. **Frontend SpeedControl** - Speed mode
9. **Frontend FanControls** - Fan sliders
10. **Frontend LightToggle** - Light switch
11. **Frontend MovementControls** - Jog buttons
12. **Frontend AMSPanel** - AMS visualization
13. **Navigation integration** - Add to sidebar
14. **Testing & refinement** - All printer models

---

## Files to Create/Modify

### New Files
```
backend/app/api/routes/printer_control.py
backend/app/api/routes/camera.py
backend/app/schemas/control.py
frontend/src/pages/ControlPage.tsx
frontend/src/components/control/CameraFeed.tsx
frontend/src/components/control/PrintControls.tsx
frontend/src/components/control/TemperaturePanel.tsx
frontend/src/components/control/SpeedControl.tsx
frontend/src/components/control/FanControls.tsx
frontend/src/components/control/LightToggle.tsx
frontend/src/components/control/MovementControls.tsx
frontend/src/components/control/AMSPanel.tsx
frontend/src/components/control/ConfirmDialog.tsx
```

### Modified Files
```
backend/app/services/bambu_mqtt.py     # Add control methods
backend/app/api/routes/__init__.py     # Register new routes
backend/app/main.py                    # Include new router
backend/app/schemas/printer.py         # Extend status schema
frontend/src/App.tsx                   # Add route
frontend/src/components/Sidebar.tsx    # Add nav item
frontend/src/api/client.ts             # Add control API calls
```

---

## Estimated Scope

- Backend: ~500 lines new code
- Frontend: ~1500 lines new code
- Total: ~2000 lines

Ready to begin implementation?
