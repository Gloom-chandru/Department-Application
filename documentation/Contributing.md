# Contributing Guide

## Welcome!

Thank you for your interest in contributing to the Department Application! This document outlines the process for setting up the project locally and guidelines for submitting contributions.

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
```

### Database
```bash
npm run db:migrate
npm run db:seed
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
```

## Coding Standards

- Use **2-space** indentation
- Single quotes for strings
- Semicolons at end of statements
- PascalCase for components, camelCase for variables/functions

## Pull Request Process

1. Ensure all tests pass
2. Run linting: `npm run lint --prefix client`
3. Include a clear description of changes
4. Link any related issues
5. Request review from a maintainer

## Code of Conduct

Be respectful and constructive in all interactions. Harassment or discrimination of any kind will not be tolerated.