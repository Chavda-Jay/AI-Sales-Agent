# This script strictly activates the venv and runs the backend
$ErrorActionPreference = "Stop"
Write-Host "Activating virtual environment..." -ForegroundColor Cyan
if (Test-Path ".\.venv\Scripts\Activate.ps1") {
    . .\.venv\Scripts\Activate.ps1
} else {
    Write-Host "Virtual environment not found! Run 'python -m venv .venv' first." -ForegroundColor Red
    exit 1
}

Write-Host "Starting Uvicorn server strictly inside venv..." -ForegroundColor Green
uvicorn main:app --reload --port 3001
