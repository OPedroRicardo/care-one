"""
Extrator de Entidades de Laudos PDF — CarePlus
===============================================
Varre scripts/laudos/**/*.pdf, extrai entidades e salva em Parquet
para uso em pipelines de sinistralidade.

Entidades extraídas
-------------------
Metadados     : patient_id, protocol, lab_short, exam_date_filename
Paciente      : patient_name, patient_sex, patient_age, birth_date,
                cpf, city, state, cep, cid_code, cid_desc
Requisição    : doctor_name, doctor_crm, doctor_specialty,
                collect_date, collect_time
Exames        : glucose, insulin, total_chol, ldl, hdl, triglycerides,
                homa_ir, sys_bp, dia_bp  (+ _unit e _flag por exame)
Outros        : framingham

Uso
---
    pip install pdfplumber pandas pyarrow tqdm
    python scripts/extrair_laudos_parquet.py
    python scripts/extrair_laudos_parquet.py --input scripts/laudos --output data/laudos.parquet
    python scripts/extrair_laudos_parquet.py --workers 4
"""

import argparse
import re
import sys
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import date
from pathlib import Path

try:
    import pdfplumber
except ImportError:
    print("pdfplumber não encontrado. Instale com: pip install pdfplumber")
    sys.exit(1)

try:
    import pandas as pd
except ImportError:
    print("pandas não encontrado. Instale com: pip install pandas pyarrow")
    sys.exit(1)

try:
    from tqdm import tqdm
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False


# ─────────────────────────────────────────────────────────────────────────────
# ALIASES DOS EXAMES (espelham EXAM_NAMES em gerar_laudos_pdf.py)
# ─────────────────────────────────────────────────────────────────────────────

EXAM_ALIASES: dict[str, list[str]] = {
    'glucose':       ['Glicemia de Jejum', 'Glicose (jejum)', 'Glicose de Jejum',
                      'Gli - Jejum 12h', 'Glicemia Plasmática em Jejum'],
    'insulin':       ['Insulina Basal', 'Insulina de Jejum', 'Insulina (basal)',
                      'Insulina Plasmática', 'Ins - Jejum'],
    'total_chol':    ['Colesterol Total', 'Colesterol - Total', 'Colest. Total',
                      'CT - Colesterol Total', 'Lipídios - Colesterol Total'],
    'ldl':           ['LDL Colesterol', 'LDL-Colesterol (Friedewald)', 'LDL-C',
                      'Colesterol LDL', 'LDL Col. (calculado)'],
    'hdl':           ['HDL Colesterol', 'HDL-Colesterol', 'HDL-C',
                      'Colesterol HDL', 'HDL Col.'],
    'triglycerides': ['Triglicerídeos', 'Triglicérides', 'TG - Triglicerídeos',
                      'Triglicérides (Enzimático)', 'Lipídios - Triglicerídeos'],
    'homa_ir':       ['HOMA-IR', 'HOMA IR (Insulino-resistência)', 'Índice HOMA-IR',
                      'Resistência Insulínica - HOMA', 'HOMA-IR (calculado)'],
    'sys_bp':        ['Pressão Arterial Sistólica', 'PAS', 'Pressão Sistólica (mmHg)',
                      'PA Sistólica', 'Pressão Arterial — Sistólica'],
    'dia_bp':        ['Pressão Arterial Diastólica', 'PAD', 'Pressão Diastólica (mmHg)',
                      'PA Diastólica', 'Pressão Arterial — Diastólica'],
}

# Inverte alias → chave canônica (lowercase para matching case-insensitive)
ALIAS_TO_KEY: dict[str, str] = {
    alias.lower(): key
    for key, aliases in EXAM_ALIASES.items()
    for alias in aliases
}

# Regex de fallback: qualquer alias + número + unidade no texto corrido
_alias_re_str = '|'.join(
    re.escape(a) for a in sorted(ALIAS_TO_KEY, key=len, reverse=True)
)
EXAM_FALLBACK_RE = re.compile(
    rf'({_alias_re_str})\s+([\d,\.]+)\s*([^\s↑↓N][^\s]*)?',
    re.IGNORECASE | re.UNICODE,
)

# ─────────────────────────────────────────────────────────────────────────────
# PARSERS DE DATA (5 formatos gerados propositalmente)
# ─────────────────────────────────────────────────────────────────────────────

_MESES_PT = {
    'janeiro': 1, 'fevereiro': 2, 'março': 3, 'abril': 4,
    'maio': 5, 'junho': 6, 'julho': 7, 'agosto': 8,
    'setembro': 9, 'outubro': 10, 'novembro': 11, 'dezembro': 12,
}

