"""Prints only the database host and name — never credentials."""
import re, sys
sys.path.insert(0, '.')
from app.core.config import settings
url = settings.DATABASE_URL
driver = url.split("://")[0]
m = re.match(r'^[^:]+://[^:@]+(?::[^@]+)?@([^/:]+(?::\d+)?)/([^?]+)', url)
if m:
    print(f"Driver : {driver}")
    print(f"Host   : {m.group(1)}")
    print(f"DB name: {m.group(2)}")
    is_neon = "neon" in m.group(1).lower()
    print(f"Neon?  : {is_neon}")
else:
    print("Could not parse host without risking credential exposure.")
    sys.exit(1)
