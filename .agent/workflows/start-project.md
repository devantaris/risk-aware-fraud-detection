---
description: How to start the Glass Lens project (backend + frontend)
---

# Starting the Glass Lens Project

Follow these steps every time you want to run the project after opening your PC.

## Step 1: Open TWO terminal windows (PowerShell or VS Code terminals)

You need **two separate terminals** — one for the backend, one for the frontend.

---

## Step 2: Start the Backend (Terminal 1)

// turbo
1. Navigate to the project root:
```
cd "c:\Users\Devansh\Desktop\Risk Aware Fraud Transaction Decision System"
```

// turbo
2. Activate the Python virtual environment:
```
.\venv\Scripts\Activate.ps1
```

> **If you get an execution policy error**, run this first:
> ```
> Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
> ```
> Then retry the activate command.

// turbo
3. Start the FastAPI backend:
```
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
```

4. **Wait** until you see: `Uvicorn running on http://0.0.0.0:8000`

---

## Step 3: Start the Frontend (Terminal 2)

// turbo
1. Navigate to the frontend folder:
```
cd "c:\Users\Devansh\Desktop\Risk Aware Fraud Transaction Decision System\frontend-glass"
```

// turbo
2. Install dependencies (only needed the first time):
```
npm install
```

// turbo
3. Start the Vite dev server:
```
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process; npm run dev
```

4. **Wait** until you see: `VITE ready ... Local: http://localhost:5173/`

---

## Step 4: Open the App

Open your browser and go to: **http://localhost:5173**

- The **API Connected** indicator (top-right) should turn green
- Click **Generate Random** or any preset button to test

---

## Troubleshooting

### "Port already in use" error
Run this in PowerShell to free the port:
```powershell
# Free port 8000 (backend)
Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

# Free port 5173 (frontend)
Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

### "Running scripts is disabled" error
Run this at the start of your PowerShell session:
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
```

### API shows "offline" in the browser
Make sure the backend (Terminal 1) is fully started before opening the browser.

---

## Stopping the Project

Press `Ctrl + C` in **both terminal windows** to stop the servers.
