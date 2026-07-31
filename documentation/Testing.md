# Testing Strategy

## Overview

The Department Application maintains a comprehensive test suite covering backend API endpoints, business logic functions, and frontend component rendering. A total of **272 tests** across both client and server suites.

## Testing Stack

| Layer | Tool      | Runner  |
|-------|-----------|---------|
| Frontend | Vitest + React Testing Library | `npm run test --prefix client` |
| Backend  | Jest + Supertest               | `npm run test --prefix server`  |

## Backend Test Suites (Jest)

Located in `server/tests/`:

| File                      | Tests | Coverage Area                          |
|---------------------------|-------|----------------------------------------|
| `auth.test.js`            | ~25   | Login, refresh, logout, RBAC           |
| `student.test.js`         | ~25   | Profile, attendance, marks endpoints   |
| `faculty.test.js`         | ~30   | Subjects, attendance, marks            |
| `admin.test.js`           | ~35   | CRUD, analytics, settings              |
| `risk.test.js`            | ~20   | Risk engine math, risk API endpoints   |
| `placement.test.js`       | ~25   | Eligibility, drives, applications      |
| `analytics.test.js`       | ~15   | Analytics endpoints                    |
| `assignment.test.js`      | ~15   | Assignment CRUD + grading              |
| `leave.test.js`           | ~20   | Leave/OD request lifecycle             |
| `timetable.test.js`       | ~20   | Timetable create/read                  |
| `importExport.test.js`    | ~20   | CSV import/export                      |
| `audit.test.js`           | ~15   | Audit log retrieval                    |

Run backend tests:
```bash
cd server
npm run test
```

## Frontend Test Suites (Vitest)

Located in `client/src/tests/`:

| File                       | Tests | Coverage Area                          |
|----------------------------|-------|----------------------------------------|
| `Components.test.jsx`      | 3     | Login form validation                  |
| `AcademicRisk.test.jsx`    | 6     | Risk view + risk engine integration    |
| `BulkImportManager.test.jsx` | 52  | Bulk import, export, modals            |
| `PlacementManager.test.jsx` | 6    | Placement dashboard views              |

Run frontend tests:
```bash
cd client
npm run test
```

## Writing New Tests

### Backend (Jest)
```js
// server/tests/example.test.js
describe('Example API', () => {
  it('should return expected data', async () => {
    const res = await request(app)
      .get('/api/student/profile')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('rollNo');
  });
});
```

### Frontend (Vitest)
```jsx
// client/src/tests/example.test.jsx
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

it('renders the component', async () => {
  render(<Component />, { wrapper: MemoryRouter });
  expect(screen.getByText('text')).toBeInTheDocument();
});
```

## Mocking Strategy

- **API mocking**: `api.js` is mocked with `vitest.mock()` / `jest.mock()`
- **Auth**: Token-based mock auth state in test setup
- **Database**: Tests run against an in-memory SQLite or test PostgreSQL instance