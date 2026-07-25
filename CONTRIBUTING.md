# Contributing Guidelines & Deployment Setup

Thank you for contributing to the **VIT Student Portal** project! Please follow this document to set up the codebase for development, testing, and production deployment.

---

## 1. Local Development Setup

Follow the instructions in the main [README.md](README.md) to set up your PostgreSQL database, seed local values, and run the development servers concurrently with:
```bash
npm run dev
```

---

## 2. Coding & Quality Control

### Running Code Quality Check
Before committing, run lint checks in the respective directories:
```bash
# Run client linter
npm run lint --prefix client
```

### Running Unit & Integration Tests
Ensure all backend and frontend tests pass before opening a Pull Request:
```bash
# Run all tests sequentially from root
npm test
```

---

## 3. Environment Variables for Production

When deploying to a hosting provider, configure the following environment variables:

### Backend (Server) Environment Variables
| Variable Name | Description | Example / Recommendations |
|---|---|---|
| `PORT` | Port number the backend server listens to. | `5000` (Defaults to 5000) |
| `NODE_ENV` | Environment identifier. Controls stack traces. | `production` |
| `DATABASE_URL` | PostgreSQL connection string with SSL configurations. | `postgresql://user:pass@host:5432/db?sslmode=require` |
| `JWT_SECRET` | Secret key used to sign access JWT tokens. | Use a random, complex string (32+ chars) |
| `JWT_REFRESH_SECRET` | Secret key used to sign refresh JWT tokens. | Use a random, complex string (32+ chars) |
| `ALLOWED_ORIGINS` | Comma-separated CORS whitelist of frontend URLs. | `https://my-portal-client.vercel.app` |

### Frontend (Client) Environment Variables
| Variable Name | Description | Example / Recommendations |
|---|---|---|
| `VITE_API_URL` | Root URL of your deployed Express API server. | `https://my-portal-api.onrender.com/api` |

---

## 4. Deployment Instructions

This application is decoupled and designed to be deployed separately for optimum security, performance, and scaling.

### A. Deploying the Backend (Express & Prisma)
Deploy to hosting providers like **Render**, **Railway**, or **Heroku**:
1. Connect your repository to your provider.
2. Set the root directory to `server/` or configure the build commands from root.
3. **Build Command**:
   ```bash
   npm install && npx prisma generate
   ```
4. **Start Command**:
   ```bash
   npm start
   ```
5. Set all **Backend Environment Variables** listed above (ensure `sslmode=require` is added to the PostgreSQL string for secure production connections).

### B. Deploying the Frontend (React & Vite)
Deploy to static site hosting services like **Vercel** or **Netlify**:
1. Connect your repository.
2. Set the build parameters:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `client/`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Configure the environment variable `VITE_API_URL` pointing to your deployed backend URL (e.g. `https://my-portal-api.onrender.com/api`).
4. Trigger the deployment.
