# Farm Manager

Farm Manager is a full-stack livestock and farm operations application. It combines a React dashboard frontend with a Django REST Framework backend for managing animals, health records, feed inventory, users, sales, expenses, and farm analytics.

## Project Structure

```text
FarmManager/
+-- backend/    # Django REST API
+-- frontend/   # React + Vite application
```

## Features

- Landing page adapted into a React JSX experience
- JWT-based login and authenticated API calls
- Farm-scoped user management with roles and account status
- Livestock register with animal profile drawers
- Vaccination, growth, and health event tracking
- Feed inventory and feed usage/restock adjustments
- Sales and expense tracking
- Dashboard and finance summaries
- Animal valuation analytics using purchase cost, current value, appreciation/depreciation, and ROI
- Born-in-herd animals are always assigned a purchase cost of `0`, so their current value can be tracked as newly created herd value

## Tech Stack

### Frontend

- React 19
- Vite
- Recharts
- Lucide React icons

### Backend

- Django 6
- Django REST Framework
- Simple JWT
- django-cors-headers
- SQLite for local development

## Local Setup

### 1. Backend

From the project root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo
python manage.py runserver 127.0.0.1:8000
```

The backend API will run at:

```text
http://127.0.0.1:8000/api
```

Demo login:

```text
Email: admin@farm.local
Password: admin123
```

### 2. Frontend

Open a second terminal from the project root:

```powershell
cd frontend
npm install
npm run dev
```

The frontend will run at:

```text
http://127.0.0.1:5173
```

By default, the frontend connects to:

```text
http://127.0.0.1:8000/api
```

To point it to another backend, create `frontend/.env`:

```env
VITE_BACKEND_BASE_URL=http://127.0.0.1:8000/api
```

## Main API Areas

All API routes are prefixed with `/api/`.

```text
POST   /api/auth/login/
POST   /api/auth/register-farm/
POST   /api/auth/refresh/
GET    /api/auth/me/

GET    /api/farm/
GET    /api/users/
GET    /api/animals/
GET    /api/vaccinations/
GET    /api/growth-records/
GET    /api/health-events/
GET    /api/feed-items/
GET    /api/feed-adjustments/
GET    /api/sales/
GET    /api/expenses/

GET    /api/dashboard/summary/
GET    /api/finances/summary/
```

The router-backed resources also support the usual REST actions where permitted, including create, retrieve, update, partial update, and delete.

## Animal Valuation and ROI

Each animal has:

- `purchaseCost`: acquisition cost
- `currentValue`: estimated current sale value

For purchased animals, ROI is calculated from purchase cost:

```text
(currentValue - purchaseCost) / purchaseCost * 100
```

For animals born in the herd, `purchaseCost` is forced to `0` by the backend. If a born-in-herd animal has a positive current value, the frontend displays this as `New value` because there is no purchase basis to divide against.

## Useful Commands

Backend:

```powershell
python manage.py check
python manage.py migrate
python manage.py seed_demo
python manage.py runserver 127.0.0.1:8000
```

Frontend:

```powershell
npm run dev
npm run build
npm run lint
```

## Verification Status

The current implementation has been checked with:

```powershell
python manage.py check
python manage.py migrate
npm run build
```

Note: the Vite production build may warn that the generated JavaScript chunk is larger than 500 kB. That is a build-size warning, not a build failure.
