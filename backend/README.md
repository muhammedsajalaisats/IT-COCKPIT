# IT Cockpit Backend

FastAPI backend for the IT Cockpit Teams app.

## Setup

1. Install Python 3.11+ from https://python.org
2. Create a virtual environment:
   ```
   python -m venv venv
   venv\Scripts\activate
   ```
3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
4. Run the server:
   ```
   uvicorn main:app --reload --port 8000
   ```

## Endpoints

- `GET /api/v1/manageengine` — Ticket KPIs from ManageEngine SQL
- `GET /api/v1/m365` — Mail, Calendar, Planner from Microsoft Graph
- `GET /docs` — Interactive Swagger UI
