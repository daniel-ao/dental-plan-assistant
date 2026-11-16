# DentaPlan AI — Brand & UI/UX Design System

Version 0.2 (POC, UI refresh). Source of truth for tokens: `src/styles.css`. Source of truth for structure: `index.html`. PDF styling lives in `src/pdf.js`.

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
- **Mark:** a single-colour outlined tooth glyph drawn inline in SVG (`.logo`, 28px, white 1.6 stroke), followed by the wordmark **DentaPlan AI** in Inter 700 and the tagline in `<small>` at 12px, 80% opacity. The tagline is hidden below 700px.
- Lock-up sits on the flat `--head` header colour, white only.
- Clear space: at least the height of the mark on every side. Do not recolour, rotate or add effects to the mark.
- No emoji anywhere in the UI. Icons are 16px inline SVG line icons (`.ic`, 2px stroke, `currentColor`), used only where they carry meaning (lock, check, attach).

---

## 2. Foundations

### 2.1 Colour tokens

Defined on `:root` in `src/styles.css`. Dark values apply under `prefers-color-scheme: dark` (unless `data-theme="light"`) and under `:root[data-theme="dark"]`. Neutrals are tinted toward the brand teal; dark mode is its own teal-grey palette, not an inversion.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--bg` | `#f3f6f5` | `#0b1413` | App background |
| `--card` | `#ffffff` | `#111c1b` | Card surface, default button, chips |
| `--sunk` | `#eef3f2` | `#0d1817` | Input fill, PDF frame, diff box, hover row |
| `--ink` | `#0f1f1d` | `#e3ecea` | Primary text |
| `--muted` | `#56676a` | `#98aba8` | Secondary text, labels, hints, table headers |
| `--line` | `#dde6e4` | `#22322f` | Borders, dividers |
| `--teal` | `#0d9488` | `#0d9488` | Accent rules: current version, focused field, focus ring (light) |
| `--btn` / `--btn-hover` | `#0f766e` / `#115e59` | same | Primary button and selected chip fill (white text 5.5:1) |
| `--teal-ink` | `#0f766e` | `#2dd4bf` | Teal as text: step numbers, links, primary hover (light) |
| `--teal2` | `#14b8a6` | `#14b8a6` | Reserved accent |
| `--head` | `#0f766e` | `#0c2724` | Flat header background |
| `--warn` | `#c2410c` | `#f0894a` | High-priority border, TBC rows, open counts |
| `--warnbg` | `#fff7ed` | `#24170d` | Open question background |
| `--medium` | `#d97706` | `#e3a23b` | Medium-priority question border |
| `--ok` | `#047857` | `#047857` | Approve button fill |
| `--ok-ink` | `#047857` | `#34d399` | Approved / answered as text or border |
| `--rec` | `#dc2626` | `#dc2626` | Recording dot and active record button |

Rules:
- Teal means "the main thing to do next". Use it for one primary button per card.
- Orange (`--warn`) means "needs the dentist's attention". Never use it decoratively.
- Green (`--ok`) means "approved / resolved". Reserved for approval and answered states.
- Red is reserved for the microphone (the record dot and live recording). It is not an error colour here.
- No gradients, glows or glass effects.
- Do not convey state with colour alone: pair it with text (priority label, "TBC", "Approved", lock icon).

### 2.2 Typography
- **Family:** `Inter, system-ui, sans-serif`. Base size 14px, line-height ~1.45 in text areas.
- **Scale:**

| Use | Size / weight |
|---|---|
| Plan total (summary lead) | 26px / 700, -.02em |
| Card title `h2` | 17px / 700, step number 13px / 600 in `--teal-ink` |
| Secondary stats | 18px / 600 |
| Body, inputs, buttons | 14px, line-height 1.45 (textarea 1.55); buttons 600 |
| Tables, stepper | 13px |
| Labels, hints | 12px / 500 |
| Section label `h3`, table header, question meta | 11–12px / 600 uppercase, .05em, `--muted` |

- Numbers use tabular figures, prices right-aligned (`td.r`) and never wrapped. Question text is capped at 68ch.

### 2.3 Spacing, radius, elevation
- **Spacing scale (px):** 4, 6, 8, 10, 12, 16, 18, 24. Grid gap and page padding 16; card padding 18; header padding 14/24.
- **Spacing (v0.2):** grid gap and page padding 20 (16 below 1100px, 12 on phone); card padding 20 (16 on phone); 24 above section labels.
- **Radius:** 6 (thumbnails, status), 8 (inputs, buttons, question right edge), 10 (PDF frame), 12 (cards), 50% (step numbers).
- **Elevation:** flat, no shadows. Cards use a 1px `--line` border. The Review column is a quiet surface (no card) on wide screens so the plan reads as the main work area. The only animated shadow is the recording pulse.

---

## 3. Layout

- **≥1100px:** three columns in `.grid` (`minmax(300px,1fr) | minmax(340px,1.2fr) | minmax(340px,1.2fr)`), max width 1700px, centred. Columns follow the workflow left to right: **Dictate → Plan & questions → Review & approve**.
- **<1100px:** single stacked column in the same order, so the flow reads top to bottom on tablets at the chair.
- Rows (`.row`) wrap with a 120px minimum per field; action bars (`.actions`) wrap.

