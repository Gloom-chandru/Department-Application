# Architecture

## Overview

The Department Application is a full-stack, multi-role academic management system built with a monorepo workspace structure. It follows a layered architecture separating concerns between presentation, business logic, data access, and data persistence layers.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser / Client                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              React SPA (Vite)                       │   │
│  │                                                     │   │
│  │  ┌──────────┐  ┌──────────┐  ┌─────────────────┐  │   │
│  │  │   Auth   │  │  Routes  │  │     Pages       │  │   │
│  │  │ Context  │  │  Guards  │  │  (Student/Fac/  │  │   │
│  │  │  (JWT)   │  │ & Dispatch │  │    Admin)      │  │   │
│  │  └──────────┘  └──────────┘  └─────────────────┘  │   │
│  │                                                     │   │
│  │  ┌─────────────────────────────────────────────────┐│   │
│  │  │         Reusable UI Component Library           ││   │
│  │  │  Button, Card, Input, Select, Badge, Table,    ││   │
│  │  │  Modal, Toast, Skeleton, Pagination             ││   │
│  │  └─────────────────────────────────────────────────┘│   │
│  │                                                     │   │
│  │  ┌─────────────────────────────────────────────────┐│   │
│  │  │        API Client (Axios + Interceptors)       ││   │
│  │  │   - Token auto-attach on request                ││   │
│  │  │   - 401 auto-refresh + redirect on expiry   ││   │
│  │  └─────────────────────────────────────────────────┘│   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────┬──────────────────────────────────┘
                         │ HTTPS (JWT Bearer Token)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express.js API Server                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Middleware Layer                           │   │
│  │  ┌──────────┐  ┌──────────┐  ┌─────────────────┐   │   │
│  │  │    CORS  │  │  Helmet  │  │  Rate Limiter   │   │
│  │  │ (whitelist)│ │ (headers)│  │ (brute-force)   │   │
│  │  └──────────┘  └──────────┘  └─────────────────┘   │   │
│  │  ┌─────────────────────────────────────────────────┐│   │
│  │  │            Auth Middleware (JWT verify)         ││   │
│  │  │  - Verifies access token on protected routes  ││   │
│  │  │  - Attaches decoded user to req.user          ││   │
│  │  └─────────────────────────────────────────────────┘│   │
│  │  ┌─────────────────────────────────────────────────┐│   │
│  │  │            Upload Middleware (Multer)         ││   │
│  │  │  - File parsing, size limits, storage        ││   │
│  │  └─────────────────────────────────────────────────┘│   │
│  │                                                     │
│  │  ┌─────────────────────────────────────────────────┐│   │
│  │  │              Route Layer                        │   │
│  │  │  /api/auth    /api/student    /api/faculty     ││   │
│  │  │  /api/admin   /api/files     /api/audit       ││   │
│  │  │  /api/notifications /api/analytics ...        ││   │
│  │  └─────────────────────────────────────────────────┘│   │
│  │                                                     │
│  │  ┌─────────────────────────────────────────────────┐│   │
│  │  │              Controller Layer                   ││   │
│  │  │  Business logic per resource / role           ││   │
│  │  └─────────────────────────────────────────────────┘│   │
│  │                                                     │
│  │  ┌─────────────────────────────────────────────────┐│   │
│  │  │              Service Layer                    ││   │
│  │  │  Eligibility Engine, Risk Engine,            ││   │
│  │  │  Import/Export Services, Notification       ││   │
│  │  │  Services, Storage Services                    ││   │
│  │  └─────────────────────────────────────────────────┘│   │
│  │                                                     │
│  │  ┌─────────────────────────────────────────────────┐│   │
│  │  │              Data Access Layer                ││   │
│  │  │  Prisma ORM → PostgreSQL                      ││   │
│  │  └─────────────────────────────────────────────────┘│   │
│  │                                                     │
│  │  ┌─────────────────────────────────────────────────┐│   │
│  │  │              Error Handling                   ││   │
│  │  │  - Central JSON error middleware              ││   │
│  │  │  - Stack traces (dev) / generic msgs (prod)  ││   │
│  │  └─────────────────────────────────────────────────┘│   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Monorepo Workspace
- Root `package.json` orchestrates concurrent dev server startup
- `client/` (Vite + React) and `server/` (Express + Prisma) are independent
- Shared workspace package `vit-student-portal` provides common metadata

### 2. Role-Based Access Control (RBAC)
Three roles with distinct permissions:
- **STUDENT**: View own attendance, marks, apply for placement, submit leave requests
- **FACULTY**: Mark attendance, publish marks, review assignments, view risk analytics
- **ADMIN**: Full CRUD on departments/subjects/faculty/students, analytics, timetable management

### 3. JWT Authentication with Refresh Flow
- Access tokens (short-lived, 8h) are attached to API requests via interceptor
- On 401/403, the interceptor transparently refreshes tokens (7d) and retries the original request
- If refresh fails, the user is redirected to login with cleared storage

### 4. Prisma ORM with PostgreSQL
- Schema-first modeling with explicit indexes on high-read paths (attendance, marks, notifications)
- Cascade deletes on student records, restrict deletes on departments and faculty
- Enum-based fields for type safety (Role, Status, ExamType, etc.)

### 5. Frontend Component Architecture
- **components/ui/** — Standardized, reusable design-system components
- **components/** (root) — Feature-specific components (modals, charts, widgets)
- **pages/** — Route-level screens organized by user role
- **context/** — React Context for authentication state
- **utils/** — API client, download helpers, and business logic utilities

### 6. Backend Layering
| Layer          | Responsibility                              |
|----------------|---------------------------------------------|
| Routes         | Endpoint definitions, parameter binding     |
| Controllers    | Request validation, response shaping        |
| Services       | Business logic, external integrations       |
| Middleware     | Auth, CORS, rate limiting, file upload      |
| Utils          | Pure helper functions (eligibility, risk)   |

## Technology Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Frontend    | React 19, Vite 8, Tailwind CSS 4    |
| Charts      | Recharts                            |
| Icons       | Lucide React                        |
| Backend     | Node.js, Express 5, Prisma 5        |
| Database    | PostgreSQL                          |
| Auth        | JWT, bcryptjs                       |
| File Upload | Multer, Multer-S3 compatible        |
| Testing     | Vitest (FE), Jest (BE)              |
| Linting     | Oxlint                              |
| Deployment  | Docker-ready (see Deployment.md)    |
