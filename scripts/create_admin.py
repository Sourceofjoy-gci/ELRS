import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import get_settings
from app.core.models import User
from app.core.security import get_password_hash

settings = get_settings()


async def create_admin_user():
    engine = create_async_engine(settings.database_url, echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    admin_email = "admin@eswatini.gov.sz"
    admin_password = "Admin@2024!"
    admin_full_name = "System Administrator"
    admin_organisation = "Eswatini Government"

    async with async_session() as session:
        query = select(User).where(User.email == admin_email)
        result = await session.execute(query)
        existing_user = result.scalar_one_or_none()

        if existing_user:
            print(f"Admin user already exists: {admin_email}")
            print(f"You can login with:")
            print(f"  Email: {admin_email}")
            print(f"  Password: {admin_password}")
        else:
            password_hash = get_password_hash(admin_password)

            admin_user = User(
                email=admin_email,
                password_hash=password_hash,
                full_name=admin_full_name,
                role="admin",
                organisation=admin_organisation,
            )

            session.add(admin_user)
            await session.commit()
            await session.refresh(admin_user)

            print("=" * 60)
            print("ADMIN USER CREATED SUCCESSFULLY")
            print("=" * 60)
            print(f"Email:    {admin_email}")
            print(f"Password: {admin_password}")
            print(f"Role:     admin")
            print("=" * 60)
            print("")
            print("Please change this password after first login!")
            print("")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(create_admin_user())