---

## 4. Components

### 4.1 Header and stepper
Flat `--head` bar with brand lock-up, a numbered progress line and the status label.
- Steps: **Dictate → Clarify → Review PDF → Approve**, numbered circles joined by hairlines (CSS counters, no extra markup).
- States: default (70% white text, outlined number), `.on` (white text 600, filled white number), `.done` (number replaced by a check).
- Exactly one step is `.on` at a time. Below 700px the stepper drops to its own row and shows only the current step's label.

### 4.2 Status pill
`.status`: 14% white fill on the header, white 600 text, 12px, radius 6. Shows the document state: `Draft`, `Draft v2`, `Approved v3`. Any edit after approval returns it to `Draft vN`.

### 4.3 Cards
`.card` is the only container. One card per workflow stage, one `h2` per card, one primary button per card. `.card.quiet` (Review) drops its surface above 1100px.

### 4.4 Buttons
| Variant | Class | Use |
|---|---|---|
| Primary | `.primary` | Build plan, Apply answers |
| Approve | `.approve` | Approve the current version (green) |
| Default | none | Download, Send, Apply correction |
| Ghost | `.ghost` | New plan / reset (muted text, no border until hover) |
| Disabled | `:disabled` | 45% opacity, `not-allowed` cursor |

All buttons and fields are at least 44px high. Hover changes the border only; no movement or scaling.

### 4.5 Record button
`.mic` (and `.mic.small` for the correction field).
- **Idle:** default button with a 9px red dot (the `●` span, drawn in CSS), label "Record" / "Speak".
- **Recording:** `.rec`, solid `--rec`, white text, the dot becomes a white square, soft 1.6s ring. Label changes to "Stop". Reduced motion shows a static ring.
- **Unavailable / denied:** button disabled, hint text explains that typing works the same way. The transcript area always stays editable.

### 4.6 Plan summary
`.summary` is one stat row, not boxes. The total (`.pill.main`) leads on its own line at 26px, labelled "excluding TBC" when needed. Stages, Items TBC and Open questions follow, separated by hairlines. Non-zero TBC/open counts use `--warn` (`.attn`).

### 4.7 Question cards
`.q` with a 3px left border coding priority (no other border), plus a meta line naming the priority in text.

| State | Border | Background |
|---|---|---|
| High | `--warn` `#c2410c` | `--warnbg` |
| Medium (`.medium`) | `#d97706` | `--warnbg` |
| Low (`.low`) | `#64748b` | `--warnbg` |
| Answered (`.answered`) | `--ok` | transparent, 75% opacity |

High-priority questions sort first. A "Suspicious instruction" question (see the security doc) is always High.

### 4.8 Option chips
`.opts button`: 13px, 500 weight, 36px high (44px on touch screens). Selected chip `.sel` is teal with white text. A free-text input can sit in the same row for "Other".

### 4.9 Stage tables
- `.stagehead` (ink, 600) titles each stage, e.g. "Stage 2 · Healing abutments · After 3 months", with timing in `--muted`. Table headers are small uppercase muted text with no fill.
- Columns: item, teeth, qty, unit price, line total (right-aligned).
- `tr.tbc` rows render in `--warn` when a price or quantity is still to be confirmed. They are never hidden or zeroed.

### 4.10 PDF preview
`.pdfwrap` 560px framed area (460px on phone) with an `iframe`. Empty, it collapses to its message: "The PDF draft shows here once the plan is built."

### 4.11 Version list and diff
- `.versions li`: one row per version (label left, timestamp `small` right). 2px left rule; the current version (`.cur`) has a teal rule and card fill. Click to preview.
- `.diff`: compact list of what changed between versions (added / removed / repriced items).

### 4.12 Approval gate
- `.gate` message under the Approve / Download / Send bar, with a lock icon: "Download and sending unlock only after explicit dentist approval of the latest version."
- `.gate.ok` (`--ok-ink`, check icon) once the latest version is approved.
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

- **Contrast (WCAG 2.1 AA):** `--ink` on `--bg`/`--card`, white on `--btn` `#0f766e` (5.5:1) for buttons and selected chips, `--warn` on `--warnbg`, `--ok` white text. `--muted` is above 4.5:1 on every surface in both themes. In dark mode, teal and orange text use the lighter `--teal-ink` / `--warn` values to stay above 4.5:1.
- **Not colour alone:** priority, TBC and approval states always carry a text label.
- **Keyboard:** all actions are native `<button>`, `<input>`, `<select>`. Logical tab order follows the columns. Every control shows a 2px `--focus` outline on `:focus-visible`; fields also get a teal border and soft ring.
- **Screen readers:** labelled form fields (`<label>` wrapping inputs), `title` on the PDF iframe and mic buttons. Status changes (recording started, plan built, version approved) should be announced through an `aria-live="polite"` region.
- **Motion:** the recording pulse should respect `prefers-reduced-motion` (static ring instead).
- **Microphone fallback:** if the Web Speech API is missing or permission is denied, the mic button disables with an explanation and the typed transcript works the same way.
- **Touch targets:** buttons and fields at least 44px high; chips 36px with 6px gaps, 44px on touch screens.
