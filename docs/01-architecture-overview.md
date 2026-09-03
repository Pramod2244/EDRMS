# 01 - System Architecture Overview

## 1. Executive Summary

The **Enterprise Document Repository Management System (EDRMS)** is an enterprise-grade, high-throughput platform engineered to ingest, process, store, search, preview, and govern physical and digital documents. The system provides unified document management across varied ingestion channels—including a hardware-interfacing Desktop Scanner Agent, a Mobile Scanning application with camera edge-detection, and modern browser-based multi-part/resumable upload.

The system is designed initially as a **Modular Monolith** using **Java 21** and **Spring Boot 3**, with strict module boundaries to allow frictionless extraction into microservices if scaling demands dictate.

---

## 2. Core Capabilities & Architectural Pillars

```
+---------------------------------------------------------------------------------------+
|                                    CLIENT CHANNELS                                    |
|   +-----------------------+   +-----------------------+   +-----------------------+   |
|   | Desktop Scanner Agent |   | Mobile Camera Scanner |   | Next.js Web Browser   |   |
|   |  (TWAIN / WIA / SANE) |   |  (Edge Detect / Warp) |   | (shadcn / Tailwind)   |   |
|   +-----------+-----------+   +-----------+-----------+   +-----------+-----------+   |
+---------------|---------------------------|---------------------------|---------------+
                |                           |                           |
                +---------------------+     |     +---------------------+
                                      |     |     |
                                      v     v     v
+---------------------------------------------------------------------------------------+
|                                GATEWAY & AUTHENTICATION                               |
|   +-------------------------------------------------------------------------------+   |
|   | Reverse Proxy / Edge Router (TLS Termination, Rate Limiting, CORS)             |   |
|   +-------------------------------------------------------------------------------+   |
|   | Keycloak (OIDC / OAuth2, Authorization Code Flow + PKCE, JWT Tokens)          |   |
|   +-------------------------------------------------------------------------------+   |
+-------------------------------------------|-------------------------------------------+
                                            v
+---------------------------------------------------------------------------------------+
|                        SPRING BOOT 3 MODULAR MONOLITH BACKEND                         |
|                                                                                       |
|   +-------------------------------------------------------------------------------+   |
|   | Security Context & JWT Bearer Authentication Filter                           |   |
|   +-------------------------------------------------------------------------------+   |
|                                                                                       |
|   [ Core Business Modules ]                                                           |
|   +-------------------+  +-------------------+  +-------------------+                 |
|   | auth              |  | users             |  | roles             |                 |
|   +-------------------+  +-------------------+  +-------------------+                 |
|   | permissions       |  | folders           |  | documents         |                 |
|   +-------------------+  +-------------------+  +-------------------+                 |
|   | temporary-access  |  | audit             |  | configuration     |                 |
|   +-------------------+  +-------------------+  +-------------------+                 |
|                                                                                       |
|   [ Processing & Abstraction Modules ]                                                |
|   +-------------------+  +-------------------+  +-------------------+                 |
|   | storage           |  | processing        |  | ocr               |                 |
|   | (SPI: Local / S3) |  | (Pipeline Workers)|  | (SPI: Textract)   |                 |
|   +-------------------+  +-------------------+  +-------------------+                 |
|   | search            |  | message-queue     |                                        |
|   | (OpenSearch SPI)  |  | (Event Bus Abstr) |                                        |
|   +-------------------+  +-------------------+                                        |
+-------------------------------------------|-------------------------------------------+
                                            v
+---------------------------------------------------------------------------------------+
|                                DATA & STORAGE INFRASTRUCTURE                          |
|   +-------------------+  +-------------------+  +-------------------+  +------------+ |
|   | PostgreSQL 16     |  | Redis 7           |  | OpenSearch 2.13   |  | Storage:   | |
|   | (Relational,      |  | (Cache, Session,  |  | (Full-Text & Page |  | Local Disk | |
|   |  LTREE, Audit)    |  |  Task Queue Bus)  |  |  Index Navigation)|  | or AWS S3   | |
|   +-------------------+  +-------------------+  +-------------------+  +------------+ |
+---------------------------------------------------------------------------------------+
```

---

## 3. Modular Monolith Architecture & Module Boundaries

To avoid the operational overhead and distributed transaction pitfalls of premature microservices while maintaining high cohesion and low coupling, the backend is organized into explicit domain modules.

