#!/usr/bin/env python3
"""
compute_dashboard.py — Computes OperadoraDashboard Patient[] from Parquet.
Reads real exam values from laudos_sample.parquet, generates plausible
6-month trend history seeded by patient_id for determinism.
Output: JSON array to stdout.
"""
import sys
import json
import math
import argparse
import random
from pathlib import Path
from datetime import date

# Node reads this script's stdout as UTF-8 (AnalysisService.ts). On Windows the
# default stream encoding follows the console codepage (e.g. cp1252), which
# silently mangles accented names (e.g. "João" -> "Jo\xe3o" -> "Jo�o" once
# decoded as UTF-8). Force UTF-8 so the JSON bytes match what Node expects.
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

try:
    import pandas as pd
except ImportError:
    json.dump({"error": "pip install pandas pyarrow"}, sys.stdout)
    sys.exit(1)


# ── math utils ───────────────────────────────────────────────────────────────

def clamp(v, lo, hi):
    return max(lo, min(hi, v))

def sigmoid(x):
    return 1 / (1 + math.exp(-x))

def lin_reg(vals):
    n = len(vals)
    if n < 2:
        return 0.0
    mx = (n - 1) / 2
    my = sum(vals) / n
    num = sum((i - mx) * (v - my) for i, v in enumerate(vals))
    den = sum((i - mx) ** 2 for i in range(n))
    return round(num / den, 2) if den else 0.0


# ── clinical formulas (mirrors data.ts) ──────────────────────────────────────

def calc_homa_ir(glucose, insulin):
    if not glucose or not insulin:
        return 2.5
    return round((glucose * insulin) / 405, 2)


def calc_framingham(age, sex, tc, hdl, sbp, smoker, diabetic):
    pts = 0
    if sex == 'M':
        if age < 35:   pts += -1
        elif age < 40: pts += 0
        elif age < 45: pts += 1
        elif age < 50: pts += 2
        elif age < 55: pts += 3
        elif age < 60: pts += 4
        elif age < 65: pts += 5
        elif age < 70: pts += 6
        else:          pts += 7
        if tc < 160:   pts += -3
        elif tc < 200: pts += 0
        elif tc < 240: pts += 1
        elif tc < 280: pts += 2
        else:          pts += 3
        if hdl < 35:   pts += 2
        elif hdl < 45: pts += 1
        elif hdl < 50: pts += 0
        elif hdl < 60: pts += -1
        else:          pts += -2
        if sbp < 120:  pts += -3
        elif sbp < 130:pts += 0
        elif sbp < 140:pts += 1
        elif sbp < 160:pts += 2
        else:          pts += 3
        if smoker:   pts += 2
        if diabetic: pts += 2
        risk_map = [1,2,2,3,4,4,6,7,9,11,14,18,22,27,33,40,47,56]
        return risk_map[clamp(pts + 3, 0, 17)]
    else:
        if age < 35:   pts += -9
        elif age < 40: pts += -4
        elif age < 45: pts += 0
        elif age < 50: pts += 3
        elif age < 55: pts += 6
        elif age < 60: pts += 7
        else:          pts += 8
        if tc < 160:   pts += -2
        elif tc < 200: pts += 0
        elif tc < 240: pts += 1
        elif tc < 280: pts += 2
        else:          pts += 3
        if hdl < 35:   pts += 5
        elif hdl < 45: pts += 2
        elif hdl < 50: pts += 1
        elif hdl < 60: pts += 0
        else:          pts += -2
        if sbp < 120:  pts += -3
        elif sbp < 130:pts += 0
        elif sbp < 140:pts += 1
        elif sbp < 160:pts += 2
        else:          pts += 3
        if smoker:   pts += 2
        if diabetic: pts += 4
        risk_map = [1,2,2,3,3,4,5,6,7,8,9,11,13,15,17,20,24,27,32]
        return risk_map[clamp(pts + 2, 0, 18)]


def calc_composite(fram, homa, sbp, altered, conf):
    f_n = clamp(fram / 45, 0, 1)
    h_n = clamp(homa / 5.5, 0, 1)
    b_n = clamp((sbp - 110) / 70, 0, 1)
    m_n = altered / 7
    raw = 0.35 * f_n + 0.25 * h_n + 0.20 * b_n + 0.20 * m_n
    return round(sigmoid(8 * (raw - 0.42)) * 100 * conf, 1)


