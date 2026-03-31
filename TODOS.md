# TODOS

## P1 — 48-Hour Prototype (In Scope)

### "Is this still good law?" tracking — ADDED TO PROTOTYPE
**What:** Add `case_status` field to judgments table (active, overruled, distinguished, amended). Verification output shows OVERRULED/WARN when a cited case is not active. Status defaults to "active" for seed judgments.

**Why:** A VALID citation that was overruled is a false confidence signal. Derrick's firm is worse off with a tool that says VERIFIED on overruled cases than with no tool at all. The disclaimer does not fix this — users trust the tool.

**Status:** In scope — added after outside voice review (Claude subagent challenged the original deferral).

**Data model change:**
```sql
ALTER TABLE judgments ADD COLUMN case_status TEXT DEFAULT 'active';
-- active | overruled | distinguished | amended
```

**Verification logic change:**
- exact match + ACTIVE → "VERIFIED"
- exact match + OVERRULED → "OVERRULED — case may no longer be good law"
- fuzzy match → AMBER (unchanged)

---

## P1 — Post-Prototype (After First Paid Pilot)

### Still good law: full legislative tracking
**What:** Integrate with Eswatini Judiciary for live case status updates. Track amended statutes, replaced provisions.

**Status:** Deferred — requires Judiciary partnership.

**Depends on:** Eswatini legal corpus partnership with Judiciary.

---

## Backlog

- [ ] SRL document generator (free tier — Phase 2)
- [ ] Ollama/RAG pipeline integration (Phase 3)
- [ ] Air-gap physical corpus update mechanism (institutional tier)
- [ ] Docker deployment for institutional tier
- [ ] Multi-tenant deployment (law firm seats)
- [ ] Practice direction advocacy with Justice Maseko
- [ ] Magistrate court pilot with Sipho Dlamini
- [ ] Parliamentary engagement with Hon. Nkambule