_DATE_RE = [
    # DD/MM/YYYY ou DD/MM/YY
    (re.compile(r'^(\d{1,2})/(\d{1,2})/(\d{2,4})$'), 'dmy_slash'),
    # DD-MM-YYYY
    (re.compile(r'^(\d{1,2})-(\d{1,2})-(\d{4})$'), 'dmy_dash'),
    # DD de março de 1965
    (re.compile(r'^(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})$', re.I), 'dmy_ext'),
    # YYYY-MM-DD
    (re.compile(r'^(\d{4})-(\d{2})-(\d{2})$'), 'iso'),
]


def _parse_date(s: str) -> str | None:
    s = s.strip()
    for pat, fmt in _DATE_RE:
        m = pat.match(s)
        if not m:
            continue
        try:
            if fmt == 'dmy_slash':
                d, mo, y = int(m[1]), int(m[2]), int(m[3])
                y = y + 1900 if (y < 100 and y > 25) else y + 2000 if y < 100 else y
            elif fmt == 'dmy_dash':
                d, mo, y = int(m[1]), int(m[2]), int(m[3])
            elif fmt == 'dmy_ext':
                d, y = int(m[1]), int(m[3])
                mo = _MESES_PT.get(m[2].lower())
                if not mo:
                    continue
            else:  # iso
                y, mo, d = int(m[1]), int(m[2]), int(m[3])
            return date(y, mo, d).isoformat()
        except (ValueError, TypeError):
            continue
    return None


# ─────────────────────────────────────────────────────────────────────────────
# POSIÇÕES DE COLUNA DA TABELA DE EXAMES (em pontos PDF)
#
# Derivadas de gerar_laudos_pdf.py:
#   MARGIN_X = 40,  cols = [0, 185, 270, 320, 420]
#   Offsets de texto: +5 (exame), +3 (demais)
# ─────────────────────────────────────────────────────────────────────────────

_X_EXAM   = (40,  228)   # nome do exame
_X_VALUE  = (228, 313)   # resultado numérico
_X_UNIT   = (313, 363)   # unidade
_X_INTERP = (463, 560)   # interpretação (Normal / ↑ Alto / ↓ Baixo)

_Y_BUCKET = 14  # quantização de linha (row_h=24pt → 14pt é seguro)


def _words_in_x(words: list, x0: float, x1: float,
                y0: float | None = None, y1: float | None = None) -> list:
    return [
        w for w in words
        if x0 <= w['x0'] < x1
        and (y0 is None or y0 <= w['top'] <= y1)
    ]


def _text(words: list) -> str:
    return ' '.join(w['text'] for w in sorted(words, key=lambda w: w['x0']))


# ─────────────────────────────────────────────────────────────────────────────
# EXTRAÇÃO PRINCIPAL
# ─────────────────────────────────────────────────────────────────────────────

