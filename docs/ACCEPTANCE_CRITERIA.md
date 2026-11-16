# Acceptance Criteria and PRD Scenario Traceability

Status legend: **Met** = works in the MVP · **Partial** = works with a stated limitation · **Not in POC** = deferred to production.

## 1. Course acceptance criteria

| # | Criterion | How it is met | Evidence | Status |
|---|---|---|---|---|
| 1 | **Understands voice** | `src/app.js` (voice) uses the browser Web Speech API (en-GB / fr-FR) with a live interim transcript and start/stop. The final transcript is editable and fed to the extraction engine. Voice also works for corrections. | Demo in Chrome/Edge: dictate Patient 1 and the plan is built | **Met** (requires a browser with SpeechRecognition; text fallback otherwise) |
| 2 | **Asks clarifying questions** | `src/engine/plan.js` raises prioritised questions for missing implant system, crown type, discount %, ranges, sedation choice, dictated ≠ list price, contradictory prices, count mismatches, missing intervals, unmatched items and missing patient name. Each has options plus free text. | Patient 1 shows questions on implant system, 7 vs 5 crowns, sedation, and so on; Patient 4 shows €890 vs €750 vs €830 (see `SAMPLE_ANALYSIS.md`) | **Met** |
| 3 | **Generates a PDF** | `src/pdf.js` (jsPDF + autotable) renders a branded PDF with clinic header, patient/dentist/date, staged table with intervals, teeth, qty, unit price, discount, line total, subtotals, grand total, open-questions box, notes, version number and DRAFT watermark | PDF v1 appears after "Build plan" | **Met** |
| 4 | **Regenerates the PDF with the answers** | Answers are applied as field-level patches. A new plan snapshot and PDF are saved as v2 with a change summary and a diff against v1. Voice/text corrections produce v3 and later versions. | Version history lists v1, v2, v3 with summaries | **Met** |

## 2. PRD end-to-end scenario (16 steps)

| # | Step | How it is met in the MVP | Status |
|---|---|---|---|
| 1 | Dentist opens the assistant and starts a new consultation | Single-page app, "New plan" resets the workspace | Met |
| 2 | Dentist selects/enters the patient | Patient name field. A name in the dictation is extracted. If missing, a question is raised. | Met (no patient database) |
| 3 | Dentist dictates the plan by voice | Web Speech API, live transcript | Met (browser-dependent) |
| 4 | Dentist reviews/edits the transcript | Editable transcript box | Met |
| 5 | Optional: dentist attaches X-ray / images | Image upload (JPG/PNG), embedded in the PDF | Partial: attached as images only, with no DICOM or analysis |
| 6 | System extracts stages, procedures, teeth, quantities, discounts | `engine/extract.js`, rule-based, with source spans and confidence | Met (covers the sample-note phrasing and close variants) |
| 7 | System prices each item from the clinic price list | `engine/plan.js` with `catalog.js` (208 items from the xlsx). Unknown items are priced TBC. | Met |
| 8 | System detects ambiguities, contradictions, missing data | `engine/plan.js` | Met |
| 9 | System generates draft PDF v1 with open questions | `pdf.js`, DRAFT watermark, open-questions box | Met |
| 10 | System asks the clarifying questions | Clarify step, sorted by priority | Met |
| 11 | Dentist answers (voice or text) | Option buttons, free text, dictation into the answer field | Met |
| 12 | System regenerates PDF v2 with the answers | New version plus change summary and diff | Met |
| 13 | Dentist requests a correction by voice/text | `engine/revise.js` commands (price, remove, add, discount, move, change crown/implant, interval) | Met (fixed command grammar) |
| 14 | System applies the correction and creates v3 | Field-level patch, new version, status back to Awaiting Dentist Review | Met |
| 15 | Dentist explicitly approves the version | "Approve vN" records the dentist name and timestamp. The watermark becomes "Approved by Dr … on …". | Met (no authentication, so approver identity is self-declared) |
| 16 | Approved PDF is downloaded / sent to the patient | Download enabled only for approved versions. "Send" opens mailto or downloads the file. Status becomes Sent to Patient. | Partial: email sending is simulated |

## 3. Cross-cutting requirements

| Requirement | Status | Notes |
|---|---|---|
| Prices never invented | Met | Catalog, dictated or answered values only. TBC items are excluded from the total. |
| Every PDF versioned | Met | Immutable in-memory snapshots, with diff and audit log |
| Approval gates download/sending | Met | Any edit after approval resets the status |
| Status machine (Draft → Missing Information → Awaiting Review → Changes Requested → Approved → Sent) | Met | `src/app.js` |
| Patient data stays private | Met for POC | Client-only. Speech may be processed by the browser vendor. Do not use real patient data. |
| Authentication / roles | **Not in POC** | Planned OAuth2/OIDC with RBAC |
| Real email delivery | **Not in POC** | Simulated via mailto/download |
| Server-side storage, multi-device | **Not in POC** | in-memory session only |
| Automated tests and CI | Met | `node --test` on `tests/*.test.mjs`; GitHub Actions runs the tests and deploys to Pages from `main` |
