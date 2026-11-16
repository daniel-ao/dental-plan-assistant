# Sample Analysis: 5 Dentist Notes vs the Clinic Price List

Sources: `data/dentist_notes_EN.txt` and `data/Dental_Price_List_EUR.xlsx` (208 priced items, IDs as generated in `src/catalog.js`).

This document is the expected-behaviour reference for the extraction, planning and questioning engine, and for its tests.

**Rules applied here (same as the engine):**

- Every price below is copied from the price list or quoted from the dentist's note. Nothing is estimated.
- Where the note does not determine an item or price, the line is **TBC** and a question is raised.
- Amounts are EUR. "Qty × unit" is shown. Totals are given only where every input is known.

## Price-list observations that affect all patients

| Observation | Items | Handling |
|---|---|---|
| Duplicate name, different price | "Temporary crown on implant": P141 €51.37 (Implantology, 6.22) vs P187 €50.97 (Implant prosthetics, 6.22) | Default P141. The clinic should de-duplicate the list |
| Same item in several categories, same price | Local anaesthesia P006/P041/P066/P099 €4.18; single-use hygiene kit P001/P077/P103 €3.19 | Default P006 / P001 |
| Same price, two names | Gingival grafting "around one tooth" P129 and "around an implant" P147, both €65 | Use P147 when the note says "implant" |
| Implant system not implied by "implant" | Osstem P125 €460, Megagen AnyOne P165 €470, Straumann BLT P126 €830, Nobel P172 €830 (also Megagen ST €360, Osstem SOI €520, Megagen/AnyRidge €570, Straumann SLActive €830) | Always ask unless the system is named |
| Crown price depends on implant system | Zirconia crown on Osstem P123 €360 / on Straumann P124 €450; ML zirconia on Megagen €360 / on Nobel €520; ST zirconia €310–340 | Ask crown type once the system is known |
| Sedation is hourly | First hour P204 €179.20 + each additional hour P205 €79.65, so 4 h = 179.20 + 3 × 79.65 = **€418.15** | Hours come from dictation or an answer |
| "Surgery (Dr. R.A.)" category | Contains only two wisdom-tooth extractions (€159.29, €199.12) | Implant/graft surgery by Dr R.A. has no specific price; ask if a surcharge applies |

---

## Patient 1

Stages identified: 1, 2 ("after 3 months"), 3, 4, and a second "Stage 4" (proposed as Stage 5).

| Stage | Dictated item | Catalog match | Qty × unit | Line |
|---|---|---|---|---|
| 1 | SRP, 1 segment | P051 SRP one tooth €6.17 or P052 SRP one jaw €78.05 (no "segment" item) | TBC | TBC |
| 1 | Pre-operative hygiene, with discount | P031 €14.34 | 1 × 14.34, discount TBC | TBC |
| 1 | Sinus lift during implant placement, 2–3 implants | P137 €630 | 1 × 630 | 630.00 |
| 1 | Implants at 45, 35, 37 | system TBC (P125/P165/P126/P172) | 3 × TBC | TBC |
| 1 | Bone grafting around one implant, free (Doluchys) | P130 €260, 100 % discount | 1 × 260 − 100 % | 0.00 |
| 1 | 1 sterilisation pack | P113 €61.73 | 1 × 61.73 | 61.73 |
| 1 | Sedation, 4 h / without | P204 + P205 | 418.15 or 0 | TBC |
| 2 | Healing abutments on 3 implants | P128 €65 | 3 × 65 | 195.00 |
| 2 | Gingival grafting around 3 implants | P147 €65 | 3 × 65 | 195.00 |
| 2 | 3 × local anaesthesia | P006 €4.18 | 3 × 4.18 | 12.54 |
| 2 | 1 single-use hygiene kit | P001 €3.19 | 1 × 3.19 | 3.19 |
| 2 | Scan of 3 implants | P200 €10.35 | 3 × 10.35 | 31.05 |
| 2 | Temporary crowns on 4 implants | P141 €51.37 | 4 (or 3) × 51.37 | 205.48 / 154.11 |
| 2 | Model | P183 €20.51 | 1 × 20.51 | 20.51 |
| 2 | Single-use hygiene kit | P001 €3.19 | 1 × 3.19 | 3.19 |
| 3 | Pre-operative hygiene, with discount | P031 €14.34 | 1 × 14.34, discount TBC | TBC |
| 3 | Implants at 15, 16 | system TBC | 2 × TBC | TBC |
| 3 | 1 sterilisation pack | P113 €61.73 | 1 × 61.73 | 61.73 |
| 4 | Healing abutments on 2 implants | P128 €65 | 2 × 65 | 130.00 |
| 4 | 2 × gingival grafting | P147 €65 | 2 × 65 | 130.00 |
| 4 | 2 × local anaesthesia | P006 €4.18 | 2 × 4.18 | 8.36 |
| 4 | 1 single-use hygiene kit | P001 €3.19 | 1 × 3.19 | 3.19 |
| 4 | Scan of 2 implants | P200 €10.35 | 2 × 10.35 | 20.70 |
| 4 | Temporary crowns on 2 implants | P141 €51.37 | 2 × 51.37 | 102.74 |
| 4 | 1 model | P183 €20.51 | 1 × 20.51 | 20.51 |
| 4 | 1 single-use hygiene kit | P001 €3.19 | 1 × 3.19 | 3.19 |
| 5 (2nd "4") | Scan of 5 implants | P200 €10.35 | 5 × 10.35 | 51.75 |
| 5 | Zirconia crowns on 7 implants | P124 €450 (Straumann) / P123 €360 (Osstem) / ML Megagen €360 / ML Nobel €520 | 7 (or 5) × TBC | TBC |
| 5 | Model | P183 €20.51 | 1 × 20.51 | 20.51 |
| 5 | Single-use hygiene kit | P001 €3.19 | 1 × 3.19 | 3.19 |
| 5 | Sealing of screw-access channels | P120 €14.34 | 7 (or 5) × 14.34 | 100.38 / 71.70 |

