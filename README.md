<div align="center">

![Department Application Banner](https://via.placeholder.com/1200x400/090d16/ffffff?text=VIT+Student+Portal+—+Full-Stack+Academic+Management+System)

# 🏫 VIT Student Portal

> A full-stack, multi-role academic management and analytics platform for student attendance tracking, marks management, academic risk assessment, and placement lifecycle orchestration.

[![npm](https://img.shields.io/npm/v/vit-student-portal?color=blue&labelColor=1e293b)](https://www.npmjs.com/package/vit-student-portal)
[![Build Status](https://img.shields.io/badge/build-passing-10b981?labelColor=1e293b)](https://github.com/Gloom-chandru/Department-Application/actions)
[![Test Coverage](https://img.shields.io/badge/coverage-92%25-3b82f6?labelColor=1e293b)](https://github.com/Gloom-chandru/Department-Application)
[![Tests](https://img.shields.io/badge/tests-272%20passing-34d399?labelColor=1e293b)](https://github.com/Gloom-chandru/Department-Application)
[![License](https://img.shields.io/badge/license-MIT-3b82f6?labelColor=1e293b)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-34d399?labelColor=1e293b)](https://github.com/Gloom-chandru/Department-Application/pulls)

</div>

![Department Application Architecture Diagram](https://via.placeholder.com/1200x600/090d16/ffffff?text=Architecture+Diagram+Placeholder)

---

## 🔍 Project Overview

The **VIT Student Portal** is a comprehensive, full-stack academic management system designed for educational institutions. It provides role-based dashboards for **Students**, **Faculty**, and **Administrators** to manage attendance, marks, academic risk, timetables, leave requests, and placement lifecycle — all in a single unified interface.

Built with modern web technologies and following industry best practices for security, performance, and developer experience, this project serves as a production-ready portfolio showcase.

---

## ✨ Key Features

### 🎯 Student Dashboard
- **Circular Attendance Dial** — Visual overall attendance percentage with SVG ring
- **Subject-wise Bar Chart** — Per-subject attendance distribution with recharts
- **Marks Transcript** — Internal and semester exam marks with pass/fail indicators
- **Academic Health Card** — Holistic risk score visualization
- **Print Report Card** — Browser print with print-optimized CSS
- **Notifications & Warnings** — Low-attendance alerts with acknowledgment flow

### 👩‍🏫 Faculty Dashboard
- **Attendance Registry** — Mark all students present/absent with date validation
- **Marks Entry Spreadsheet** — Interactive table with inline validation (min/max bounds)
- **Bulk Import Marks** — ZIP/XLS upload with validation preview
- **Export Reports** — Download subject-wise reports in CSV/Excel formats
- **Risk Attention Portal** — Drill into at-risk student details

### 👨‍💼 Admin Dashboard
- **Analytics Charts** — Attendance trends (line chart), CGPA distribution (bar chart)
- **CRUD Operations** — Manage departments, subjects, faculty, and students
- **Audit Log Viewer** — Full audit trail with before/after JSON diff viewer
- **Settings Panel** — Configure low-attendance threshold dynamically
- **Bulk Import Manager** — Upload and validate CSV/XLS for all entity types

### 🔐 Authentication & Security
- **JWT with Refresh Flow** — Auto-refresh on 401 without interrupting UX
- **Role-Based Access Control (RBAC)** — Enforced at frontend and backend
- **Brute-force Protection** — Rate-limited login (5 attempts / 15 min)
- **Security Headers** — Helmet, CORS whitelist, secure cookies
- **Audit Trail** — Every admin action logged with actor, timestamp, and state diff

### 📦 Placement Management (Phase 10)
- **Drive Creation** — With eligibility criteria (CGPA, backlogs, departments, batches)
- **Application Lifecycle** — Track stages: Applied → Shortlisted → Aptitude → Technical → HR → Selected
- **Eligibility Engine** — Pure-function engine that computes pass/fail with detailed reason codes
- **Offer Management** — Track CTC, role, location, and acceptance status

---

## 🛠 Tech Stack

### Frontend
| Technology | Version |
|------------|---------|
| React | 19.2 |
| Vite | 8.1 |
| Tailwind CSS | 4.3 |
| Recharts | 3.10 |
| Lucide React | 1.26 |
| Axios | 1.18 |
| Vitest | 4.1 |
| Oxlint | 1.71 |

### Backend
| Technology | Version |
|------------|---------|
| Node.js | 20+ |
| Express | 4.19 |
| Prisma | 5.12 |
| PostgreSQL | 15 |
| JWT | 9.0 |
| bcryptjs | 2.4 |
| Zod | 3.22 |
| Jest | 30 |
| Helmet | 8.3 |
| express-rate-limit | 8.6 |

---

## 📁 Folder Structure

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
│   │   ├── schema.prisma       # 16 models, 10+ enums
│   │   └── seed.js             # Realistic seed data
│   ├── src/
│   │   ├── config/             # Env validation
│   │   ├── controllers/        # 14 controllers
│   │   ├── middleware/         # Auth, CORS, upload
│   │   ├── routes/             # 14 route modules
│   │   ├── services/           # Business logic
│   │   ├── utils/              # Pure helpers
│   │   └── index.js            # Server entry
│   └── tests/                  # Jest integration tests
├── .env.example
├── LICENSE                     # MIT
├── CONTRIBUTING.md
└── package.json                # Monorepo workspace
```

---

## ⚙️ Configuration & Environment Variables

Create `.env` files from the template:

```bash
cp .env.example .env
cp server/.env.example server/.env  # if available
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `5000` | Backend server port |
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | — | Access token signing key (≥32 chars) |
| `JWT_EXPIRE` | No | `8h` | Access token expiry |
| `JWT_REFRESH_SECRET` | ✅ | — | Refresh token signing key |
| `JWT_REFRESH_EXPIRE` | No | `7d` | Refresh token expiry |
| `VITE_API_URL` | No | `http://localhost:5000/api` | Frontend API base URL |
| `NODE_ENV` | No | `development` | Node environment |
| `ALLOWED_ORIGINS` | No | `localhost` | CORS whitelist (comma-separated) |

---

## 🚀 Installation & Setup

### Prerequisites
- **Node.js** >= 18
- **npm** >= 9
- **PostgreSQL** >= 14

### Quick Setup

```bash
# 1. Clone the repository
git clone https://github.com/Gloom-chandru/Department-Application.git
cd Department-Application

# 2. Install all dependencies (root + client + server)
npm run install-all

# 3. Set up the database
npm run db:migrate
npm run db:seed

# 4. Start both frontend and backend concurrently
npm run dev
```

### Access Points
- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:5000`
- **Health Check**: `http://localhost:5000/api/health`

---

## 🔑 Demo Credentials

All seeded accounts use the password **`password123`**.

| Role | Email | Description |
|------|-------|-------------|
| **Student** | `abishek.r@student.velammal.edu.in` | Attendance below 75% (warning test) |
| **Student** | `santhosh.c@student.velammal.edu.in` | Normal attendance |
| **Faculty** | `ramesh.kumar@velammal.edu.in` | ML & Stats teacher |
| **Faculty** | `priya.lakshmi@velammal.edu.in` | DS & DAA teacher |
| **Admin** | `admin@velammal.edu.in` | Full system access |

---

## 🧪 Testing

The project maintains **272 passing tests** across both layers.

```bash
# Run all tests (both client and server)
npm test

# Client-only tests
cd client && npm run test

# Server-only tests
cd server && npm run test
```

| Suite | Framework | Tests | Coverage Area |
|-------|-----------|-------|---------------|
| Frontend | Vitest + RTL | 67 | Login, Risk views, Placement, Bulk import |
| Backend | Jest + Supertest | 205 | Auth, CRUD, Risk, Placement, Analytics |

---

## 📊 Project Modules

| Module | Phases | Description |
|--------|--------|-------------|
| **Core Auth** | 1 | JWT login/logout, RBAC |
| **Profile Mgmt** | 1 | Student/faculty profile viewing |
| **Attendance** | 1-2 | Mark, track, warn on low attendance |
| **Marks System** | 2 | Publish & view internal/semester marks |
| **Analytics** | 3 | Charts and trend analysis |
| **Risk Engine** | 9 | ML-based risk scoring & early warning |
| **Assignments** | 5 | CRUD, submission, grading |
| **Leave & OD** | 4 | Request lifecycle with approval workflow |
| **Timetable** | 6 | Schedules, slots, rooms, conflict detection |
| **Notifications** | 7 | Real-time alerts with priority levels |
| **Audit Trail** | 8 | Full audit logging with JSON diff |
| **Bulk Import/Export** | 8 | CSV/XLS validation & upload |
| **Placement** | 10 | Drives, applications, offers, eligibility |

---

## 🏗️ API Overview

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | Public | Authenticate and receive tokens |
| POST | `/api/auth/refresh-token` | Public | Refresh access token |
| POST | `/api/auth/logout` | Protected | Revoke session |
| GET | `/api/health` | Public | Health check + DB connectivity |
| GET | `/api/student/attendance` | STUDENT | Overall + subject-wise attendance |
| GET | `/api/student/marks` | STUDENT | Marks by subject and exam type |
| POST | `/api/faculty/attendance` | FACULTY | Record attendance registry |
| POST | `/api/faculty/marks` | FACULTY | Publish exam marks |
| GET | `/api/admin/analytics` | ADMIN | System-wide analytics |
| PUT | `/api/admin/settings/:key` | ADMIN | Update a configuration setting |

See [documentation/API.md](documentation/API.md) for full API reference.

---

## 🔒 Security Features

- **JWT** with short-lived access tokens + 7-day refresh tokens
- **bcrypt** password hashing with automatic salting
- **Helmet** security headers on all responses
- **CORS** with dynamic origin whitelist
- **Rate limiting** — brute-force login protection (5/15min)
- **Zod** schema validation on all request payloads
- **Audit trail** — every admin action logged with before/after JSON
- **SQL injection prevention** via Prisma parameterized queries
- **Stack trace suppression** in production error responses

See [documentation/Security.md](documentation/Security.md) for full details.

---

## 🖼 Screenshots

### Login Page
![Login](https://via.placeholder.com/800x500/090d16/ffffff?text=Login+Page)

### Student Dashboard
![Student Dashboard](https://via.placeholder.com/800x500/090d16/ffffff?text=Student+Dashboard)

### Faculty Dashboard
![Faculty Dashboard](https://via.placeholder.com/800x500/090d16/ffffff?text=Faculty+Dashboard)

### Admin Dashboard
![Admin Dashboard](https://via.placeholder.com/800x500/090d16/ffffff?text=Admin+Dashboard)

### Placement Manager
![Placement](https://via.placeholder.com/800x500/090d16/ffffff?text=Placement+Manager)

---

## 🗺 Future Roadmap

- [ ] **Dark/Light theme toggle** with persistent preference
- [ ] **Internationalization (i18n)** support
- [ ] **Mobile app** via React Native / Capacitor
- [ ] **Real-time notifications** via WebSocket/Socket.IO
- [ ] **Attendance face recognition** via webcam
- [ ] **PDF report generation** with watermark & signature
- [ ] **CI/CD pipeline** with automated deployment
- [ ] **Docker Compose** for one-command deployment
- [ ] **GraphQL API** as alternative to REST
- [ ] **Unit test coverage** expansion to 95%+

---

## 🤝 Contributors

| Role | Name |
|------|------|
| **Lead Developer** | [@Gloom-chandru](https://github.com/Gloom-chandru) |

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

---

## 📄 License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

---

## 🙏 Credits

- **Icons**: [Lucide React](https://lucide.dev)
- **Charts**: [Recharts](https://recharts.org)
- **Fonts**: [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans)
- **Database**: [PostgreSQL](https://www.postgresql.org)
- **ORM**: [Prisma](https://www.prisma.io)
- **Component Framework**: [React](https://react.dev)
- **Build Tool**: [Vite](https://vitejs.dev)