### Decoupling Rules:
1. **No Cross-Module Entity Relationships**: Entities in module `A` do not maintain direct JPA `@ManyToOne` or `@OneToMany` object references to entities in module `B`. Instead, foreign entities are referenced purely by immutable `UUID` identifiers (e.g. `document.folderId`, `folder.ownerId`).
2. **Contract-Driven Communication**: When module `documents` requires permission verification, it invokes `PermissionEvaluatorService` via a strongly typed Java interface or publishes a domain event.
3. **Event-Driven Asynchronous Backbone**: Heavy mutations publish domain events (`DocumentIngestedEvent`, `DocumentDeletedEvent`, `PermissionRevokedEvent`). Subscribers handle indexing, cache invalidation, and OCR without blocking HTTP request threads.
4. **Independent Table Namespaces**: Tables are logically grouped, enabling individual migration to independent databases or microservices in the future.

### Backend Module Inventory

| Module | Primary Responsibility | Key Interfaces & Services |
| :--- | :--- | :--- |
| `auth` | OIDC token validation, JWT claim mapping, SecurityContext setup | `SecurityConfig`, `JwtAuthenticationConverter` |
| `users` | User profile synchronization from Keycloak, user lookup | `UserService`, `UserRepository` |
| `roles` | Role definitions and mappings (`SUPER_ADMIN`, `VIEWER`, etc.) | `RoleService`, `RoleRepository` |
| `permissions`| Permission evaluation engine (`VIEW`, `UPLOAD`, `DOWNLOAD`, `DELETE`, `SHARE`, `PRINT`) | `PermissionService`, `PermissionEvaluator` |
| `folders` | Hierarchical folder tree, materialized path calculation, folder ACLs | `FolderService`, `FolderTreeService` |
| `documents` | Document lifecycle, versions, metadata, preview token generation | `DocumentService`, `DocumentVersionService` |
| `storage` | Pluggable storage abstraction (`LOCAL`, `S3`, future `AZURE_BLOB`, `MINIO`) | `StorageProvider`, `StorageService` |
| `ocr` | OCR engine abstraction (`AWS_TEXTRACT`, local Tesseract fallback) | `OcrEngine`, `OcrService` |
| `search` | OpenSearch integration, page-level search indexing and hit navigation | `SearchService`, `OpenSearchClient` |
| `processing`| Asynchronous pipeline orchestrator (MIME detect, convert, thumbnail, OCR) | `DocumentPipelineWorker`, `TaskQueue` |
| `audit` | Tamper-evident audit logging for all sensitive operations | `AuditService`, `AuditAspect` |
| `temporary-access` | Expiring guest tokens, time-bounded sharing, password-protected shares | `TemporaryAccessService` |
| `configuration` | Dynamic runtime settings (e.g., active storage provider switch) | `ConfigurationService` |

---

## 4. Message Queue Abstraction

Document processing (Tika extraction, OCR, page splitting, thumbnail generation, OpenSearch indexing) is asynchronous. The system defines a generic message queue SPI:

```java
public interface DocumentEventPublisher {
    void publish(DocumentEvent event);
}

public interface DocumentEventConsumer {
    void onEvent(DocumentEvent event);
}
```

- **Phase 1 Implementation**: Spring ApplicationEventMulticaster backed by a bounded thread pool executor and Redis Streams for durability across application restarts.
- **Future Adaptation**: Seamless plug-in replacement with AWS SQS, RabbitMQ, or Apache Kafka without modifying any domain business logic.

---

## 5. Technology Stack Summary

| Layer | Selected Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend** | Next.js 14+ (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui | Server-side rendering, type-safe API consumption, component library with accessibility, responsive dark/light UI |
| **Backend** | Java 21, Spring Boot 3.3+, Spring Security, Spring Data JPA | High performance, virtual threads (Project Loom), enterprise ecosystem, declarative transaction management |
| **Database** | PostgreSQL 16 with LTREE extension | ACID compliance, hierarchical folder querying, JSONB support for flexible metadata and audit trails |
| **Cache & Queue** | Redis 7 | High-speed distributed cache, rate limiting, temporary token validation, lightweight event queue |
| **Authentication** | Keycloak 24 (OIDC / OAuth2, JWT) | Centralized identity, SSO, MFA, role management, standard Authorization Code Flow with PKCE |
| **Search Engine** | OpenSearch 2.13 | High-scale full-text search, distributed indexing, nested document page-level hit highlighting |
| **Doc Processing** | Apache Tika & PDFBox | Robust MIME detection, native digital PDF/Office text extraction, PDF page splitting and thumbnail rendering |
| **OCR Engine** | AWS Textract (via pluggable SPI) | High accuracy OCR with table and key-value extraction, page-level bounding boxes |
| **Storage Engine**| Local Disk & AWS S3 (via Storage SPI) | Support for on-premises air-gapped deployments and AWS Cloud native deployments |