**Clarifying questions**

1. **High:** Which implant system for the 5 implants (45, 35, 37, 15, 16)? Osstem €460 / Megagen AnyOne €470 / Straumann BLT €830 / Nobel €830.
2. **High:** Sedation: 4 h (€418.15) or without sedation?
3. **High:** Final stage says zirconia crowns on **7** implants, but only **5** implants are planned (and "scan of 5 implants"). Is it 5 crowns?
4. **High:** Sinus lift "2–3 implants": confirm P137 (€630) applies, and which sites.
5. **Medium:** Stage 2 has temporary crowns on **4** implants, but only 3 implants were placed in stage 1. Is it 3?
6. **Medium:** What discount % applies to pre-operative hygiene (stages 1 and 3)?
7. **Medium:** "Stage 4" appears twice. Renumber the second one as Stage 5?
8. **Medium:** SRP "1 segment": bill per tooth (P051 €6.17 × number of teeth) or per jaw (P052 €78.05)?
9. **Medium:** Crown type for the final stage (depends on the implant system, e.g. zirconia on Straumann €450).
10. **Low:** Intervals before stages 3, 4 and 5 (only stage 2 has "after 3 months").
11. **Low:** Patient name.

---

## Patient 2

Stages identified: 1–4. No intervals were dictated.

| Stage | Dictated item | Catalog match | Qty × unit | Line |
|---|---|---|---|---|
| 1 | Pre-operative hygiene, with discount | P031 €14.34 | 1, discount TBC | TBC |
| 1 | Sinus lift during implant placement, 2–3 implants | P137 €630 | 1 × 630 | 630.00 |
| 1 | Implants at 15, 35, 36, free (Doluchys) | system TBC, 100 % discount | 3 × TBC − 100 % | 0.00 (confirm) |
| 1 | Sedation, 4 h / without | P204 + P205 | 418.15 or 0 | TBC |
| 2 | Healing abutments on 3 implants | P128 €65 | 3 × 65 | 195.00 |
| 2 | Gingival grafting around 3 implants | P147 €65 | 3 × 65 | 195.00 |
| 2 | Placement of 2 implants at 16, 17 | system TBC | 2 × TBC | TBC |
| 2 | 1 sterilisation pack | P113 €61.73 | 1 × 61.73 | 61.73 |
| 2 | Scan of 3 implants | P200 €10.35 | 3 × 10.35 | 31.05 |
| 2 | Temporary crowns on 4 implants + model + kit | P141 €51.37, P183 €20.51, P001 €3.19 | 4 (or 3) × 51.37 + 20.51 + 3.19 | 229.18 / 177.81 |
| 3 | Healing abutments on 2 implants | P128 €65 | 2 × 65 | 130.00 |
| 3 | 2 × gingival grafting | P147 €65 | 2 × 65 | 130.00 |
| 3 | 2 × local anaesthesia + 1 kit | P006 €4.18, P001 €3.19 | 2 × 4.18 + 3.19 | 11.55 |
| 3 | Scan of 2 implants | P200 €10.35 | 2 × 10.35 | 20.70 |
| 3 | Temporary crowns on 2 implants + 1 model + 1 kit | P141, P183, P001 | 2 × 51.37 + 20.51 + 3.19 | 126.44 |
| 4 | Scan of 5 implants | P200 €10.35 | 5 × 10.35 | 51.75 |
| 4 | Zirconia crowns on 6 implants + model + kit | crown TBC by system; P183, P001 | 6 (or 5) × TBC + 20.51 + 3.19 | TBC |
| 4 | Sealing of screw-access channels | P120 €14.34 | 6 (or 5) × 14.34 | 86.04 / 71.70 |

