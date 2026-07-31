# Contributing to VIT Student Portal

![Contribution Guide](https://via.placeholder.com/1200x200/090d16/ffffff?text=Contributing+Guide)

Thank you for your interest in contributing! This document outlines how to set up the project and standards for contributions.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Style Guide](#style-guide)
- [Reporting Bugs](#reporting-bugs)
- [Feature Requests](#feature-requests)

## Getting Started

### Prerequisites
- Node.js >= 18
- npm >= 9
- PostgreSQL >= 14

### Setup

```bash
git clone https://github.com/Gloom-chandru/Department-Application.git
cd Department-Application
npm run install-all
```

### Environment Configuration
```bash
cp .env.example .env
cp server/.env.example server/.env
# Fill in your values
```

### Database
```bash
npm run db:migrate    # Apply Prisma migrations
npm run db:seed       # Seed with demo data
```

### Running Locally
```bash
npm run dev           # Starts both client and server concurrently
```

## Development Workflow

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feat/feature-name`)
3. **Make** your changes
4. **Run** tests (`npm test`)
5. **Commit** with conventional messages
6. **Push** and **open a PR**

### Branch Naming
| Type | Format |
|------|--------|
| Feature | `feat/feature-name` |
| Bug Fix | `fix/bug-description` |
| Docs | `docs/update-description` |
| Refactor | `refactor/component-name` |

### Commit Messages
Follow [Conventional Commits](https://www.conventionalcommits.org/):
```
feat: add dark mode toggle
fix: resolve student profile loading issue
docs: update API endpoint documentation
```

## Coding Standards

- Use **2-space** indentation
- Single quotes for strings, double quotes for JSX text
- Always include `aria-*` attributes for accessibility
- Use the standardized UI component library in `components/ui/`
- Follow the established **Tailwind CSS** design tokens

## Testing

The project has **272 passing tests** across frontend and backend:

```bash
npm test                    # Run all tests
npm run test --prefix client
npm run test --prefix server
```

All new features must include test coverage. Existing tests must not regress.

## Pull Request Process

1. Ensure all tests pass
2. Run linting: `npm run lint --prefix client`
3. Include a clear description of changes
4. Link any related issues
5. Request review from a maintainer

## Style Guide

- **Component naming**: PascalCase (e.g., `StudentDashboard`)
- **File naming**: kebab-case for files, PascalCase for React components
- **Variable naming**: camelCase for JS, kebab-case for CSS classes
- **Import ordering**: React first, then third-party, then local

## Reporting Bugs

Use the **[Bug Report Template](https://github.com/Gloom-chandru/Department-Application/issues/new?template=bug_report.md)** when filing issues.

## Feature Requests

Use the **[Feature Request Template](https://github.com/Gloom-chandru/Department-Application/issues/new?template=feature_request.md)** to propose new features.

---

Thank you for contributing! 🎉