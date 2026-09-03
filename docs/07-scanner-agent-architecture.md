# 07 - Scanner Agent Architecture

## 1. Overview & Business Context

In enterprise records management, scanning physical paperwork via desktop flatbed and Automatic Document Feeder (ADF) scanners (such as Fujitsu, Canon, HP, or Epson) directly into the repository is critical. Web browsers cannot natively access low-level USB or SCSI scanner drivers.

The **Desktop Scanner Agent** is a lightweight local daemon running on the user's workstation that bridges physical scanning hardware with the EDRMS web application.

```
+-----------------------------------------------------------------------------------+
| USER WORKSTATION                                                                  |
|                                                                                   |
|  +---------------------------+        WebSocket (JSON-RPC)    +-----------------+ |
|  | Physical Scanner Hardware |        ws://127.0.0.1:42100    | Next.js Web App | |
|  | (ADF / Flatbed / USB)     |        +---------------------> | (in Browser)    | |
|  +-------------+-------------+        |                       +--------+--------+ |
|                |                      |                                |          |
|                v                      v                                |          |
|  +--------------------------------------------+                        |          |
|  | Scanner Agent Daemon                       |                        |          |
|  | - Hardware Driver Abstraction:             |                        |          |
|  |   * TWAIN 2.x (Windows)                    |                        |          |
|  |   * WIA (Windows Image Acquisition)        |                        |          |
|  |   * SANE (Linux / macOS)                   |                        |          |
|  | - Image Compression & PDF Assembler        |                        |          |
|  | - Authenticated HTTPS Uploader             |                        |          |
|  +--------------------+-----------------------+                        |          |
|                       |                                                |          |
+-----------------------|------------------------------------------------|----------+
                        | HTTPS POST /api/v1/scanner/upload              |
                        v                                                v
+-----------------------------------------------------------------------------------+
| EDRMS BACKEND REPOSITORY SERVER                                                   |
+-----------------------------------------------------------------------------------+
```

---

## 2. Technical Stack & Driver Abstractions

- **Agent Runtime**: Go daemon or lightweight C#/.NET Core tray application compiled as a single binary with zero external runtime dependencies.
- **Hardware Drivers**:
  - **Windows**: TWAIN Data Source Manager (`twaindsm.dll`) and Windows Image Acquisition (WIA).
  - **Linux / macOS**: SANE (`libsane`) backend via CGO / native wrapper.
- **Local IPC**: Embedded WebSocket server listening strictly on `127.0.0.1:42100`.
- **Packaging**: Distributed as Windows MSI installer, macOS PKG/DMG, and Linux deb/rpm package with auto-start on user login.

---

## 3. Communication Protocol (Web UI <-> Scanner Agent)

All messages over `ws://127.0.0.1:42100` are formatted as JSON-RPC 2.0 payloads.

### 3.1 Device Discovery
#### Request (Web UI -> Agent):
```json
{
  "jsonrpc": "2.0",
  "id": "req-1",
  "method": "scanner.listDevices"
}
```
#### Response (Agent -> Web UI):
```json
{
  "jsonrpc": "2.0",
  "id": "req-1",
  "result": {
    "devices": [
      {
        "id": "twain:Canon_DR-C225_II",
        "name": "Canon imageFORMULA DR-C225 II",
        "driver": "TWAIN",
        "supportsFeeder": true,
        "supportsDuplex": true,
        "supportedDpi": [150, 200, 300, 600],
        "supportedColorModes": ["COLOR", "GRAYSCALE", "BLACK_WHITE"]
      }
    ]
  }
}
```

### 3.2 Scan Execution
#### Request (Web UI -> Agent):
```json
{
  "jsonrpc": "2.0",
  "id": "req-2",
  "method": "scanner.startScan",
  "params": {
    "deviceId": "twain:Canon_DR-C225_II",
    "resolutionDpi": 300,
    "colorMode": "GRAYSCALE",
    "source": "ADF_DUPLEX",
    "autoDeskew": true,
    "removeBlankPages": true,
    "uploadDestination": {
      "backendUrl": "https://edrms.corp/api/v1/scanner/upload",
      "folderId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "documentName": "Scanned_Batch_2026-09-03.pdf",
      "sessionToken": "eyJh..."
    }
  }
}
```

### 3.3 Event Streaming (Agent -> Web UI)
The Agent emits live progress notifications as sheets pass through the scanner:
```json
{
  "jsonrpc": "2.0",
  "method": "scanner.pageScanned",
  "params": {
    "pageNumber": 1,
    "previewThumbnailBase64": "data:image/webp;base64,UklGR..."
  }
}
```
```json
{
  "jsonrpc": "2.0",
  "method": "scanner.scanComplete",
  "params": {
    "totalPages": 4,
    "pdfSize": 1845920,
    "status": "UPLOADING"
  }
}
```

---

## 4. End-to-End Scan and Ingestion Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Operator
    participant Web as Next.js Web UI
    participant Agent as Local Scanner Agent
    participant Hardware as Physical Scanner (ADF)
    participant Backend as EDRMS Backend

    Operator->>Web: Clicks "Scan Documents" in Legal Folder
    Web->>Agent: ws://127.0.0.1:42100 (scanner.listDevices)
    Agent-->>Web: Returns "Canon DR-C225 II" (ADF Ready)
    Web->>Operator: Displays Scan Settings Dialog (300 DPI, Duplex)
    Operator->>Hardware: Places 5 pages into ADF paper tray
    Operator->>Web: Clicks "Begin Scan"
    Web->>Backend: Request ephemeral scan upload token for target folder
    Backend-->>Web: Returns sessionToken
    Web->>Agent: scanner.startScan (deviceId, 300 DPI, sessionToken, folderId)

    loop For Each Page in Feeder
        Agent->>Hardware: Acquire image buffer
        Hardware-->>Agent: Raw image stream
        Agent->>Agent: Auto-deskew & blank-page filter
        Agent->>Web: Notification: scanner.pageScanned (Page N)
        Web->>Operator: Shows live page thumbnail in web preview strip
    end

    Agent->>Agent: Assemble compressed multi-page PDF/A
    Agent->>Backend: HTTPS POST /api/v1/scanner/upload (PDF + metadata + sessionToken)
    Backend->>Backend: Store binary, trigger processing pipeline
    Backend-->>Agent: 201 Created (documentId)
    Agent->>Web: Notification: scanner.uploadSuccess (documentId)
    Web->>Operator: Refreshes folder view; document appears in PROCESSING state
```

---

## 5. Security & Workstation Hardening

1. **Localhost Origin Isolation**: The WebSocket server strictly verifies the HTTP `Origin` header during WebSocket handshake, allowing connections only from authorized domain names (e.g. `https://edrms.corp` or `http://localhost:3000` in dev).
2. **One-Time Pairing Token**: Scanning cannot be initiated without a signed short-lived session token issued by the backend to an authenticated user with `UPLOAD` permissions on the destination folder.
3. **Encrypted Local Storage**: Temporary scan image buffers are held in memory or encrypted scratch directories and wiped immediately after upload completion.
