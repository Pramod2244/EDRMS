# Desktop Scanner Agent Daemon

The **Desktop Scanner Agent** is a lightweight workstation background service that interfaces with physical scanning hardware (ADF and flatbed scanners) via native drivers and exposes a local WebSocket server for the EDRMS web application.

---

## 1. Capabilities

- **Native Hardware Drivers**:
  - Windows: TWAIN 2.x and WIA (Windows Image Acquisition).
  - macOS & Linux: SANE (`libsane`) backend.
- **Local IPC**: Embedded WebSocket server listening strictly on `127.0.0.1:42100`.
- **Image Processing**: Auto-deskew, blank-page removal, multi-page PDF/A compression.
- **Direct Authenticated Upload**: HTTPS multipart upload directly to the EDRMS repository with session tokens.

---

## 2. Configuration (`config.json`)

```json
{
  "port": 42100,
  "allowedOrigins": [
    "http://localhost:3000",
    "https://edrms.corp"
  ],
  "defaultDpi": 300,
  "defaultColorMode": "GRAYSCALE",
  "autoDeskew": true,
  "removeBlankPages": true,
  "tempDirectory": "/tmp/edrms_scans"
}
```

---

## 3. Running Locally (Go Daemon)

```bash
cd scanner-agent
go run cmd/main.go
```
The agent starts listening on `ws://127.0.0.1:42100`.
