import asyncio
import uuid
from datetime import datetime, date
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import get_settings
from app.core.models import LegalDocument, Base

settings = get_settings()

ESWATINI_LEGAL_CORPUS = [
    {
        "title": "Constitution of the Kingdom of Eswatini, 2005",
        "doc_type": "constitution",
        "act_number": None,
        "year": 2005,
        "chapter": None,
        "ministry": "Justice",
        "status": "active",
        "commencement_date": date(2006, 2, 8),
        "source_url": "https://gov.sz/index.php/constitution",
    },
    {
        "title": "Employment Act, 1980",
        "doc_type": "act",
        "act_number": "Act 5 of 1980",
        "year": 1980,
        "chapter": "Chapter 47",
        "ministry": "Labour",
        "status": "active",
        "commencement_date": date(1980, 9, 1),
        "source_url": "https://laws.gov.sz/employment-act-1980",
    },
    {
        "title": "Industrial Relations Act, 2000",
        "doc_type": "act",
        "act_number": "Act 1 of 2000",
        "year": 2000,
        "chapter": "Chapter 32",
        "ministry": "Labour",
        "status": "active",
        "commencement_date": date(2000, 6, 1),
        "source_url": "https://laws.gov.sz/industrial-relations-act",
    },
    {
        "title": "Companies Act, 2009",
        "doc_type": "act",
        "act_number": "Act 8 of 2009",
        "year": 2009,
        "chapter": "Chapter 42:01",
        "ministry": "Commerce",
        "status": "active",
        "commencement_date": date(2009, 11, 1),
        "source_url": "https://laws.gov.sz/companies-act",
    },
    {
        "title": "Criminal Procedure and Evidence Act",
        "doc_type": "act",
        "act_number": "Act 45 of 1938",
        "year": 1938,
        "chapter": "Chapter 20",
        "ministry": "Justice",
        "status": "active",
        "commencement_date": date(1939, 1, 1),
        "source_url": "https://laws.gov.sz/criminal-procedure",
    },
    {
        "title": "Land Act, 1967 (as amended)",
        "doc_type": "act",
        "act_number": "Act 5 of 1967",
        "year": 1967,
        "chapter": "Chapter 43:01",
        "ministry": "Agriculture",
        "status": "active",
        "commencement_date": date(1968, 4, 1),
        "source_url": "https://laws.gov.sz/land-act",
    },
    {
        "title": "Income Tax Order, 1975",
        "doc_type": "act",
        "act_number": "Order 21 of 1975",
        "year": 1975,
        "chapter": "Chapter 54:01",
        "ministry": "Finance",
        "status": "active",
        "commencement_date": date(1975, 7, 1),
        "source_url": "https://laws.gov.sz/income-tax",
    },
    {
        "title": "Environment Management Act, 2002",
        "doc_type": "act",
        "act_number": "Act 5 of 2002",
        "year": 2002,
        "chapter": "Chapter 28:03",
        "ministry": "Environment",
        "status": "active",
        "commencement_date": date(2002, 12, 1),
        "source_url": "https://laws.gov.sz/environment-management-act",
    },
    {
        "title": "Children's Protection and Welfare Act, 2012",
        "doc_type": "act",
        "act_number": "Act 6 of 2012",
        "year": 2012,
        "chapter": "Chapter 50:02",
        "ministry": "Social Development",
        "status": "active",
        "commencement_date": date(2013, 1, 1),
        "source_url": "https://laws.gov.sz/childrens-act",
    },
    {
        "title": "Financial Services Regulatory Authority Act, 2010",
        "doc_type": "act",
        "act_number": "Act 5 of 2010",
        "year": 2010,
        "chapter": "Chapter 52:01",
        "ministry": "Finance",
        "status": "active",
        "commencement_date": date(2011, 3, 1),
        "source_url": "https://laws.gov.sz/fsra-act",
    },
    {
        "title": "Public Health Act",
        "doc_type": "act",
        "act_number": "Act 13 of 1963",
        "year": 1963,
        "chapter": "Chapter 30:01",
        "ministry": "Health",
        "status": "active",
        "commencement_date": date(1964, 1, 1),
        "source_url": "https://laws.gov.sz/public-health-act",
    },
    {
        "title": "Marriage Act",
        "doc_type": "act",
        "act_number": "Act 47 of 1887",
        "year": 1887,
        "chapter": "Chapter 27:02",
        "ministry": "Justice",
        "status": "active",
        "commencement_date": date(1888, 1, 1),
        "source_url": "https://laws.gov.sz/marriage-act",
    },
]


async def seed_documents():
    engine = create_async_engine(settings.database_url, echo=False)

    async with engine.begin() as conn:
        pass

    async_session = async_sessionmaker(engine, expire_on_commit=False)

    async with async_session() as session:
        for doc_data in ESWATINI_LEGAL_CORPUS:
            query = select(LegalDocument).where(
                LegalDocument.title == doc_data["title"]
            )
            result = await session.execute(query)
            existing = result.scalar_one_or_none()

            if not existing:
                doc = LegalDocument(
                    title=doc_data["title"],
                    doc_type=doc_data["doc_type"],
                    act_number=doc_data["act_number"],
                    year=doc_data["year"],
                    chapter=doc_data["chapter"],
                    ministry=doc_data["ministry"],
                    status=doc_data["status"],
                    commencement_date=doc_data["commencement_date"],
                    source_url=doc_data["source_url"],
                    file_path=None,
                )
                session.add(doc)
                print(f"Added: {doc_data['title']}")
            else:
                print(f"Exists: {doc_data['title']}")

        await session.commit()

    await engine.dispose()
    print(f"\nSeeded {len(ESWATINI_LEGAL_CORPUS)} legal document records")


if __name__ == "__main__":
    asyncio.run(seed_documents())
