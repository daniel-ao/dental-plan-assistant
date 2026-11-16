# DentaPlan AI — Brand & UI/UX Design System

Version 0.1 (POC). Source of truth for tokens: `src/styles.css`. Source of truth for structure: `index.html`. PDF styling lives in `src/pdf.js`.

---

## 1. Brand

### 1.1 Name and tagline
- **Name:** DentaPlan AI (one word "DentaPlan", capital D and P, then "AI" separated by a space).
- **Tagline:** *From clinical conversation to patient-ready treatment plan.*

### 1.2 Positioning
DentaPlan AI is a chairside assistant for dentists. It turns a spoken treatment discussion into a staged, priced treatment plan PDF grounded in the clinic's own price list. It is a **drafting tool, not a decision-maker**. The dentist stays the author and the final approver of every document.

| We are | We are not |
|---|---|
| A fast, careful scribe that knows the clinic price list | An autonomous clinician or diagnostic tool |
| Transparent about what it did not understand | A black box that fills gaps silently |
| Calm and clinical | Playful, salesy or "magic" |

### 1.3 Voice and tone
- **Calm.** No exclamation marks, no urgency language. Errors are stated plainly with the next step ("Microphone blocked. You can type the plan instead.").
- **Clinical and precise** in the dentist-facing UI. Use FDI tooth numbers, catalog item names and euro amounts exactly as they appear in the price list.
- **Reassuring and plain-language** on patient-facing output (the PDF). Short sentences, no unexplained abbreviations, costs shown clearly with what is still to be confirmed.
- **Honest about uncertainty.** Say "To be confirmed" (TBC), never guess silently.
- Refer to people with neutral language (they/them, "the patient", "the dentist").

Microcopy examples:

| Situation | Use | Avoid |
|---|---|---|
| Missing price | "Price to be confirmed" | "N/A", "0 €" |
| Ambiguous item | "Which crown material did you mean?" | "Error: unknown item" |
| Approval gate | "Download and sending unlock only after explicit dentist approval of the latest version." | "Locked" |
| Suspicious text | "This sentence looks like an instruction to the app, not part of the plan. It was not applied." | "Hack detected" |

### 1.4 Logo usage
- **Mark (placeholder):** the 🦷 tooth emoji at 28px (`.logo`), followed by the wordmark **DentaPlan AI** in Inter 600/700 and the tagline in `<small>` at 12px, 85% opacity.
- Lock-up sits on the teal header gradient, white text only.
- Clear space: at least the height of the mark on every side. Do not recolour, rotate or add effects to the mark.
- The emoji is a POC placeholder. A production mark should be a simple single-colour tooth glyph drawn in SVG so it renders the same on every OS and in the PDF.

---

## 2. Foundations

### 2.1 Colour tokens

Defined on `:root` in `src/styles.css`; dark values via `prefers-color-scheme: dark`.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--bg` | `#f5f7fb` | `#0b1120` | App background, input fill, table header |
| `--card` | `#ffffff` | `#111827` | Card surface, default button |
| `--ink` | `#0f172a` | `#e5e7eb` | Primary text |
| `--muted` | `#64748b` | `#94a3b8` | Secondary text, labels, hints |
| `--line` | `#e2e8f0` | `#1f2937` | Borders, dividers |
| `--teal` | `#0d9488` | `#0d9488` | Primary action, selected chip, stage headings, links |
| `--teal2` | `#14b8a6` | `#14b8a6` | Accent / hover highlight |
| (header) | `#0f766e → #0d9488` | same | Header gradient, status pill text |
| `--warn` | `#c2410c` | `#c2410c` | High-priority question border, TBC rows |
| `--warnbg` | `#fff7ed` | `#2a1608` | Open question background |
| `--ok` | `#047857` | `#047857` | Approve button, answered question, unlocked gate |
| (medium) | `#d97706` | same | Medium-priority question border |
| (record) | `#fee2e2` / `#b91c1c`, active `#dc2626` | same | Record button idle / recording |