def is_altered(key, val, sex):
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return False
    if key == 'glucose':      return val > 99
    if key == 'insulin':      return val > 25
    if key == 'totalChol':    return val >= 200
    if key == 'ldl':          return val >= 130
    if key == 'hdl':          return val < (50 if sex == 'F' else 40)
    if key == 'triglycerides':return val >= 150
    if key == 'sysBP':        return val >= 130
    return False


def generate_trend(end_val, slope_per_month, n=6, noise_pct=0.04):
    """Generate n values where the last equals end_val with given monthly slope."""
    vals = []
    for i in range(n):
        months_before = n - 1 - i
        base = end_val - slope_per_month * months_before
        noise = random.gauss(0, abs(end_val) * noise_pct)
        vals.append(base + noise)
    return vals


def safe_float(v, default=0.0):
    try:
        f = float(v)
        return default if math.isnan(f) else f
    except (TypeError, ValueError):
        return default


def safe_int(v, default=0):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return default


# ── main ─────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default=str(
        Path(__file__).parent.parent / 'analysis' / 'data' / 'laudos_sample.parquet'))
    ap.add_argument('--limit', type=int, default=0,
                    help='Limit number of patients (0 = all)')
    ap.add_argument('--patient', default=None,
                    help='Filter by patient_id')
    args = ap.parse_args()

    df_path = Path(args.data)
    if not df_path.exists():
        alt = df_path.parent / 'laudos.parquet'
        if alt.exists():
            df_path = alt
        else:
            print(json.dumps({"error": f"Parquet not found: {args.data}"}),
                  file=sys.stderr)
            sys.exit(1)

    df = pd.read_parquet(df_path)

    if args.patient:
        df = df[df['patient_id'] == args.patient]

    if args.limit > 0:
        df = df.head(args.limit)

    today = date.today()
    patients = []

    for _, row in df.iterrows():
        pid = str(row.get('patient_id') or '')
        random.seed(abs(hash(pid)) & 0x7FFFFFFF)

        name  = str(row.get('patient_name') or 'Paciente Desconhecido')
        sex   = 'F' if str(row.get('patient_sex') or 'M').upper().startswith('F') else 'M'
        age   = safe_int(row.get('patient_age'), 40)

        # Real exam values
        glucose       = safe_float(row.get('glucose'), 90)
        insulin       = safe_float(row.get('insulin'), 10)
        total_chol    = safe_float(row.get('total_chol'), 180)
        ldl           = safe_float(row.get('ldl'), 110)
        hdl           = safe_float(row.get('hdl'), 50)
        triglycerides = safe_float(row.get('triglycerides'), 120)
        sys_bp        = safe_float(row.get('sys_bp'), 120)
        dia_bp        = safe_float(row.get('dia_bp'), 80)

        # Determine slopes from current values vs reference
        g_slope  = 1.8 if glucose > 126  else 0.5 if glucose > 100  else -0.3
        c_slope  = 1.0 if total_chol > 240 else 0.3 if total_chol > 200 else -0.1
        bp_slope = 0.4 if sys_bp > 140  else 0.1 if sys_bp > 130   else -0.1

        # Generate 6-month history (index 0=oldest, 5=latest/real)
        g_hist  = generate_trend(glucose,       g_slope,       6, 0.045)
        i_hist  = generate_trend(insulin,       g_slope * 0.3, 6, 0.07)
        tc_hist = generate_trend(total_chol,    c_slope,       6, 0.03)
        ld_hist = generate_trend(ldl,           c_slope * 0.7, 6, 0.04)
        hd_hist = generate_trend(hdl,          -c_slope * 0.1, 6, 0.03)
        tg_hist = generate_trend(triglycerides, g_slope * 0.5, 6, 0.06)
        sb_hist = generate_trend(sys_bp,        bp_slope,      6, 0.025)
        db_hist = generate_trend(dia_bp,        bp_slope * 0.7,6, 0.025)

        # Anchor last value to real data
        g_hist[-1]  = glucose
        i_hist[-1]  = insulin
        tc_hist[-1] = total_chol
        ld_hist[-1] = ldl
        hd_hist[-1] = hdl
        tg_hist[-1] = triglycerides
        sb_hist[-1] = sys_bp
        db_hist[-1] = dia_bp

        # Determine base date
        collect = row.get('collect_date')
        try:
            end_date = pd.Timestamp(collect).date() if pd.notna(collect) else today
        except Exception:
            end_date = today

        # Build LabPoint array
        exams = []
        for idx in range(6):
            months_before = 5 - idx
            month = end_date.month - months_before
            year  = end_date.year + (month - 1) // 12
            month = ((month - 1) % 12) + 1
            exams.append({
                'date':         f'{year:04d}-{month:02d}',
                'glucose':      round(clamp(g_hist[idx],  60, 310)),
                'insulin':      round(clamp(i_hist[idx],   1, 60), 1),
                'totalChol':    round(clamp(tc_hist[idx], 100, 360)),
                'ldl':          round(clamp(ld_hist[idx],  40, 260)),
                'hdl':          round(clamp(hd_hist[idx],  15, 105)),
                'triglycerides':round(clamp(tg_hist[idx],  40, 510)),
                'sysBP':        round(clamp(sb_hist[idx],  88, 225)),
                'diaBP':        round(clamp(db_hist[idx],  55, 135)),
            })

        lat = exams[-1]

        # HOMA-IR (real or computed)
        homa_raw = row.get('homa_ir')
        homa_ir  = (round(safe_float(homa_raw), 2)
                    if homa_raw and safe_float(homa_raw) > 0
                    else calc_homa_ir(lat['glucose'], lat['insulin']))

        # Framingham (real from PDF)
        fram_raw = row.get('framingham')
        try:
            framingham = int(float(fram_raw)) if fram_raw and float(fram_raw) > 0 else None
        except Exception:
            framingham = None
        if not framingham:
            cid = str(row.get('cid_code') or '').upper()
            diabetic_for_fram = ('E10' in cid or 'E11' in cid) or glucose > 126
            framingham = calc_framingham(age, sex, total_chol, hdl, sys_bp,
                                         False, diabetic_for_fram)

        # Clinical flags
        cid      = str(row.get('cid_code') or '').upper()
        diabetic = ('E10' in cid or 'E11' in cid) or glucose > 126
        has_htn  = 'I10' in cid or sys_bp >= 140
        medicated = diabetic or has_htn

        # Altered markers
        markers  = ['glucose','insulin','totalChol','ldl','hdl','triglycerides','sysBP']
        altered  = [is_altered(k, lat.get(k), sex) for k in markers]
        alt_cnt  = sum(altered)

        confidence    = clamp(0.55 + 0.07 * 6 + 0.04 * alt_cnt, 0.60, 0.97)
        composite     = calc_composite(framingham, homa_ir, lat['sysBP'], alt_cnt, confidence)
        risk_level    = 'alto' if composite >= 55 else 'medio' if composite >= 28 else 'baixo'
        trend_glucose = lin_reg([e['glucose']   for e in exams])
        trend_chol    = lin_reg([e['totalChol'] for e in exams])

        # Projected cost with deterministic variance
        base_cost = 68000 if risk_level == 'alto' else 28000 if risk_level == 'medio' else 7500
        variance  = (abs(hash(pid)) % 100 - 50) / 50 * 0.22
        proj_cost = round(clamp(base_cost * (1 + variance), 3000, 150000))

        # Days since last exam
        dias_ultimo = (today - end_date).days

        # consultas12m: random but risk-biased
        consultas_base = 7 if risk_level == 'alto' else 4 if risk_level == 'medio' else 2
        consultas12m   = min(15, max(0, consultas_base + random.randint(-2, 3)))

        pid_num = abs(hash(pid)) % 90000 + 1

        patients.append({
            'id':            pid_num,
            'name':          name,
            'age':           age,
            'sex':           sex,
            'smoker':        False,
            'diabetic':      diabetic,
            'medicated':     medicated,
            'prevInternacao':False,
            'consultas12m':  consultas12m,
            'diasUltimoExame': max(1, dias_ultimo),
            'exams':         exams,
            'homaIR':        homa_ir,
            'framingham':    framingham,
            'compositeScore':composite,
            'confidence':    round(confidence, 3),
            'riskLevel':     risk_level,
            'alteredCount':  alt_cnt,
            'alteredMarkers':altered,
            'trendGlucose':  trend_glucose,
            'trendChol':     trend_chol,
            'projectedCost': proj_cost,
        })

    patients.sort(key=lambda p: p['compositeScore'], reverse=True)
    print(json.dumps(patients, ensure_ascii=False))


if __name__ == '__main__':
    main()
