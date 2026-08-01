# API Reference

The Department Application exposes a RESTful JSON API. All endpoints are prefixed with `/api`.

## Authentication

All protected endpoints require a Bearer JWT token in the `Authorization` header.

### `POST /api/auth/login`
Authenticate a user and receive access + refresh tokens.

**Request Body:**
```json
{
  "email": "user@velammal.edu.in",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "user": {
    "id": "uuid",
    "name": "User Name",
    "email": "user@velammal.edu.in",
    "role": "STUDENT",
    "department": { "code": "AIDS" }
  }
}
```

### `POST /api/auth/refresh-token`
Exchange a refresh token for a new access token.

### `POST /api/auth/logout`
Invalidate the current session.

## Student Endpoints

| Method | Endpoint                          | Auth    | Description                              |
|--------|-----------------------------------|---------|------------------------------------------|
| GET    | `/api/student/profile`            | STUDENT | Get student profile + department details |
| GET    | `/api/student/attendance`         | STUDENT | Get overall + subject-wise attendance    |
| GET    | `/api/student/marks`            | STUDENT | Get marks by subject and exam type       |
| GET    | `/api/student/notifications`    | STUDENT | List student notifications               |
| PUT    | `/api/student/notifications/:id/read` | STUDENT | Mark a notification as read        |

## Faculty Endpoints

| Method | Endpoint                              | Auth    | Description                              |
|--------|---------------------------------------|---------|------------------------------------------|
| GET    | `/api/faculty/subjects`               | FACULTY | Get subjects assigned to faculty         |
| GET    | `/api/faculty/students`               | FACULTY | Get students in dept/batch/section       |
| GET    | `/api/faculty/attendance/existing`    | FACULTY | Get existing attendance for a date       |
| POST   | `/api/faculty/attendance`             | FACULTY | Record attendance registry        |
| GET    | `/api/faculty/marks/existing`         | FACULTY | Get existing marks for a subject+exam    |
| POST   | `/api/faculty/marks`                  | FACULTY | Publish exam marks              |

## Admin Endpoints

| Method | Endpoint                              | Auth  | Description                              |
|--------|---------------------------------------|-------|------------------------------------------|
| GET    | `/api/admin/analytics`                | ADMIN | System-wide analytics                    |
| GET    | `/api/admin/settings`               | ADMIN | Get application settings                 |
| PUT    | `/api/admin/settings/:key`            | ADMIN | Update a configuration setting           |
| GET    | `/api/admin/departments`              | ADMIN | List all departments                     |
| POST   | `/api/admin/departments`              | ADMIN | Create a new department                  |
| PUT    | `/api/admin/departments/:id`          | ADMIN | Update a department                      |
| DELETE | `/api/admin/departments/:id`          | ADMIN | Delete a department                      |

_(Similar CRUD patterns for subjects, faculty, and students.)_

## Placement Endpoints

| Method | Endpoint                              | Auth    | Description                              |
|--------|---------------------------------------|---------|------------------------------------------|
| GET    | `/api/placement/drives`               | STUDENT | List placement drives (student view)     |
| GET    | `/api/placement/drives/:id`           | STUDENT | Get drive details + eligibility          |
| POST   | `/api/placement/applications`         | STUDENT | Apply to a placement drive               |
| GET    | `/api/placement/offers`               | STUDENT | List student placement offers            |

## File Upload Endpoints

| Method | Endpoint      | Auth  | Description                          |
|--------|---------------|-------|--------------------------------------|
| POST   | `/api/files/upload` | ANY | Upload a file (multipart/form-data) |

## Health Check

| Method | Endpoint        | Auth | Description |
|--------|-----------------|------|-------------|
| GET    | `/api/health`   | None | Health check + DB connectivity |

## Error Responses

All errors follow a consistent JSON format:

```json
{
  "status": "error",
  "statusCode": 400,
  "message": "Validation failed: email is required"
}
```

## Rate Limiting

- **Login endpoint**: 5 requests per 15 minutes per IP
- **Global**: Standard `express-rate-limit` configuration