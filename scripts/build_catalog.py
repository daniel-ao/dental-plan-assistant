"""Regenerate src/catalog.js from the clinic's price list (data/Dental_Price_List_EUR.xlsx).
Usage: python scripts/build_catalog.py  (requires openpyxl)"""
import json, openpyxl
wb = openpyxl.load_workbook('data/Dental_Price_List_EUR.xlsx')
ws = wb.active
items, cat, i = [], None, 0
for name, code, price in list(ws.iter_rows(values_only=True))[1:]:
    if price is None:
        cat = name
        continue
    i += 1
    items.append({"id": f"P{i:03d}", "category": cat, "name": name,
                  "code": str(code) if code is not None else None, "price": round(float(price), 2)})
with open('src/catalog.js', 'w') as f:
    f.write("// AUTO-GENERATED from data/Dental_Price_List_EUR.xlsx by scripts/build_catalog.py. Do not edit by hand.\n")
    f.write("export const CATALOG = " + json.dumps(items, indent=1, ensure_ascii=False) + ";\n")
print(len(items), "items")
