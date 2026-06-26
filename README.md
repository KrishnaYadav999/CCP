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
CRM Frontend allowed origin: `http://localhost:5173`  
CRM Backend stays on: `http://localhost:5000`  
Database: `ccp`

## MongoDB Config

The backend supports both local MongoDB and MongoDB Atlas.

```env
MONGO_PROVIDER=local
MONGO_LOCAL_URI=mongodb://127.0.0.1:27017/ccp
MONGO_ATLAS_URI=mongodb+srv://username:password@cluster0.example.mongodb.net/?appName=Cluster0
DB_NAME=ccp
```

Use `MONGO_PROVIDER=atlas` when you want Atlas. Use `MONGO_PROVIDER=local` when you want local MongoDB. `MONGO_URI` is optional and overrides both when set.

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
