# Knowledge Base Platform

> Modern internal knowledge-management system with admin tooling, AD authentication, REST APIs, and a Vite/Tailwind front-end.

## Project Structure

```
Knowlage-base/
├── Back-end/   # Node.js/Express API, MSSQL access, LDAP auth, logging
└── Font-End/   # Vite + React + Tailwind SPA for public and admin interfaces
```

### Back-end (Back-end/)

* **Runtime**: Node.js 18+
* **Framework**: Express
* **Database**: Microsoft SQL Server (schema + stored procedures under `SQL/`)
* **Features**:
  - LDAP/Active Directory authentication (Basic Auth headers; service account configured via `.env`).
  - REST APIs under `/api` (menu/search/content) and `/api/admin` (CRUD for Level1/Level2/Knowledge).
  - Logging + rate limiting, helmet, custom PDF domain validator, view-counter stored procedure.
  - Admin routes secured by AD group membership (`admin-dt` by default).

### Front-end (Font-End/)

* **Runtime**: Node.js 18+ (Vite dev server) / modern browsers for production build.
* **Framework**: React 18 with React Router.
* **Styling**: TailwindCSS + custom dark theme.
* **Structure**:
  - Public layout: tree navigation, knowledge search, responsive sidebar.
  - Admin layout: dashboard + CRUD screens for categories and knowledge items.
  - API helpers under `src/services/` wrap Axios with Basic Auth headers stored in `sessionStorage`.

## Getting Started

### Prerequisites

* Node.js 18+
* npm
* SQL Server instance with the schema in `Back-end/SQL/schema.sql`
* Active Directory/LDAP accessible from the API host

### Environment Variables

Copy `Back-end/.env` and fill in:

```ini
NODE_ENV=development
PORT=3000
DB_HOST=...
DB_NAME=...
LDAP_URL=ldap://...
LDAP_BASE_DN=DC=...
LDAP_BIND_DN=service@domain
LDAP_BIND_PASSWORD=...
LDAP_ADMIN_GROUP=admin-dt
PDF_ALLOWED_DOMAINS=fileserver.internal
```

For the front-end, configure `Font-End/.env`:

```bash
VITE_API_URL=http://localhost:3000
```

### Install Dependencies

```bash
cd Back-end && npm install
cd ../Font-End && npm install
```

### Database Setup

1. Run `Back-end/SQL/schema.sql` against your SQL Server instance.
2. Optionally seed sample data with `Back-end/SQL/seed.sql`.

### Running Locally

**Back-end**

```bash
cd Back-end
npm run dev
```

**Front-end**

```bash
cd Font-End
npm run dev
```

Open `http://localhost:5173` for the SPA. Admin routes live under `/administrator` (protected via Basic Auth credentials stored in sessionStorage after login).

### Production Build

* Back-end: deploy the `Back-end` folder to your Node hosting environment, set environment variables, and `npm start`.
* Front-end: `npm run build` inside `Font-End` to produce `dist/`, then serve via your preferred static host (Nginx, S3 + CloudFront, etc.).

## Testing

* Manual tests: use Postman or curl against `/api` and `/api/admin` routes to verify authentication and CRUD flows.
* Front-end: `npm run test` (if/when component tests are added).
* Smoke testing: `npm run lint` in both projects (tweak scripts to match your lint setup).

## Deployment Checklist

1. Ensure `.env` values are set for production servers (DB, LDAP, CORS origins, PDF domains).
2. Configure HTTPS/LDAPS and provide CA cert if needed.
3. Set up process manager (PM2/systemd) for the API.
4. Point your reverse proxy to the API and front-end build.
5. Monitor `Back-end/server/logs/` for runtime diagnostics.

## Contributing

1. Create a feature branch from `main`.
2. Install dependencies in both `Back-end` and `Font-End`.
3. Make changes with lint/tests passing.
4. Submit a PR describing the change, screenshots for UI tweaks, and relevant testing notes.

## License

Not specified—update this section with your preferred license (e.g., MIT) if distributing publicly.