def extract_pdf(pdf_path: Path) -> dict:
    rec: dict = {
        'source_file': str(pdf_path),
        'patient_id': None, 'protocol': None,
        'lab_short': None,  'exam_date_filename': None,
        # paciente
        'patient_name': None, 'patient_sex': None, 'patient_age': None,
        'birth_date': None,   'cpf': None,
        'city': None,         'state': None,        'cep': None,
        'cid_code': None,     'cid_desc': None,
        # requisição
        'doctor_name': None,    'doctor_crm': None,
        'doctor_specialty': None,
        'collect_date': None,   'collect_time': None,
        # exames
        **{f'{k}{s}': None
           for k in EXAM_ALIASES
           for s in ('', '_unit', '_flag')},
        'framingham': None,
        'errors': [],
    }

    # ── Metadados do nome de arquivo ─────────────────────────────────────────
    stem   = pdf_path.stem       # e.g. FLE20250720000042
    parent = pdf_path.parent.name  # e.g. P00000042
    rec['patient_id'] = parent
    rec['protocol']   = stem

    fn_m = re.match(r'^([A-Z]{3})(\d{8})\d+$', stem)
    if fn_m:
        rec['lab_short'] = fn_m.group(1)
        d = fn_m.group(2)
        try:
            rec['exam_date_filename'] = date(int(d[:4]), int(d[4:6]), int(d[6:])).isoformat()
        except ValueError:
            pass

    # ── Extração de texto ─────────────────────────────────────────────────────
    try:
        with pdfplumber.open(pdf_path) as pdf:
            page  = pdf.pages[0]
            text  = page.extract_text(x_tolerance=3, y_tolerance=3) or ''
            words = page.extract_words(x_tolerance=3, y_tolerance=3)
    except Exception as exc:
        rec['errors'].append(f'pdf_open:{exc}')
        rec['errors'] = '; '.join(rec['errors'])
        return rec

    lines = text.splitlines()

    # ── Campos textuais por regex nas linhas ─────────────────────────────────
    for line in lines:
        # Paciente / Sexo
        m = re.search(r'Paciente:\s*(.+?)\s+Sexo:', line)
        if m and not rec['patient_name']:
            rec['patient_name'] = m.group(1).strip()

        m = re.search(r'Sexo:\s*(Masculino|Feminino)', line)
        if m and not rec['patient_sex']:
            rec['patient_sex'] = 'M' if 'Masculino' in m.group(1) else 'F'

        # Data de Nasc. / Idade
        m = re.search(r'Data de Nasc\.?:?\s*(.+?)\s+Idade:', line)
        if m and not rec['birth_date']:
            rec['birth_date'] = _parse_date(m.group(1).strip())

        m = re.search(r'Idade:\s*(\d+)\s*anos', line)
        if m and not rec['patient_age']:
            rec['patient_age'] = int(m.group(1))

        # CPF / CID-10
        m = re.search(r'CPF:\s*(\d{3}\.\d{3}\.\d{3}-\d{2})', line)
        if m and not rec['cpf']:
            rec['cpf'] = m.group(1)

        m = re.search(r'CID-10:\s*([A-Z]\d+\.?\d*)\s*[—\-–]\s*(.+?)(?:\s{2,}|$)', line)
        if m and not rec['cid_code']:
            rec['cid_code'] = m.group(1).strip()
            rec['cid_desc'] = m.group(2).strip()

        # Município / Estado / CEP
        m = re.search(r'Município:\s*(.+?)/([A-Z]{2})\s*[—\-–]\s*CEP\s*([\d\-]+)', line)
        if m and not rec['city']:
            rec['city']  = m.group(1).strip()
            rec['state'] = m.group(2).strip()
            rec['cep']   = m.group(3).strip()

        # Médico / CRM / Especialidade / Coleta
        m = re.search(r'Médico Solicitante:\s*(.+?)\s+CRM:', line)
        if m and not rec['doctor_name']:
            rec['doctor_name'] = m.group(1).strip()

        m = re.search(r'CRM:\s*(CRM/[A-Z]{2}\s+\d+)', line)
        if m and not rec['doctor_crm']:
            rec['doctor_crm'] = m.group(1).strip()

        m = re.search(r'Especialidade:\s*(.+?)\s+Data de Coleta:', line)
        if m and not rec['doctor_specialty']:
            rec['doctor_specialty'] = m.group(1).strip()

        m = re.search(r'Data de Coleta:\s*(.+?)\s+às\s+([\d:]+)h', line)
        if m and not rec['collect_date']:
            rec['collect_date'] = _parse_date(m.group(1).strip())
            rec['collect_time'] = m.group(2).strip()

        # Framingham
        m = re.search(r'Escore de Framingham\):\s*(\d+)%', line)
        if m and not rec['framingham']:
            rec['framingham'] = int(m.group(1))

    # ── Tabela de exames via coordenadas de palavra ───────────────────────────
    # Agrupa as palavras na coluna de exame por linha (bucket de y)
    exam_col_words = _words_in_x(words, *_X_EXAM)

    rows: dict[int, list] = {}
    for w in exam_col_words:
        bucket = round(w['top'] / _Y_BUCKET) * _Y_BUCKET
        rows.setdefault(bucket, []).append(w)

    for bucket, row_words in rows.items():
        exam_text = _text(row_words).strip()
        exam_key  = ALIAS_TO_KEY.get(exam_text.lower())

        # Fallback: substring match (cobre aliases truncados pelo layout)
        if not exam_key:
            el = exam_text.lower()
            for alias, key in ALIAS_TO_KEY.items():
                if alias.startswith(el) or el.startswith(alias):
                    exam_key = key
                    break

        if not exam_key or rec.get(exam_key) is not None:
            continue

        # Usa a posição média real das palavras (não o bucket) e janela estreita
        # para evitar capturar valores de linhas adjacentes (row_h=24pt).
        avg_top = sum(w['top'] for w in row_words) / len(row_words)
        y0, y1 = avg_top - 6, avg_top + 14

        # Valor numérico
        val_words = _words_in_x(words, *_X_VALUE, y0=y0, y1=y1)
        val_text  = _text(val_words).strip()
        try:
            val = float(val_text.replace(',', '.'))
        except ValueError:
            rec['errors'].append(f'{exam_key}:valor="{val_text}"')
            continue

        # Unidade
        unit_words = _words_in_x(words, *_X_UNIT, y0=y0, y1=y1)
        unit_text  = _text(unit_words).strip() or None

        # Interpretação
        interp_words = _words_in_x(words, *_X_INTERP, y0=y0, y1=y1)
        interp_text  = _text(interp_words)
        if '↑' in interp_text or 'Alto' in interp_text:
            flag = 'alto'
        elif '↓' in interp_text or 'Baixo' in interp_text:
            flag = 'baixo'
        elif 'Normal' in interp_text:
            flag = 'normal'
        else:
            flag = None

        rec[exam_key]              = val
        rec[f'{exam_key}_unit']    = unit_text
        rec[f'{exam_key}_flag']    = flag

    # ── Fallback regex para exames ainda ausentes ─────────────────────────────
    missing = [k for k in EXAM_ALIASES if rec.get(k) is None]
    if missing:
        for m in EXAM_FALLBACK_RE.finditer(text):
            alias = m.group(1).strip().lower()
            key   = ALIAS_TO_KEY.get(alias)
            if key and rec.get(key) is None:
                try:
                    rec[key] = float(m.group(2).replace(',', '.'))
                    if m.group(3):
                        rec[f'{key}_unit'] = m.group(3)
                except ValueError:
                    pass

    rec['errors'] = '; '.join(rec['errors']) if rec['errors'] else None
    return rec


