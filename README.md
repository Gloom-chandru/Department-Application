# VIT Student Portal (Velammal Institute of Technology)

A full-stack student information system for tracking, managing, and analyzing student attendance and exam marks. Built with React, Tailwind CSS v4, Express.js, and PostgreSQL using Prisma ORM.

## Project Structure

```text
├── client/                 # React frontend application (Vite)
│   ├── src/
│   │   ├── components/     # UI components (Navbar, etc.)
│   │   ├── context/        # React context (AuthContext, etc.)
│   │   ├── pages/          # Screens (Login, Student, Faculty, Admin, Profile)
│   │   ├── utils/          # API services (Axios client with JWT interceptor)
│   │   ├── App.jsx         # Routes, Guards, and Dispatchers
│   │   └── index.css       # Tailwind CSS v4 & custom fonts
│   └── package.json
│
├── server/                 # Node.js + Express backend service
│   ├── prisma/
│   │   ├── schema.prisma   # PostgreSQL models with indexes & cascade delete rules
│   │   └── seed.js         # Realistic seed data for AI & DS department
│   ├── src/
│   │   ├── controllers/    # API business logic
│   │   ├── middleware/     # JWT authentication & role authorization
│   │   ├── routes/         # Express router mapping
│   │   ├── utils/          # Database clients
│   │   └── index.js        # Main server entry
│   └── package.json
│
├── package.json            # Root configuration for concurrent execution
└── .env                    # System environment variables
```

---

## Prerequisites

Ensure you have the following installed on your machine:
- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- **PostgreSQL** running locally or via a cloud instance

---

## Configuration & Environment Variables

Create a `.env` file in the **workspace root** and also in the **`server/` directory** (a template `.env.example` has been provided at the root).

```env
# Server Config
PORT=5000
NODE_ENV=development

# Database Connection URL (PostgreSQL)
DATABASE_URL="postgresql://postgres:0324@localhost:5432/vit_portal?schema=public"

# Auth Secrets
JWT_SECRET="vit_student_portal_jwt_secret_key_2026_super_secure"
JWT_EXPIRE="8h"
JWT_REFRESH_SECRET="vit_student_portal_jwt_refresh_secret_key_2026_super_secure"
JWT_REFRESH_EXPIRE="7d"

# Frontend Config
VITE_API_URL="http://localhost:5000/api"
```

---

## Installation & Setup

1. **Clone or navigate** to the project directory:
   ```bash
   cd "c:\Users\ASUS\Desktop\MY PROJECT\Department Application"
   ```

2. **Install all dependencies** (installs workspace root, client, and server packages):
   ```bash
   npm run install-all
   ```

3. **Configure the Database**:
   Apply migrations to generate database tables:
   ```bash
   npm run db:migrate
   ```

4. **Seed the Database**:
   Pre-populate the tables with realistic academic data (batches, course subjects, attendance logs, and test scores):
   ```bash
   npm run db:seed
   ```

---

## Running the Application

To run both the **frontend** and **backend** servers concurrently in development mode:

```bash
npm run dev
```

- **Frontend Application** is served at: `http://localhost:5173`
- **Backend API** is served at: `http://localhost:5000`

---

## User Roles & Credentials (Seed Data)

Use these credentials to test the student, faculty, and admin flows in the application. The default password for all seed accounts is `password123`.

### 1. Student Role
Students can view circular metrics of their overall attendance, view subject-wise charts, check report sheets, acknowledge low-attendance warnings, and print report transcripts.
- **Roll Number:** `2024AIDS002` (Abishek R - Batch 2024-28 Section A)
  - **Email:** `abishek.r@student.velammal.edu.in`
  - *Note:* Has attendance under 75% for testing warning banners.
- **Roll Number:** `2024AIDS001` (Santhosh Kumar C - Batch 2024-28 Section A)
  - **Email:** `santhosh.c@student.velammal.edu.in`

### 2. Faculty Role
Faculty can select sections to mark daily attendance registries (with auto-load edits) and publish assessment/semester grades.
- **Subject Teacher 1:** Dr. Ramesh Kumar (Machine Learning, Probability & Stats)
  - **Email:** `ramesh.kumar@velammal.edu.in`
- **Subject Teacher 2:** Mrs. Priya Lakshmi (Data Science, Data Structures)
  - **Email:** `priya.lakshmi@velammal.edu.in`

### 3. Admin Role
Admins can view batch analytics charts, change low-attendance thresholds, CRUD departments/subjects/faculty/students, and export all records to an Excel-compatible CSV file.
- **Administrator:** Admin Principal
  - **Email:** `admin@velammal.edu.in`