Rules:
- Teal means "the main thing to do next". Use it for one primary button per card.
- Orange (`--warn`) means "needs the dentist's attention". Never use it decoratively.
- Green (`--ok`) means "approved / resolved". Reserved for approval and answered states.
- Red is reserved for the microphone (live recording). It is not an error colour here.
- Do not convey state with colour alone: pair it with text (priority label, "TBC", "Approved", lock icon).

### 2.2 Typography
- **Family:** `Inter, system-ui, sans-serif`. Base size 14px, line-height ~1.45 in text areas.
- **Scale:**

| Use | Size / weight |
|---|---|
| Card title `h2` | 16px / 700 |
| Section label `h3` | 13px / 700, uppercase, letter-spacing .04em, `--muted` |
| Body, inputs, buttons | 14px (buttons 600) |
| Labels, hints, tables, stepper | 12px |
| Question meta | 11px uppercase, .04em |
| Summary pill value | 16px bold |

- Numbers (prices, totals) right-aligned (`td.r`) and never wrapped.

### 2.3 Spacing, radius, elevation
- **Spacing scale (px):** 4, 6, 8, 10, 12, 16, 18, 24. Grid gap and page padding 16; card padding 18; header padding 14/24.
- **Radius:** 6 (thumbnails), 8 (inputs, buttons, version rows), 10 (questions, pills, PDF frame), 14 (cards), 999 (stepper pills).
- **Elevation:** flat. Cards use a 1px `--line` border plus `0 1px 2px rgba(0,0,0,.04)`. Depth comes from borders, not shadows. The only animated shadow is the recording pulse.

---

## 3. Layout

- **≥1100px:** three columns in `.grid` (`minmax(300px,1fr) | minmax(340px,1.2fr) | minmax(340px,1.2fr)`), max width 1700px, centred. Columns follow the workflow left to right: **Dictate → Plan & questions → Review & approve**.
- **<1100px:** single stacked column in the same order, so the flow reads top to bottom on tablets at the chair.
- Rows (`.row`) wrap with a 120px minimum per field; action bars (`.actions`) wrap.

---

## 4. Components

### 4.1 Header and stepper
Teal gradient bar with brand lock-up, a four-step stepper and a status pill.
- Steps: **Dictate → Clarify → Review PDF → Approve**.
- States: default (white 15% fill), `.on` (white fill, teal text, 600), `.done` (white 35% fill).
- Exactly one step is `.on` at a time.

### 4.2 Status pill
`.status`: white chip, teal 600 text, 12px. Shows the document state: `Draft`, `Draft v2`, `Approved v3`. Any edit after approval returns it to `Draft vN`.

### 4.3 Cards
`.card` is the only container. One card per workflow stage, one `h2` per card, one primary button per card.

### 4.4 Buttons
| Variant | Class | Use |
|---|---|---|
| Primary | `.primary` | Build plan, Apply answers |
| Approve | `.approve` | Approve the current version (green) |
| Default | none | Download, Send, Apply correction |
| Ghost | `.ghost` | New plan / reset |
| Disabled | `:disabled` | 45% opacity, `not-allowed` cursor |

### 4.5 Record button
`.mic` (and `.mic.small` for the correction field).
- **Idle:** pale red fill `#fee2e2`, red text, label "● Record" / "● Speak".
- **Recording:** `.rec`, solid `#dc2626`, white text, 1.2s pulse ring. Label changes to "■ Stop".
- **Unavailable / denied:** button disabled, hint text explains that typing works the same way. The transcript area always stays editable.

### 4.6 Summary pills
`.pill` inside `.summary`: stages, items, total, open questions. Value bold 16px above a 12px label.

### 4.7 Question cards
`.q` with a 4px left border coding priority, plus a meta line naming the priority in text.

| State | Border | Background |
|---|---|---|
| High | `--warn` `#c2410c` | `--warnbg` |
| Medium (`.medium`) | `#d97706` | `--warnbg` |
| Low (`.low`) | `#64748b` | `--warnbg` |
| Answered (`.answered`) | `--ok` | transparent, 75% opacity |

High-priority questions sort first. A "Suspicious instruction" question (see the security doc) is always High.

