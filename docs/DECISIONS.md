# Architecture Decision Records

## ADR-001: Static, client-only POC

- **Status:** Accepted
- **Context:** The POC was a 30-minute build that had to show the four course criteria with a public demo URL, without secrets and without handling real patient data on a server.
- **Decision:** Build a static HTML/CSS/ES-module app with no backend. All state (plans, versions, PDFs, audit log) lives in the browser's localStorage.
- **Consequences:**
  - (+) No hosting cost or operations, no API keys, and patient data never reaches a server we run.
  - (+) Anyone can open and evaluate it.
  - (−) There is no multi-user access, auth, durable storage or real email.
  - (−) localStorage is per browser and unencrypted.
  - These gaps are covered by the target architecture in `PRODUCT_ARCHITECTURE.md` §10.

## ADR-002: Deterministic rule-based extraction instead of an LLM (for the POC)

- **Status:** Accepted
- **Context:** Extraction must map free dictation to the 208 price-list items without ever inventing a price, and the demo must be reproducible and testable.
- **Decision:** Implement extraction (`src/engine/extract.js`) as deterministic rules:
  - stage, quantity, FDI-tooth, discount and price parsers;
  - a synonym table that maps phrases to catalog IDs;
  - each item keeps its source span and match status.

  Extraction is behind one interface, `extract(text, catalog) → ExtractedPlan`, which is the **LLM plug-in point**.
- **Consequences:**
  - (+) No keys or cost, the same input always gives the same output, and the rules are unit-testable against the 5 sample notes.
  - (+) Outputs can only reference existing catalog IDs.
  - (−) Phrasing outside the rules is missed. The mitigation is that unmatched fragments become questions and are never dropped.
  - Production plan: an LLM with JSON-Schema structured output whose `catalogId` is an enum of the clinic's IDs. Prices are joined from the database. The current rules stay as post-validation guard-rails.

## ADR-003: Client-side PDF generation with jsPDF

- **Status:** Accepted
- **Context:** A PDF is required, and it must be regenerated for every version without a server.
- **Decision:** Use jsPDF + jspdf-autotable, loaded from a CDN with pinned versions, to render the PDF in the browser. Store each version's blob with its snapshot.
- **Consequences:**
  - (+) Generation is instant, works offline after load and keeps data local.
  - (+) The watermark and version stamp are under our control.
  - (−) Typography and layout are less flexible than HTML-to-PDF.
  - (−) Fonts need embedding for non-Latin scripts.
  - Production may move to server-side templated rendering for clinic branding and e-signature.

## ADR-004: GitHub Pages hosting with GitHub Actions CI

- **Status:** Accepted
- **Context:** The demo needs a stable public URL and an automated quality gate.
- **Decision:** `.github/workflows/ci.yml` runs `node --test` on every push and PR, and deploys the static site to GitHub Pages from `main` only when the tests pass.
- **Consequences:**
  - (+) Free, simple, reproducible deploys.
  - (−) The site is public, so it must only be used with fictional or anonymised data.
  - (−) There are no server-side features and no custom security headers beyond what Pages provides.
  - Production will move to EU/HDS-certified hosting.