**Clarifying questions**

1. **High:** Implant system for all 5 implants?
2. **High:** "Implants … free of charge under Doluchys": are the 3 implant placements themselves free (100 %), or only an associated item such as bone grafting (as for Patient 1)?
3. **High:** Zirconia crowns on **6** implants, but 5 implants are planned. Is it 5?
4. **High:** Sedation: 4 h or without?
5. **Medium:** Temporary crowns on **4** implants in stage 2, but 3 implants have healed by then. Is it 3?
6. **Medium:** Discount % on pre-operative hygiene?
7. **Medium:** Stage 2 gingival grafting has no local anaesthesia listed (stage 3 does). Add 3 × local anaesthesia?
8. **Medium:** Sinus lift 2–3 implants: confirm P137 €630 and the sites.
9. **Low:** Intervals between stages 1→2→3→4.
10. **Low:** Patient name.

---

## Patient 3 (free-text dictation)

Stages identified: 1, 2. Global modifier: "military serviceman (−30%)".

| Stage | Dictated item | Catalog match | Qty × unit | Line |
|---|---|---|---|---|
| 1 | Pre-operative hygiene | P031 €14.34 | 1 × 14.34 | 14.34 |
| 1 | Sterilisation pack | P113 €61.73 | 1 × 61.73 | 61.73 |
| 1 | Bone grafting in segment 1 "at the price-list price of 630 EUR" | No bone-grafting item at €630. Candidates: P131 during multiple implants €520, P133 pre-implant multiple sites €830, P130 one implant €260, lamina items €400–1,240. P137 sinus lift during 2–3 implants is €630 | 1 × TBC | TBC |
| 1 | Four implants at 16, 15, 35, 36 | system TBC | 4 × TBC | TBC |
| 1 | Sedation | P204 (+ P205 per extra hour) | hours TBC | TBC |
| 2 | Healing abutments at 16, 15, 35, 36, −30 % | P128 €65 | 4 × 65 − 30 % | 182.00 |
| 2 | Gingival grafting around each implant | P147 €65 | 4 × 65 | 260.00 (before global discount) |
| 2 | Temporary crowns on the implants | P141 €51.37 | 4 × 51.37 | 205.48 (before global discount) |

**Clarifying questions**

1. **High:** "Bone grafting at the price-list price of 630 EUR" doesn't match any bone-grafting item. €630 is the price of *Sinus lift during implant placement, 2–3 implants* (P137). Which item is meant, or should €630 be used as a dictated price?
2. **High:** Implant system for the 4 implants?
3. **High:** Does the −30 % military discount apply to the whole plan or only to named items? Is the 30 % on healing abutments the same discount or an additional one (no double discount unless confirmed)?
4. **Medium:** Sedation duration (hours)?
5. **Medium:** Temporary crowns: are 4 needed (one per implant)? Is a model and hygiene kit needed, as in other plans?
6. **Low:** Interval between stage 1 and stage 2.
7. **Low:** Patient name.

---

## Patient 4

No explicit stages. The assistant proposes Stage 1 (extractions + implants + temporaries) and Stage 2 (final zirconia crowns). Interval TBC (the note mentions up to 6 months without saxophone).

| Proposed stage | Dictated item | Catalog match | Qty × unit | Line |
|---|---|---|---|---|
| 1 | Extract the 4 front teeth | P089 conventional extraction €16.53 (or complex extraction €20.51) | 4 × 16.53 | 66.12 (confirm type) |
| 1 | Straumann implants at 12, 22 | P126 Straumann BLT €830. Dictated €890 **and** €750 | 2 (or 3) × TBC | TBC |
| 1 | Submerged, cover screws | No price-list item (normally included) | n/a | note |
| 1 | Temporaries | P141 temporary crown on implant €51.37, or immediate temporary crown on Straumann abutment €150 | TBC | TBC |
| 2 | Zirconia crowns | P124 zirconia crown on Straumann €450 (also ML €450, ST €340). Dictated €500 | 2 (or 3) × TBC | TBC |
| 1 | Discount on implants (confirm with Dr R.A.) | n/a | % TBC | TBC |
| 1 | Possibly reshape lower tooth 43 | No price-list item | TBC | TBC |