### 4.8 Option chips
`.opts button`: 12px, 500 weight, compact. Selected chip `.sel` is teal with white text. A free-text input can sit in the same row for "Other".

### 4.9 Stage tables
- `.stagehead` (teal, bold) titles each stage, e.g. "Stage 2 — after 3 months".
- Columns: item, teeth, qty, unit price, line total (right-aligned).
- `tr.tbc` rows render in `--warn` when a price or quantity is still to be confirmed. They are never hidden or zeroed.

### 4.10 PDF preview
`.pdfwrap` 520px framed area with an `iframe`. Empty state: centred muted text "The PDF preview appears here."

### 4.11 Version list and diff
- `.versions li`: one row per version (label left, timestamp `small` right). Current version has a teal border (`.cur`). Click to preview.
- `.diff`: compact list of what changed between versions (added / removed / repriced items).

### 4.12 Approval gate
- `.gate` message under the Approve / Download / Send bar: "🔒 Download and sending unlock only after explicit dentist approval of the latest version."
- `.gate.ok` (green) once the latest version is approved.
- Download and Send stay disabled until then. Any new version re-locks them.

---

## 5. PDF document design

Generated with jsPDF in `src/pdf.js`, A4 portrait.

1. **Header band:** full-width teal band (`#0d9488`) with clinic name, "Treatment plan", patient, dentist, date and version.
2. **Stage tables:** one per stage, teal stage title, light-grey header row, right-aligned amounts in EUR. TBC lines in orange with the words "to be confirmed".
3. **Total bar:** full-width bar after the last stage with the plan total. If any line is TBC the label reads "Estimated total (excludes items to be confirmed)".
4. **Open questions box:** orange-bordered box (`#c2410c`, light orange fill) listing unresolved questions, so nothing uncertain reaches the patient unflagged.
5. **DRAFT watermark:** large diagonal light-grey "DRAFT" on every page until the dentist approves that exact version. Approved PDFs carry "Approved by <dentist> on <date>, v<N>" in the footer instead.
6. **Footer:** page numbers, clinic line, and a short note that the estimate is valid subject to clinical review.

PDF typography uses Helvetica (jsPDF built-in) as the closest safe match to Inter. Generated text never contains active links.

---

## 6. Interaction principles

1. **The dentist is always in control.** The app proposes; the dentist decides. Nothing is approved, downloaded or sent without a click by the dentist.
2. **Never hide uncertainty.** Unknown prices, ambiguous items and suspicious text become visible questions or TBC rows, never silent defaults.
3. **One primary action per step.** Each card has one teal button that moves the workflow forward.
4. **Everything is reversible until approval, and traceable after.** Every regeneration creates a new version with a diff.
5. **Voice and keyboard are equal.** Anything you can say, you can type.
6. **Grounded in the price list.** Items and prices come from the clinic catalog or from an explicit edit by the dentist.

---

## 7. Accessibility

- **Contrast (WCAG 2.1 AA):** `--ink` on `--bg`/`--card`, white on `--teal` `#0d9488` for 14px bold button text (meets the 3:1 large/bold threshold; use `#0f766e` for small regular white text), `--warn` on `--warnbg`, `--ok` white text. Known gap: `--muted` `#64748b` is about 4.8:1 on white cards but about 4.4:1 on `--bg` `#f5f7fb`, just under 4.5:1 for 12px text. Darken to `#5b6b80` (or keep muted text on cards only) before production.
- **Not colour alone:** priority, TBC and approval states always carry a text label.
- **Keyboard:** all actions are native `<button>`, `<input>`, `<select>`. Logical tab order follows the columns. Visible focus outline must not be removed.
- **Screen readers:** labelled form fields (`<label>` wrapping inputs), `title` on the PDF iframe and mic buttons. Status changes (recording started, plan built, version approved) should be announced through an `aria-live="polite"` region.
- **Motion:** the recording pulse should respect `prefers-reduced-motion` (static ring instead).
- **Microphone fallback:** if the Web Speech API is missing or permission is denied, the mic button disables with an explanation and the typed transcript works the same way.
- **Touch targets:** buttons at least 36px high; chips at least 32px, with 6px gaps.
