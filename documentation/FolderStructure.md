# Folder Structure

```
department-application/
├── .github/                    # GitHub Actions, issue templates
├── client/                     # React frontend (Vite)
│   ├── public/
│   └── src/
│       ├── assets/             # Logo, images
│       ├── components/
│       │   ├── ui/             # Design system: Button, Card, Modal, Toast...
│       │   └── [domain]/       # Feature components
│       ├── context/            # AuthContext (JWT)
│       ├── pages/              # Route screens
│       ├── tests/              # Vitest tests
│       └── utils/              # API client, helpers
├── documentation/              # Full project documentation
├── server/                     # Express.js backend
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema
│   │   └── seed.js             # Seed data generator
│   ├── src/
│   │   ├── config/             # Env validation
│   │   ├── controllers/        # Business logic
│   │   ├── middleware/         # Auth, CORS, upload
│   │   ├── routes/             # Express routers
│   │   ├── services/           # Business logic services
│   │   ├── utils/              # Helper functions
│   │   └── index.js            # Server entry point
│   └── tests/                  # Jest integration tests
├── .env.example
├── LICENSE                     # MIT License
├── CONTRIBUTING.md
└── package.json                # Workspace config
```

## Frontend Structure

| Directory | Purpose |
|-----------|---------|
| `assets/` | Static images, logos, icons |
| `components/ui/` | Reusable design-system components (Button, Card, Input, etc.) |
| `components/` | Feature-specific components (modals, charts, widgets) |
| `context/` | React context providers (AuthContext for JWT) |
| `pages/` | Route-level screens organized by user role |
| `tests/` | Component and integration tests (Vitest) |
| `utils/` | API client (Axios with JWT interceptors), download helpers |

## Backend Structure

| Directory | Purpose |
|-----------|---------|
| `config/` | Environment variable loader and validation |
| `controllers/` | Request handlers — one per domain resource |
| `middleware/` | Authentication, CORS, rate-limiting, file upload |
| `routes/` | Express router definitions with endpoint mapping |
| `services/` | Business logic (eligibility, risk, import/export) |
| `utils/` | Pure helper functions, Prisma client instance |

## Key Files

| File | Description |
|------|-------------|
| `client/src/App.jsx` | Routes, role-based guards, dashboard dispatcher |
| `client/src/context/AuthContext.jsx` | JWT token management, login/logout state |
| `client/src/utils/api.js` | Axios instance with request/response interceptors |
| `client/src/components/ui/index.js` | Barrel exports for all UI components |
| `server/src/index.js` | Express server entry with Helmet, CORS, rate-limiting |
| `server/src/middleware/auth.js` | JWT verification middleware |
| `server/prisma/schema.prisma` | Database schema with 16 models |
| `server/prisma/seed.js` | Demo data generator for AI & DS department |