# Infrastructure Setup Guide

This directory manages the core backing services for local development and orchestration:
- **PostgreSQL 16**: Relational storage for metadata, LTREE folder hierarchy, and audit logs.
- **Redis 7**: Distributed caching, rate-limiting, and event queue stream.
- **Keycloak 24**: OpenID Connect (OIDC) identity provider and user authentication.
- **OpenSearch 2.13**: High-performance full-text search engine and page-level hit navigation.
- **OpenSearch Dashboards**: Web interface for index management and query debugging.

---

## 1. Quickstart

1. Copy the environment configuration template:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` to set secure passwords.
3. Spin up all infrastructure containers:
   ```bash
   docker-compose up -d
   ```
4. Verify all services are healthy:
   ```bash
   docker-compose ps
   ```

---

## 2. Port Allocation

| Service | Host Port | Internal Port | Description |
| :--- | :--- | :--- | :--- |
| PostgreSQL | 5432 | 5432 | Database |
| Redis | 6379 | 6379 | In-memory cache & event queue |
| Keycloak | 8080 | 8080 | Identity & SSO provider |
| OpenSearch | 9200 | 9200 | Full-text search cluster |
| OpenSearch Dashboards | 5601 | 5601 | Search query web UI |
| Backend Spring Boot | 8081 | 8081 | Application modular monolith |
| Frontend Next.js | 3000 | 3000 | Web application |
| Scanner Agent | 42100 | 42100 | Local desktop hardware WebSocket |
