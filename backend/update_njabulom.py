import asyncio
import asyncpg
import bcrypt
import os

async def main():
    url = os.environ.get('DATABASE_URL').replace('+asyncpg', '')
    conn = await asyncpg.connect(url)
    h = bcrypt.hashpw(b'p@ssw0rd', bcrypt.gensalt()).decode('utf-8')
    await conn.execute("UPDATE users SET password_hash = $1 WHERE email = $2", h, "njabulom@judiciary.org.sz")
    await conn.close()
    print("Password updated successfully!")

if __name__ == "__main__":
    asyncio.run(main())
