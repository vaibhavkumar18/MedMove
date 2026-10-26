from app.db.session import engine
from sqlalchemy import text

print("Checking tables in PostgreSQL...")
with engine.connect() as conn:
    result = conn.execute(text("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"))
    tables = [row[0] for row in result]
    print("✅ Tables found:", tables)
    if 'facilities' in tables:
        print("✅ 'facilities' table exists!")
    else:
        print("❌ 'facilities' table NOT found!")