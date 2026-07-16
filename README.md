# CCP

Central Creator Portal for generating leads, client master records, and admin users.

## Local Run

1. Choose MongoDB:
   - Local: set `MONGO_PROVIDER=local` in `backend/.env` and start MongoDB locally.
   - Atlas: set `MONGO_PROVIDER=atlas` and `MONGO_ATLAS_URI` in `backend/.env`.
2. Install dependencies:

```bash
npm run install:all
```

3. Configure backend env from `backend/.env.example`.
4. Seed the superadmin:

```bash
npm run seed:admin
```

5. Start backend and frontend in separate terminals:

```bash
npm run dev:backend
npm run dev:frontend
```

CCP Frontend: `http://localhost:8080`  
CCP Backend API: `http://localhost:8081/api`  
CRM Frontend allowed origin: `http://localhost:6173`  
CRM Backend API: `http://localhost:6000/api`  
Database: `ccp`

For local frontend development, keep `frontend/.env` as:

```env
VITE_API_URL=http://localhost:8081/api
```

This makes local browser API requests go directly to the CCP backend. The Vite proxy for `/api` is still available, but direct backend URLs avoid collisions when another app is also running locally.

## Vercel Deploy

This project is split into two Vercel apps:

- Frontend: `https://ccp-henna.vercel.app`
- Backend API: `https://ccp-62b2.onrender.com/api`

Frontend production API calls are configured in `frontend/vercel.json` to rewrite `/api/*` to the backend app. In Vercel Environment Variables, also set:

```env
VITE_API_URL=https://ccp-62b2.onrender.com/api
```

On the backend Vercel app, set:

```env
CLIENT_ORIGIN=https://ccp-henna.vercel.app
MONGO_PROVIDER=atlas
MONGO_ATLAS_URI=your-mongodb-atlas-uri
DB_NAME=ccp
JWT_SECRET=your-long-random-secret
```

GitHub Actions are included for CI and Vercel deployment. Add these repository secrets before using the deploy workflow:

```env
VERCEL_TOKEN=your-vercel-token
VERCEL_ORG_ID=your-vercel-team-or-user-id
VERCEL_BACKEND_PROJECT_ID=your-backend-vercel-project-id
VERCEL_FRONTEND_PROJECT_ID=your-frontend-vercel-project-id
```

## MongoDB Config

The backend supports both local MongoDB and MongoDB Atlas.

```env
MONGO_PROVIDER=local
MONGO_LOCAL_URI=mongodb://127.0.0.1:27017/ccp
MONGO_ATLAS_URI=mongodb+srv://username:password@cluster0.example.mongodb.net/?appName=Cluster0
DB_NAME=ccp
```

Use `MONGO_PROVIDER=atlas` when you want Atlas. Use `MONGO_PROVIDER=local` when you want local MongoDB. `MONGO_URI` is optional and overrides both when set.

## Move Local Compass Data To Atlas

Keep `backend/.env` configured with both local and Atlas URIs:

```env
MONGO_LOCAL_URI=mongodb://127.0.0.1:27017/ccp
MONGO_ATLAS_URI=mongodb+srv://username:password@cluster0.example.mongodb.net/?appName=Cluster0
DB_NAME=ccp
```

Then run:

```bash
npm run migrate:atlas
```

The migration copies every local collection to Atlas and skips records that already exist with the same `_id`. To replace Atlas data before copying, set `MIGRATION_DROP_ATLAS=true` only when you intentionally want to clear the Atlas collections first.

## CCP Data For CRM Projects

CRM projects should only show CCP data. They can fetch read-only data from:

- `GET http://localhost:8081/api/ccp/leads`
- `GET http://localhost:8081/api/ccp/clients`
- `GET http://localhost:8081/api/ccp/health`

If `CCP_SHARED_API_KEY` is set in backend env, CRM requests must send:

```http
x-ccp-api-key: your-shared-key
```

Lead/client creation stays in CCP. CRM projects should remove or hide their Add Lead and Add Client Master actions and use these read-only endpoints for display.
