#!/usr/bin/env python
"""
MedMove — Hospital User provisioning script.

Usage (from the Backend directory):
    python scripts/create_hospital_user.py

The script prompts for all required fields interactively.  Passwords are
entered via a secure prompt and are never echoed to the terminal.

Only HOSPITAL_USER accounts can be created with this script.
NETWORK_COORDINATOR accounts must be provisioned via the seed script.

Run this script in an environment where Backend/.env is present and
DATABASE_URL points to the target database.  No database changes are made
unless the operator explicitly confirms the action.
"""
import getpass
import re
import sys
import uuid
from pathlib import Path

# Allow running from the Backend directory: `python scripts/create_hospital_user.py`
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select
from app.db.session import SessionLocal
from app.db import models
from app.core.security import hash_password

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_MIN_PASSWORD_LEN = 8


def _prompt(prompt_text: str, *, allow_empty: bool = False) -> str:
    while True:
        value = input(prompt_text).strip()
        if value or allow_empty:
            return value
        print("  ✗ This field is required. Please try again.")


def _prompt_password() -> str:
    while True:
        pw = getpass.getpass("  Password (min 8 characters): ")
        if len(pw) < _MIN_PASSWORD_LEN:
            print(f"  ✗ Password must be at least {_MIN_PASSWORD_LEN} characters.")
            continue
        confirm = getpass.getpass("  Confirm password: ")
        if pw != confirm:
            print("  ✗ Passwords do not match. Please try again.")
            continue
        return pw


def main() -> None:
    print()
    print("━" * 60)
    print("  MedMove — Provision a Hospital User account")
    print("━" * 60)
    print("  This script creates a single HOSPITAL_USER account.")
    print("  NETWORK_COORDINATOR accounts cannot be created here.")
    print("━" * 60)
    print()

    # --- Collect inputs ---
    full_name = _prompt("  Full name: ")

    while True:
        email_raw = _prompt("  Work email: ")
        email = email_raw.lower()
        if not _EMAIL_RE.match(email):
            print("  ✗ Invalid email address.")
            continue
        break

    facility_code = _prompt("  Facility code (e.g. H01): ").upper()

    print()
    password = _prompt_password()
    print()

    # --- Validate and preview ---
    db = SessionLocal()
    try:
        # Check facility exists and is active
        facility = db.scalar(
            select(models.Facility).where(
                models.Facility.facility_code == facility_code,
                models.Facility.is_active.is_(True),
            )
        )
        if facility is None:
            print(f"  ✗ Facility '{facility_code}' not found or is inactive.")
            print("     Run the seed script first if the database is empty.")
            sys.exit(1)

        # Check for duplicate email
        existing = db.scalar(
            select(models.User).where(models.User.email == email)
        )
        if existing is not None:
            print(f"  ✗ Email '{email}' is already registered.")
            sys.exit(1)

        print("  Account to be created:")
        print(f"    Full name  : {full_name}")
        print(f"    Email      : {email}")
        print(f"    Facility   : {facility.name} ({facility.facility_code})")
        print(f"    Role       : HOSPITAL_USER")
        print()

        answer = _prompt("  Confirm? [y/N]: ", allow_empty=True).lower()
        if answer not in ("y", "yes"):
            print("  Aborted. No changes made.")
            sys.exit(0)

        # --- Create user ---
        new_user = models.User(
            id=uuid.uuid4(),
            full_name=full_name,
            email=email,
            password_hash=hash_password(password),
            role="HOSPITAL_USER",
            facility_id=facility.id,
            is_active=True,
        )
        db.add(new_user)
        db.commit()

        print()
        print("  ✓ Hospital User account created successfully.")
        print(f"    User ID    : {new_user.id}")
        print(f"    Email      : {email}")
        print(f"    Facility   : {facility.name} ({facility.facility_code})")
        print()

    except Exception as exc:
        db.rollback()
        print(f"\n  ✗ Error: {exc}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
