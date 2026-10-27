@echo off
REM setup.bat

echo 🔧 Creating virtual environment...
python -m venv venv

echo 📦 Activating virtual environment...
call venv\Scripts\activate.bat

echo 📥 Upgrading pip...
python -m pip install --upgrade pip

echo 📥 Installing core requirements from backend-requirements.txt...
python -m pip install -r backend-requirements.txt

echo 📥 Installing additional dependencies for Auth, Config & FastAPI...
python -m pip install pydantic-settings passlib[argon2] PyJWT python-multipart

echo.
echo ✅ Setup complete!
echo 👉 Activate the environment manually later using: venv\Scripts\activate
pause