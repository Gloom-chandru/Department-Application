# Deployment Guide

## Prerequisites

- Node.js >= 18
- npm >= 9
- PostgreSQL >= 14

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/Gloom-chandru/Department-Application.git
cd Department-Application

# 2. Install all dependencies
npm run install-all

# 3. Configure the database
npm run db:migrate

# 4. Seed the database
npm run db:seed

# 5. Start both frontend and backend
npm run dev
```

- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:5000`

## Docker Deployment

```bash
docker-compose up -d --build
npm run db:migrate
npm run db:seed
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `5000` | Server port |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_SECRET` | Yes | — | Access token signing key (≥32 chars) |
| `JWT_EXPIRE` | No | `8h` | Access token expiry |
| `JWT_REFRESH_SECRET` | Yes | — | Refresh token signing key |
| `JWT_REFRESH_EXPIRE` | No | `7d` | Refresh token expiry |
| `VITE_API_URL` | No | `http://localhost:5000/api` | Frontend API URL |
| `NODE_ENV` | No | `development` | Node environment |
| `ALLOWED_ORIGINS` | No | `localhost` | CORS whitelist |

## Production Considerations

- Use HTTPS with TLS certificates
- Set JWT secrets via environment variables
- Configure `ALLOWED_ORIGINS` to production domain
- Enable regular database backups
- Use structured logging
- Monitor with health check at `/api/health`