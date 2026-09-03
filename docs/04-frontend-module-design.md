# 04 - Frontend Module Design

## 1. Frontend Technology Stack & Design Architecture

The frontend is constructed with:
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (strict type checking)
- **Styling**: Tailwind CSS with a tailored enterprise dark/light palette
- **Component Primitives**: shadcn/ui (Radix UI accessible primitives)
- **PDF Rendering Engine**: PDF.js / React-PDF with custom SVG/Canvas watermark overlays and coordinate-based search hit highlights
- **State Management**: Zustand for lightweight, performant client-side state
- **HTTP Client**: Axios with JWT automatic bearer token attachment and refresh interceptors

---

## 2. Directory Layout & Route Hierarchy

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout with ThemeProvider and AuthProvider
│   │   ├── page.tsx                      # Landing / Redirect to /documents or /login
│   │   ├── (auth)/
│   │   │   └── login/page.tsx            # Keycloak OIDC login trigger and redirect handler
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx                # Dashboard shell: Sidebar, Header, Global Search, Scanner Status
│   │   │   ├── documents/
│   │   │   │   ├── page.tsx              # Primary file manager (Folder Tree + Document Grid/Table)
│   │   │   │   └── [folderId]/page.tsx   # Deep link to specific folder
│   │   │   ├── search/
│   │   │   │   └── page.tsx              # Search results view with page previews & snippets
│   │   │   ├── audit/
│   │   │   │   └── page.tsx              # Audit trail log table and filter panel
│   │   │   └── admin/
│   │   │       ├── storage/page.tsx      # Storage provider switcher (LOCAL vs S3) & stats
│   │   │       ├── users/page.tsx        # User & role management
│   │   │       └── scanner/page.tsx      # Desktop Scanner Agent pairing & diagnostics
│   │   └── share/
│   │       └── [token]/page.tsx          # Public temporary access guest document viewer
│   │
│   ├── components/
│   │   ├── ui/                           # Atomic shadcn/ui components:
│   │   │   ├── button.tsx, dialog.tsx, dropdown-menu.tsx, table.tsx,
│   │   │   ├── tabs.tsx, input.tsx, badge.tsx, sheet.tsx, progress.tsx,
│   │   │   └── tooltip.tsx
│   │   ├── layout/
│   │   │   ├── app-header.tsx            # User profile, notification bell, scanner agent status badge
│   │   │   ├── app-sidebar.tsx           # Navigation links (Files, Search, Audit, Settings)
│   │   │   └── breadcrumbs-bar.tsx       # Dynamic folder breadcrumb hierarchy
│   │   ├── documents/
│   │   │   ├── document-table.tsx        # List view with sortable columns, status badges, actions
│   │   │   ├── document-grid.tsx         # Card/Thumbnail view for visual browsing
│   │   │   ├── document-uploader.tsx     # Drag-and-drop zone with multi-file chunk progress
│   │   │   ├── document-action-menu.tsx  # Context menu for Download, Share, Print, Permissions, Delete
│   │   │   ├── document-preview-modal.tsx# Modal wrapper for document inspection
│   │   │   └── pdf-page-viewer.tsx       # High-performance PDF.js canvas viewer with page navigation
│   │   ├── folders/
│   │   │   ├── folder-tree.tsx           # Recursive expandable folder explorer
│   │   │   ├── create-folder-modal.tsx   # New folder creation dialog
│   │   │   └── folder-permission-modal.tsx # ACL configuration dialog
│   │   ├── search/
│   │   │   ├── search-input.tsx          # Omni-search bar with debounced query
│   │   │   ├── search-filter-sidebar.tsx # Facet filters (MIME type, date range, folder)
│   │   │   └── search-hit-card.tsx       # Result item showing matching page number & excerpt
│   │   ├── permissions/
│   │   │   ├── permission-matrix.tsx     # Matrix editor for VIEW, UPLOAD, DOWNLOAD, DELETE, SHARE, PRINT
│   │   │   └── temporary-share-dialog.tsx# Share link generator with date picker and max views
│   │   └── scanner/
│   │       ├── scanner-widget.tsx        # Floating scanner agent status indicator (Connected/Offline)
│   │       ├── scan-dialog.tsx           # Scanner settings dialog (DPI, Duplex, Feeder, Color)
│   │       └── mobile-scan-qr-modal.tsx  # "Scan with Phone" QR code dialog
│   │
│   ├── hooks/
│   │   ├── use-documents.ts              # Document CRUD & upload mutations
│   │   ├── use-folders.ts                # Folder tree queries & state
│   │   ├── use-search.ts                 # OpenSearch API query hook
│   │   ├── use-permissions.ts            # Current user permission evaluator hook
│   │   └── use-scanner-agent.ts          # WebSocket client hook connecting to 127.0.0.1:42100
│   │
│   ├── stores/
│   │   ├── use-folder-store.ts           # Active folder ID, expanded folder nodes
│   │   ├── use-document-store.ts         # Selected documents, multi-select, upload queue
│   │   └── use-viewer-store.ts           # Active preview document, active page number, search term
│   │
│   └── lib/
│       ├── api-client.ts                 # Axios instance configured with base URL and JWT interceptor
│       ├── auth.ts                       # Keycloak adapter and token storage
│       └── utils.ts                      # Formatting helpers (bytes to MB, dates, mime-type icons)
```

---

## 3. Key Component Technical Specifications

### 3.1 PDF Page Viewer with Direct Page Navigation (`pdf-page-viewer.tsx`)
- **Direct Page Navigation**: When opened from a search hit on page 14, the viewer immediately initializes at page 14 (`initialPage={14}`).
- **Snippet Highlight Overlay**: Bounding box coordinates returned by OCR/Search are rendered as semi-transparent SVG overlays directly on top of the PDF canvas.
- **Dynamic Security Watermark**:
  - For users lacking the `DOWNLOAD` permission or accessing via temporary links, an HTML5 canvas overlay draws repeating diagonal text:
    `[User Name] | [IP Address] | [2026-09-03 11:50] | CONFIDENTIAL`
  - Print shortcut interception (`Ctrl+P`, `Cmd+P`) redirects to the secure print stream endpoint rather than raw browser DOM printing.

### 3.2 Desktop Scanner Agent Widget (`scanner-widget.tsx`)
- Maintains a persistent WebSocket heartbeat with the local agent daemon at `ws://127.0.0.1:42100`.
- If the agent is active, the UI shows a green badge `Scanner: Ready (Canon DR-C225 II)`.
- Clicking "Scan from Device" opens the scan configuration modal, triggers the hardware scan via WebSocket message, displays a live scanning progress bar, and automatically refreshes the current folder when ingestion completes.

### 3.3 Mobile "Scan with Phone" QR Code Modal (`mobile-scan-qr-modal.tsx`)
- Generates an ephemeral session token linked to the current active folder:
  `edrms://scan?session=uuid&folderId=uuid&endpoint=https://dms.corp/api/v1`
- The user points their phone camera at the screen; the mobile scanner opens, captures documents, and uploads them. The desktop interface updates instantly via WebSocket notification.

### 3.4 Permission Guard Component (`<PermissionGuard>`)
```tsx
<PermissionGuard required="DOWNLOAD" document={selectedDocument} fallback={<Badge variant="outline">Preview Only</Badge>}>
  <Button onClick={handleDownload}>
    <Download className="mr-2 h-4 w-4" /> Download Original
  </Button>
</PermissionGuard>
```
Prevents rendering unauthorized action buttons and protects against unauthorized DOM interaction.
