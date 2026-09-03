# Enterprise Document Repository Management System (EDRMS)

[![Java 21](https://img.shields.io/badge/Java-21-orange.svg)](https://openjdk.org/projects/jdk/21/)
[![Spring Boot 3](https://img.shields.io/badge/Spring%20Boot-3.3.3-green.svg)](https://spring.io/projects/spring-boot)
[![Next.js 14](https://img.shields.io/badge/Next.js-14.2-black.svg)](https://nextjs.org/)
[![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![OpenSearch 2.13](https://img.shields.io/badge/OpenSearch-2.13-purple.svg)](https://opensearch.org/)

An enterprise-grade document repository platform designed for high-throughput ingestion, scanning, asynchronous processing, OCR, full-text search with direct page navigation, secure preview, and granular access governance.

---

## 1. Architectural Blueprint & Specifications (`/docs`)

Comprehensive architecture documentation covering all enterprise requirements is located in [`/docs`](./docs):

1. **[01 - System Architecture Overview](./docs/01-architecture-overview.md)**: High-level architectural topology, client ingestion channels, modular monolith boundaries, and event-driven decoupled pipeline.
2. **[02 - Database Entity Relationship Design (ERD)](./docs/02-database-erd-design.md)**: PostgreSQL schema, relational tables, LTREE folder materialized paths, page-level OCR tables, and indexing strategies.
3. **[03 - API Module Design](./docs/03-api-module-design.md)**: RESTful OpenAPI specifications, RFC 7807 error formats, permission guards, pagination envelopes, and endpoint catalogs.
4. **[04 - Frontend Module Design](./docs/04-frontend-module-design.md)**: Next.js App Router architecture, Tailwind CSS / shadcn design system, state stores, and PDF viewer with search hit highlight overlays.
5. **[05 - Storage Abstraction Design](./docs/05-storage-abstraction-design.md)**: Pluggable `StorageProvider` SPI (Local Filesystem & AWS S3), runtime dynamic provider switching, and presigned URLs.
6. **[06 - Document-Processing Pipeline Design](./docs/06-document-processing-pipeline.md)**: Multi-stage asynchronous pipeline, Apache Tika metadata extraction, PDFBox thumbnail rendering, and pluggable OCR abstraction.
7. **[07 - Scanner Agent Architecture](./docs/07-scanner-agent-architecture.md)**: Desktop hardware daemon interfacing with physical ADF/flatbed scanners via TWAIN/WIA/SANE and local WebSocket RPC (`:42100`).
8. **[08 - Mobile Scanning Architecture](./docs/08-mobile-scanning-architecture.md)**: Camera document capture, real-time edge detection, perspective rectification, batch sessions, and "Scan with Phone" QR pairing.
9. **[09 - Security and Permissions Model](./docs/09-security-and-permissions-model.md)**: Keycloak OIDC, granular RBAC (VIEW, UPLOAD, DOWNLOAD, DELETE, SHARE, PRINT), temporary access tokens, dynamic watermarking, and tamper-evident audit logs.
10. **[10 - Phased Implementation Plan](./docs/10-phased-implementation-plan.md)**: Milestone roadmap from project skeleton to production readiness and vector/semantic search preparation.

---

## 2. Monorepo Repository Structure

```
├── docs/                        # Architecture & System Design Documents (01 - 10)
├── infrastructure/              # Docker Compose (Postgres, Redis, Keycloak, OpenSearch) & .env
├── backend/                     # Java 21 / Spring Boot 3 Modular Monolith
│   ├── src/main/java/com/edrms/backend/
│   │   ├── auth/                # Spring Security, Keycloak JWT decoder, CurrentUserContext
│   │   ├── users/               # User entity, repository, sync service
│   │   ├── roles/               # Role catalog & repository
│   │   ├── permissions/         # Granular permissions (VIEW, UPLOAD, DOWNLOAD, DELETE, SHARE, PRINT)
│   │   ├── folders/             # Hierarchical folder tree, materialized paths, ACLs
│   │   ├── documents/           # Document entity, versions, upload, download, metadata
│   │   ├── storage/             # StorageProvider SPI, LocalStorageProvider, S3StorageProvider, StorageService
│   │   ├── ocr/                 # OcrEngine SPI, AwsTextractOcrEngine, OcrService
│   │   ├── search/              # OpenSearch service, page-level search hits
│   │   ├── processing/          # Asynchronous pipeline worker, tasks, DocumentEventBus
│   │   ├── audit/               # Immutable compliance audit logging
│   │   ├── temporaryaccess/     # Time-bounded share links & token verification
│   │   └── configuration/       # System configurations & runtime storage provider switch
│   └── src/main/resources/
│       ├── application.yml      # Environment-driven application configuration
│       └── db/migration/        # Flyway initial schema (V1__initial_schema.sql)
├── frontend/                    # Next.js 14, React 18/19, TypeScript, Tailwind CSS, shadcn/ui
│   └── src/
│       ├── app/                 # App Router (documents, search, audit, admin, share)
│       ├── components/          # Document table, uploader, PDF viewer, folder tree, scanner widget
│       ├── lib/                 # Axios API client, utils
│       └── types/               # TypeScript domain interfaces
├── scanner-agent/               # Desktop Hardware Scanner Daemon (Go / TWAIN / SANE)
│   ├── cmd/main.go              # WebSocket daemon listening on 127.0.0.1:42100
│   └── config.example.json      # Workstation agent configuration
└── mobile/                      # Mobile Scanner Application (React Native / Expo)
    ├── src/screens/             # CameraScanScreen with edge detection guide
    └── src/services/            # EdgeDetectionService perspective warp
```

---

## 3. Quickstart & Local Development

### Step 1: Start Infrastructure
```bash
cd infrastructure
cp .env.example .env
docker-compose up -d
```
This starts PostgreSQL (5432), Redis (6379), Keycloak (8080), OpenSearch (9200), and OpenSearch Dashboards (5601).

### Step 2: Run Backend
```bash
cd backend
mvn spring-boot:run
```
The modular monolith starts on port `8081` with Flyway auto-migrating the PostgreSQL schema.

### Step 3: Run Frontend
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` to access the Document Repository Management System.

### Step 4: Run Desktop Scanner Agent (Optional)
```bash
cd scanner-agent
go run cmd/main.go
```
The agent connects to physical scanners and bridges them to the web UI at `ws://127.0.0.1:42100`.

---

## 4. Configuration & Security Principles

- **Zero Hardcoded Secrets**: All credentials, database passwords, Keycloak client secrets, and AWS storage keys are strictly loaded through environment variables.
- **Dynamic Storage Switching**: The administrator can switch between `LOCAL` and `S3` storage providers dynamically at runtime via the Admin UI without restarting the application.
- **Tamper-Evident Audit Trails**: Every sensitive action (`VIEW`, `UPLOAD`, `DOWNLOAD`, `DELETE`, `SHARE`, `PRINT`) is recorded with trace IDs, client IP, actor information, and cryptographic verification chaining.
