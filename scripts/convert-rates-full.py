import pdfplumber
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

pdf = pdfplumber.open(r'C:\Users\User\Downloads\[품고] 26년도 글로벌 익스프레스 운임표_추가규격ver.pdf')

all_zones = {}

for page_idx in [0, 2]:
    page = pdf.pages[page_idx]
    tables = page.extract_tables()
    for table in tables:
        # Find the row with country codes (A, D, E, ... or O, P, Q, ...)
        codes_row_idx = None
        for ri, row in enumerate(table):
            first_cell = (row[0] or '').strip()
            if first_cell == '국가코드':
                codes_row_idx = ri
                break

        if codes_row_idx is None:
            continue

        codes_row = table[codes_row_idx]
        countries_row = table[codes_row_idx + 2]  # skip FICP row
        zones = [c.strip() for c in codes_row[1:] if c]
        cnames = [(c or '').replace('\n', ' ').strip() for c in countries_row[1:]]

        # Data rows start after countries row
        data_start = codes_row_idx + 3
        for row in table[data_start:]:
            weight_raw = (row[0] or '').strip()
            if not weight_raw.startswith('≤'):
                continue

            weight_str = weight_raw.replace('≤', '').replace('kg', '').strip()
            try:
                weight_val = float(weight_str)
            except:
                continue

            for i, zone in enumerate(zones):
                if zone not in all_zones:
                    all_zones[zone] = {
                        'country': cnames[i] if i < len(cnames) else '',
                        'rates': {}
                    }
                val = (row[i + 1] or '').strip().replace(',', '')
                try:
                    krw = float(val)
                    usd = round(krw * 1.45 / 1450, 2)
                    all_zones[zone]['rates'][weight_val] = {'krw': int(krw), 'usd': usd}
                except:
                    pass

output = {}
for zone in sorted(all_zones.keys()):
    info = all_zones[zone]
    sorted_rates = sorted(info['rates'].items())
    output[zone] = {
        'country': info['country'],
        'rates': [{'weight': w, 'krw': r['krw'], 'usd': r['usd']} for w, r in sorted_rates]
    }
    print("Zone " + zone + " (" + info['country'][:40] + "): " + str(len(sorted_rates)) + " weight tiers")

with open(r'C:\Users\User\smart-paw-finder-global\data\b2b-shipping-rates.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print("\nSaved to data/b2b-shipping-rates.json")
