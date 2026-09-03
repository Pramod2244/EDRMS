# 10 - Phased Implementation Plan

## 1. Roadmap Overview

The development of the **Enterprise Document Repository Management System (EDRMS)** follows a phased, milestone-driven execution model. Each phase produces verifiable, testable deliverables while strictly maintaining architectural boundaries.

```
+---------------------------------------------------------------------------------------+
| PHASE 1: Architecture & Project Skeleton (CURRENT)                                    |
| - 10 Architecture documents                                                          |
| - Monorepo structure (/backend, /frontend, /scanner-agent, /mobile, /infrastructure)   |
| - Docker Compose environment, Spring Boot 3 modular skeleton, Next.js skeleton       |
+-------------------------------------------+-------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------+
| PHASE 2: Identity, RBAC & Hierarchical Folder Engine                                  |
| - Keycloak 24 realm & client setup, Spring Security OIDC JWT Resource Server          |
| - PostgreSQL schema migrations (V1)                                                   |
| - Folder CRUD with Materialized Path traversal and inheritance permission evaluator   |
+-------------------------------------------+-------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------+
| PHASE 3: Storage Abstraction & Ingestion Endpoints                                    |
| - StorageProvider SPI (LocalStorageProvider, S3StorageProvider)                      |
| - Runtime dynamic storage switching via ConfigurationService                          |
| - Multipart file upload & S3 presigned URL upload-sessions                           |
+-------------------------------------------+-------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------+
| PHASE 4: Document-Processing Pipeline & AWS Textract OCR                              |
| - Asynchronous message queue bus & processing workers                                 |
| - Apache Tika MIME detection & text extraction                                        |
| - Apache PDFBox page rendering & WebP thumbnail generation                            |
| - OcrEngine SPI with AWS Textract bounding-box implementation                         |
+-------------------------------------------+-------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------+
| PHASE 5: OpenSearch Integration & Direct Page-Level Navigation                        |
| - OpenSearch cluster mapping with nested page documents                               |
| - Asynchronous indexer publishing page text, offsets, and geometry                    |
| - Page-level search query with snippet highlighting and hit scoring                   |
+-------------------------------------------+-------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------+
| PHASE 6: Web Dashboard & PDF Viewer with Search Highlights                            |
| - Next.js App Router, Tailwind CSS, shadcn/ui components                              |
| - Folder tree explorer, document tables, drag-and-drop uploader                       |
| - PDF.js page viewer with search hit highlight overlays and dynamic watermarking      |
+-------------------------------------------+-------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------+
| PHASE 7: Desktop Scanner Agent & Mobile Document Scanner                              |
| - Desktop agent daemon (TWAIN/WIA/SANE hardware abstraction, local WebSocket :42100)  |
| - Mobile camera document scanning (Edge detection, perspective warp, batch upload)    |
| - "Scan with Phone" QR-code pairing flow                                              |
+-------------------------------------------+-------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------+
| PHASE 8: Temporary Access, Watermarking & Audit Compliance                            |
| - Cryptographically secure temporary share links (expiry, view count, password)       |
| - Dynamic watermark overlay engine for PRINT / VIEW permissions                       |
| - Tamper-evident cryptographic hash-chained audit logging                             |
+-------------------------------------------+-------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------+
| PHASE 9: Vector / Semantic Search & AI-Assisted Readiness                             |
| - OpenSearch k-NN or pgvector embedding integration hooks                             |
| - Multi-modal document embeddings for AI-assisted semantic search                     |
| - Production hardening, high availability clustering, and automated E2E tests        |
+---------------------------------------------------------------------------------------+
```

---

## 2. Milestone Breakdown & Deliverables

### Phase 1: Architecture & Project Skeleton (Current Deliverable)
- **Scope**:
  - Deliver all 10 architecture and system design documents in `/docs`.
  - Establish monorepo workspace directories (`/backend`, `/frontend`, `/scanner-agent`, `/mobile`, `/infrastructure`, `/docs`).
  - Configure `docker-compose.yml` orchestrating PostgreSQL 16, Redis 7, Keycloak 24, OpenSearch 2.13, and OpenSearch Dashboards.
  - Establish environment variable templates (`.env.example`) with zero hardcoded credentials.
  - Implement Spring Boot 3 modular package structure with initial Flyway PostgreSQL migration script (`V1__initial_schema.sql`).
  - Implement Next.js 14+ frontend skeleton with Tailwind CSS and shadcn/ui.
  - Implement Scanner Agent and Mobile App project templates.

### Phase 2: Identity, RBAC & Hierarchical Folder Engine
- **Deliverables**:
  - Keycloak realm configuration JSON with preconfigured roles (`SUPER_ADMIN`, `VIEWER`, etc.).
  - Spring Security configuration extracting JWT roles and user context.
  - Folder service managing hierarchical operations (create, rename, move, delete) with materialized paths.
  - Permission evaluator checking `VIEW`, `UPLOAD`, `DOWNLOAD`, `DELETE`, `SHARE`, `PRINT`.

### Phase 3: Storage Abstraction & Document Ingestion
- **Deliverables**:
  - `StorageProvider` interface and unit tests.
  - `LocalStorageProvider` with path traversal defense and atomic `.tmp` renames.
  - `S3StorageProvider` with AWS SDK v2 non-blocking client and S3 presigned URL generation.
  - `StorageService` managing runtime provider switching via `system_configurations`.

### Phase 4: Document Pipeline & OCR Engine Abstraction
- **Deliverables**:
  - `DocumentPipelineWorker` listening to document ingestion events.
  - Apache Tika integration for MIME sniffing and metadata extraction.
  - Format converter normalizing Office documents (`DOCX`, `XLSX`, `PPTX`) to PDF.
  - PDFBox page splitter generating WebP thumbnails per page.
  - `OcrEngine` SPI with `AwsTextractOcrEngine` extracting page text and bounding boxes.

### Phase 5: OpenSearch Integration & Page Navigation
- **Deliverables**:
  - OpenSearch index templates with nested page mappings.
  - Search indexing pipeline synchronizing document pages upon OCR completion.
  - Full-text search endpoint returning matched documents, exact page numbers, and highlighted snippets.

### Phase 6: Frontend File Manager & Highlighting Previewer
- **Deliverables**:
  - Complete Next.js dashboard layout with sidebar, search bar, and breadcrumbs.
  - Accessible shadcn/ui folder tree and document tables.
  - Drag-and-drop chunked file uploader with upload progress bars.
  - High-performance PDF viewer with page navigation and search hit bounding box highlights.

### Phase 7: Scanner Agent & Mobile Scanner Ingestion
- **Deliverables**:
  - Desktop Scanner Agent daemon supporting TWAIN/SANE hardware and local WebSocket RPC.
  - Web UI scanner widget showing real-time scanner status and triggering scans.
  - Mobile document scanner with real-time camera edge detection and perspective warp.
  - "Scan with Phone" QR pairing flow.

### Phase 8: Temporary Access, Security & Tamper-Evident Audit
- **Deliverables**:
  - Temporary access link generator with expiry datetime, password, and view counter.
  - Watermark generator stamping user metadata onto PDF pages for unauthorized download prevention.
  - Tamper-evident audit logging with SHA-256 hash chaining.

### Phase 9: AI / Vector Search & Production Hardening
- **Deliverables**:
  - Pluggable vector embedding generation for semantic search (hybrid keyword + vector k-NN).
  - End-to-end integration tests using Testcontainers.
  - Kubernetes / Helm deployment configurations.
