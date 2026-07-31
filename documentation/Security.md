# Security Documentation

## Overview

The Department Application implements a defense-in-depth security strategy covering authentication, authorization, input validation, rate limiting, and secure data handling.

## Security Features

### 1. Authentication
- **JWT-based auth** with short-lived access tokens (8h) and long-lived refresh tokens (7d)
- **bcrypt** password hashing with automatic salt generation
- **Token refresh flow** — clients transparently obtain new access tokens without re-authentication
- **Token invalidation** — logout clears client-side storage and revokes session

### 2. Authorization (RBAC)
Role-based access control enforced at **two levels**:
- **Frontend**: Route guards in `App.jsx` prevent navigation to unauthorized pages
- **Backend**: Middleware verifies `req.user.role` against required roles per endpoint

| Role    | Permissions                                           |
|---------|-------------------------------------------------------|
| STUDENT | View own data, apply to placement drives, submit leave |
| FACULTY | Mark attendance, publish marks, review assignments     |
| ADMIN   | Full CRUD across all entities, analytics, settings      |

### 3. Input Validation
- **Zod schemas** validate all incoming request payloads on the server
- **HTML form validation** (`required`, `pattern`, `aria-invalid`) on the client
- **Server-side sanitization** of user-supplied data (email, names, etc.)

### 4. Rate Limiting
- **Login brute-force protection**: 5 attempts per 15 minutes per IP
- **Global rate limiting** via `express-rate-limit` for all endpoints
- Rate limit headers returned (`standardHeaders: true`)

### 5. Security Headers (Helmet)
All responses include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: no-referrer-when-downgrade`
- `Permissions-Policy` (camera, microphone, geolocation denied)

### 6. CORS Protection
- **Dynamic whitelist** of allowed origins
- Credentials mode enabled only for trusted origins
- Non-whitelisted origins rejected in production

### 7. Audit Trail
- All admin actions are logged to `AuditLog` table with:
  - Actor user ID and role
  - Action performed
  - Entity type + ID
  - Before/after state (JSON)
  - HTTP method, route, IP address

### 8. File Upload Security
- **File type validation** — only allowed MIME types accepted
- **File size limits** enforced via Multer
- **Secure storage** — files stored outside web root

### 9. Database Security
- **Parameterized queries** via Prisma ORM (SQL injection prevention)
- **Restrict delete** rules prevent accidental data loss on parent entities
- **Cascade delete** rules scoped to individual user lifecycles

### 10. Environment Security
- `.env.example` provides safe defaults; no secrets committed
- `NODE_ENV` checked in error handler to prevent stack trace leaks in production
- JWT secrets validated at startup (see `config/env.js`)

## Security Checklist

- [ ] JWT secrets are at least 32 characters and randomly generated
- [ ] `DATABASE_URL` uses authentication (no trust auth)
- [ ] `ALLOWED_ORIGINS` is set to production domain in production
- [ ] Passwords are hashed (never stored in plain text)
- [ ] Rate limiting is enabled
- [ ] Helmet and CORS are configured
- [ ] No stack traces leaked in production error responses

## Vulnerability Reporting

If you discover a security vulnerability, please email **[security@velammal.edu.in]** with:
1. A description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Your contact information