# ─────────────────────────────────────────────────────────────────────────────
# MULTIPROCESSING WORKER (módulo-nível para pickle)
# ─────────────────────────────────────────────────────────────────────────────

def _worker(path_str: str) -> dict:
    try:
        return extract_pdf(Path(path_str))
    except Exception as exc:
        return {'source_file': path_str, 'errors': str(exc)}


# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description='Extrator de Laudos PDF → Parquet')
    ap.add_argument('--input',   default='scripts/laudos',
                    help='Diretório raiz dos PDFs (default: scripts/laudos)')
    ap.add_argument('--output',  default='data/laudos.parquet',
                    help='Parquet de saída (default: data/laudos.parquet)')
    ap.add_argument('--workers', type=int, default=4,
                    help='Processos paralelos (default: 4)')
    ap.add_argument('--glob',    default='**/*.pdf',
                    help='Padrão glob (default: **/*.pdf)')
    args = ap.parse_args()

    input_dir = Path(args.input)
    if not input_dir.exists():
        print(f'Erro: diretório {input_dir} não encontrado.')
        sys.exit(1)

    pdfs = sorted(input_dir.glob(args.glob))
    if not pdfs:
        print(f'Nenhum PDF encontrado em {input_dir}')
        sys.exit(1)

    print(f'\nCarePlus — Extrator de Laudos PDF')
    print(f'  PDFs encontrados : {len(pdfs):,}')
    print(f'  Workers          : {args.workers}')
    print(f'  Saída            : {args.output}\n')

    pdf_strs = [str(p) for p in pdfs]
    records: list[dict] = []

    if args.workers > 1:
        with ProcessPoolExecutor(max_workers=args.workers) as ex:
            futs = {ex.submit(_worker, p): p for p in pdf_strs}
            it = as_completed(futs)
            if HAS_TQDM:
                it = tqdm(it, total=len(pdfs), desc='Extraindo', unit='pdf')
            for fut in it:
                records.append(fut.result())
    else:
        it = tqdm(pdf_strs, desc='Extraindo', unit='pdf') if HAS_TQDM else pdf_strs
        for p in it:
            records.append(_worker(p))

    df = pd.DataFrame(records)

    # Coerção de tipos
    numeric_cols = [
        'patient_age', 'framingham',
        'glucose', 'insulin', 'total_chol', 'ldl', 'hdl',
        'triglycerides', 'homa_ir', 'sys_bp', 'dia_bp',
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')

    date_cols = ['birth_date', 'exam_date_filename', 'collect_date']
    for col in date_cols:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors='coerce')

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(out, index=False, engine='pyarrow')

    # Relatório
    n_err = df['errors'].notna().sum() if 'errors' in df.columns else 0
    print(f'\n  {len(df):,} laudos processados  |  {n_err:,} com erros')
    print(f'\n  Cobertura por exame:')
    for key in EXAM_ALIASES:
        if key in df.columns:
            n   = int(df[key].notna().sum())
            pct = n / len(df) * 100
            print(f'    {key:<15} {n:>6,}  ({pct:5.1f}%)')
    print(f'\n  Parquet salvo em: {out.resolve()}\n')


if __name__ == '__main__':
    main()