Non-billable notes for the PDF: plays saxophone, agrees to pause for up to 6 months, Korean implants rejected (neck-crack risk under load), aim for edge-to-edge bite, lab technician Mariana.

**Clarifying questions**

1. **High:** Implant price conflict: €890 and €750 were both dictated, and the price list says €830 (Straumann BLT). Which price applies?
2. **High:** 2 or 3 implants? Sites 12 and 22 suggest 2.
3. **Medium:** Crown price €500 dictated vs €450 list (zirconia crown on Straumann). Which applies? Should the crown type be ML (€450) or ST (€340)?
4. **Medium:** Discount % on implants, pending Dr R.A.?
5. **Medium:** Which 4 front teeth will be extracted (FDI numbers, e.g. 12, 11, 21, 22)? Simple or complex extraction?
6. **Medium:** Temporaries: temporary crown on implant (€51.37), immediate temporary on Straumann abutment (€150), or a removable temporary? How many?
7. **Low:** Reshaping of 43 is not in the price list. Add a dictated price, or leave it out?
8. **Low:** Interval before the final crowns.
9. **Low:** Patient name.

---

## Patient 5 (approximate estimate)

Stages identified from intervals: Visit 1, bone augmentation (3 days) → after 4–6 months, implants (3 days) → after 3–4 months, temporaries → after ≥ 1 month, switch to zirconia. Surgeon: Dr R.A.

| Stage | Dictated item | Catalog match | Qty × unit | Line |
|---|---|---|---|---|
| 1 | Bone augmentation, segment 4 (no bone) | Dictated €1,200–1,400 per side. Closest list item: P138 lamina for 2–3 teeth €1,240; also P133 pre-implant multiple sites €830 | 1 × TBC | TBC (range) |
| 1 | Prior bone grafting, segment 1: lamina or sinus lift | Lamina P138 €1,240 / P139 €830; sinus lift before placement, 2 sites P135 €830; 3 implants €1,030 | 1 × TBC | TBC |
| 2 | Implants, 2 per side (4 total) | Dictated €470 (= P165 Megagen AnyOne €470) **and** €890 (no list item at €890; Straumann/Nobel €830) | 4 × TBC | TBC |
| 3 | Temporaries | P141 €51.37 or temporary prosthesis on abutments €230 | TBC | TBC |
| 4 | Switch to zirconia | crown type TBC by system | TBC | TBC |
| n/a | "2 implants per side, but 3 teeth" | Bridge on 2 implants: no bridge item in price list | TBC | TBC |
| n/a | Restorative (therapeutic) treatment | Not specified (teeth, surfaces) | TBC | TBC |
| n/a | Patient accommodation (rooms) | **Not in price list** | TBC | TBC (excluded) |

Notes for the PDF: currently wears removable dentures and can't wear one during healing; no inflammation; existing teeth are in normal condition and **should not** be extracted (the patient's request to extract is not supported clinically); rest for a couple of days; possible referral for an examination in Poland.

**Clarifying questions**

1. **High:** Bone grafting €1,200–1,400 per side is a range. Use a fixed price, the list item P138 (€1,240), or show the range as an approximate estimate?
2. **High:** Implant price: €470 (Megagen AnyOne) and €890 were both dictated. €890 isn't in the price list (Straumann/Nobel are €830). Which system and price for each side?
3. **High:** Segment 1: lamina technique or sinus lift? These items have different prices.
4. **High:** "2 implants per side, but 3 teeth": a 3-unit bridge on 2 implants? There is no bridge item in the list, so please give a price.
5. **Medium:** Temporaries: what type, and how many?
6. **Medium:** Restorative treatment: which teeth and procedures?
7. **Medium:** Accommodation is not in the price list. Include it with a dictated amount, or leave it out of the estimate?
8. **Medium:** Does surgery by Dr R.A. carry a different price? (That price-list category only has wisdom-tooth extractions.)
9. **Low:** Intervals are ranges (4–6 months, 3–4 months). Show them as ranges?
10. **Low:** Patient name.

---

## Coverage summary

"Matched" means the line has a determinable price, possibly with an alternative depending on a count question.

| Patient | Stages | Matched lines | TBC lines | High-priority questions |
|---|---|---|---|---|
| 1 | 5 (duplicate "Stage 4") | 24 | 7 | 4 |
| 2 | 4 | 14 | 4 | 4 |
| 3 | 2 | 5 | 3 | 3 |
| 4 | 2 (proposed) | 1 | 5 | 2 |
| 5 | 4 (from intervals) | 0 | 8 | 4 |
