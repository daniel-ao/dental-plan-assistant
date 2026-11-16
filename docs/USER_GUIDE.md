# User Guide: Demo Walkthrough for the Dentist

The assistant turns a dictated treatment plan into a staged, priced, patient-friendly PDF. You stay in control. The assistant asks about anything unclear, every PDF is saved as a new version, and nothing can be downloaded or sent until you approve it.

> Demo only: do not enter real patient data. Everything is stored in this browser (localStorage).

## Before you start

- Open the app (GitHub Pages URL) in **Chrome or Edge** for voice dictation. Safari works in recent versions. Firefox has no speech recognition, so use the text box there.
- Allow microphone access when the browser asks.
- Choose the dictation language: **English (en-GB)** or **French (fr-FR)**.

The screen follows four steps: **1 Dictate → 2 Clarify → 3 Review PDF → 4 Approve**. The **Version history** panel on the side lists every version with its status.

---

## Walkthrough A: Patient 1 (multi-stage implant plan)

### Step 1: Dictate

1. Click **Start dictation** and speak naturally, for example:
   > "Patient one. Stage 1: SRP one segment, pre-operative hygiene with discount, sinus lift during implant placement 2 to 3 implants, implants at sites 45, 35, 37, bone grafting around one implant free of charge under the Doluchys programme, 1 sterilisation pack, sedation 4 hours or without sedation. Stage 2 after 3 months: healing abutments on 3 implants, gingival grafting around 3 implants, 3 times local anaesthesia, 1 single-use hygiene kit, scan of 3 implants, temporary crowns on 4 implants plus model plus hygiene kit…"
2. The grey text is the live (interim) transcript. Finalised text turns black.
3. Click **Stop**. Correct any misheard words directly in the transcript box.
4. Shortcut: choose **Sample dictations → Patient 1** to load the full note.
5. Click **Build plan**.

### Step 2: Clarify

The assistant shows the questions, sorted **High / Medium / Low**. For Patient 1 you should see questions like these:

| Priority | Question | Example answer |
|---|---|---|
| High | Which implant system? | Osstem €460 / Megagen AnyOne €470 / Straumann BLT €830 / Nobel €830 |
| High | Sinus lift: 2–3 implants, which one is it? | "Sinus lift during implant placement, 2–3 implants" €630 |
| High | Sedation 4 h or without sedation? | 4 h |
| High | Crowns on 7 implants, but only 5 implants are planned. Which count is correct? | 5 |
| Medium | Temporary crowns on 4 implants in stage 2, but 3 implants were placed in stage 1. Which count is correct? | 3 |
| Medium | Discount % for pre-operative hygiene? | 10 % |
| Medium | Two stages are called "Stage 4". Renumber the second one as Stage 5? | Yes |
| Medium | SRP "1 segment": per tooth or per jaw? | per tooth × 6 |
| Low | Interval before stage 3 / 4 / 5? | 3 months |
| Low | Patient name? | (type the name) |

Pick an option or type a free-text answer, then click **Apply answers**. You do not have to answer everything at once. Unanswered items stay in the PDF as **TBC** and are left out of the total.

### Step 3: Review the PDF

- **PDF v1** is created right after you click *Build plan*. It is marked **DRAFT – not approved** and has an *Open questions* box.
- Once you apply answers, **PDF v2** is generated. Version history shows what changed (for example, "Implant system set to Straumann BLT, 5 × €830").
- Check each stage: interval, teeth, quantity, unit price, discount, line total, stage subtotal and the grand total.

### Step 4: Correct by voice or text

Click **Correction** (microphone or text) and say something like:

> "Set discount 10% on healing abutment placement."

The assistant applies only that change, shows a one-line summary and creates **PDF v3**.

### Step 5: Approve and send

1. Click **Approve version 3**. The watermark changes to **"Approved by Dr … on …"**.
2. **Download PDF** and **Send to patient** become active. In the MVP, sending opens your email client (mailto) or downloads the file.
3. If you change anything after approval, the plan goes back to **Awaiting Dentist Review** and you need to approve the new version.

---

## Walkthrough B: Patient 4 (free-form notes, price conflicts)

1. Load **Sample dictations → Patient 4**, or dictate:
   > "Patient plays the saxophone. Extract the 4 front teeth and place 2 or 3 implants. Straumann implants with zirconia crowns. 2 implants submerged with cover screws, temporaries. 890 euros per implant, 500 euros per crown. Discount on the implants, confirm with Dr R.A. Implants at sites 22 and 12. Possibly reshape tooth 43. Implants at 750 euros each."
2. Click **Build plan**. Expect these questions:
   - **High:** Implant price conflict: €890 vs €750 dictated, price list €830 (Straumann BLT). Which applies?
   - **High:** 2 or 3 implants? (Sites 12 and 22 were given, which points to 2.)
   - **Medium:** Crown price €500 dictated vs €450 list (zirconia crown on Straumann implant). Which applies?
   - **Medium:** Implant discount %? (Note: confirm with Dr R.A.)
   - **Medium:** Which 4 front teeth will be extracted (FDI numbers)?
   - **Low:** Reshaping of 43 is not in the price list. Add it as TBC or leave it out?
3. Answer, for example: €830 list price, 2 implants, crowns €450, discount 0 % for now, teeth 12, 11, 21, 22, and leave out the reshaping. Then click **Apply answers**. PDF v2 is generated.
4. Non-billable notes (saxophone, 6-month pause, edge-to-edge bite, lab technician Mariana) appear under **Notes** in the PDF, not as priced items.
5. Later, once Dr R.A. confirms: *"Set discount 10% on Straumann implant."* This creates PDF v3. Then approve and download.

---

## Example correction commands

| Say or type | Effect |
|---|---|
| "Change the price of Straumann implant to €1200" | Sets that unit price (marked as dictated) |
| "Remove sedation" | Deletes the sedation lines |
| "Add sterilisation pack to stage 2" | Adds catalog item P… at list price |
| "Set discount 10% on healing abutment" | Discount on matching lines |
| "Move scan of implants to stage 3" | Moves the line between stages |
| "Change crown to zirconia" / "Change implant to Straumann" | Swaps the catalog item and updates the price from the list |
| "Set interval of stage 2 to 3 months" | Updates the stage interval |

Each command creates a new version with a change summary. If a command is not understood, nothing changes and the assistant tells you so.

## Attaching an X-ray

Use **Attach image** to add a radiograph or photo (JPG or PNG). It is embedded in the PDF on an "Images" page. Images stay in your browser.

## Tips

- Say tooth numbers in FDI form ("tooth forty-five" or "four five").
- Say discounts explicitly ("minus 30 percent", "free of charge").
- If a price differs from the list, the assistant always asks before using it.
