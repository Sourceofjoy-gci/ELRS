#!/usr/bin/env python3
import asyncio
import asyncpg

async def update_admin_password():
    conn = await asyncpg.connect(
        host='localhost',
        port=5432,
        user='eswatini_legal',
        password='LegalSZ_Dev2026!',
        database='eswatini_legal'
    )

    import bcrypt
    password = "Admin@2024!"
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    await conn.execute(
        "UPDATE users SET hashed_password = $1 WHERE email = $2",
        hashed,
        "admin@eswatini.gov.sz"
    )

    print(f"Updated password for admin@eswatini.gov.sz")
    print(f"New hash: {hashed}")

    await conn.close()

if __name__ == "__main__":
    asyncio.run(update_admin_password())
