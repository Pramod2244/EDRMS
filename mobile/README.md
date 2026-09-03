# Mobile Document Scanner App

The **Mobile Document Scanner** application provides smartphone-based document capture using native computer vision and camera hardware (iOS VisionKit and Android Google ML Kit Document Scanner).

---

## 1. Features

- **Live Edge Detection**: Real-time quadrilateral contour identification on camera stream.
- **Auto-Perspective Rectification**: Dewarping trapezoidal camera captures into flat orthogonal document rectangles.
- **Adaptive Contrast Filters**: Enhances text readability, removes shadows, and provides B&W/Grayscale modes.
- **Multi-Page Batch Sessions**: Capture, rotate, reorder, and compile multi-page PDF files.
- **"Scan with Phone" QR Flow**: Deep link pairing with the desktop web application for direct repository ingestion.
- **Offline Resilient**: Local SQLite storage and automatic background chunked retry.

---

## 2. Directory Layout

```
mobile/
├── src/
│   ├── screens/
│   │   ├── CameraScanScreen.tsx       # Live viewfinder with document bounding box overlay
│   │   └── DocumentPreviewScreen.tsx  # Multi-page thumbnail review & upload trigger
│   ├── services/
│   │   ├── EdgeDetectionService.ts    # Perspective warp & contour extraction
│   │   └── UploadService.ts           # Chunked upload & background sync
│   └── types/
└── package.json
```
