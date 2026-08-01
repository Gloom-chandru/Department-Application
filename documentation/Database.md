# Database Documentation

## Overview

The Department Application uses **PostgreSQL** as the primary database, managed through **Prisma ORM**.

## Schema Overview

The database schema consists of **16 models** organized into the following domains:

| Domain | Models |
|--------|--------|
| Core Identity | `User`, `Department`, `Role` (enum) |
| Academics | `Student`, `Subject`, `Attendance`, `Mark` |
| Timetable | `TimetableSchedule`, `TimetableSlot`, `Room`, `PeriodTemplate` |
| Risk Assessment | `RiskAssessment`, `RiskLevel` (enum) |
| Assignments | `Assignment`, `AssignmentSubmission`, `AssignmentStatus` (enum) |
| Leave & OD | `LeaveODRequest`, `LeaveStatus` (enum) |
| Notifications | `Notification` |
| Placement | `Company`, `PlacementDrive`, `PlacementApplication`, `PlacementOffer`, `StudentPlacementProfile` |
| Audit | `AuditLog` |
| Settings | `Setting` |

## Entity Relationship (Simplified)

```
Department ──< User ── Student ── PlacementProfile
               ├── Faculty
               └── Admin

Student ── Mark ── Subject ── Faculty
Student ── Attendance ── Subject
Student ── RiskAssessment
Student ── LeaveODRequest
Student ── AssignmentSubmission
Student ── PlacementApplication ── PlacementDrive ── Company

User ── AuditLog
User ── Notification
```

## Key Indexes

| Table | Indexed Columns | Purpose |
|-------|-----------------|---------|
| `Attendance` | `(studentId, subjectId, date)` unique | Prevent duplicates |
| `Attendance` | `studentId`, `subjectId`, `date`, `markedById` | Fast lookups |
| `Mark` | `(studentId, subjectId, examType)` unique | Prevent duplicate marks |
| `Notification` | `(userId, createdAt)`, `(userId, readStatus)` | Fast unread queries |
| `AuditLog` | `timestamp`, `actorUserId`, `action` | Audit querying |
| `RiskAssessment` | `(studentId, calculatedAt DESC)`, `riskLevel` | Risk analytics |

## Running Migrations

```bash
cd server
npm run db:migrate    # Apply migrations
npm run db:seed       # Seed initial data
npm run prisma:generate  # Regenerate Prisma client
```

## Connection

The database connection string is configured via the `DATABASE_URL` environment variable:

```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public