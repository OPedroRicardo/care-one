"""
Gerador de Laudos Laboratoriais em PDF — CarePlus
==================================================
Gera laudos com layout realista de laboratório brasileiro (A4),
propositalmente variados para desafiar pipelines de extração de entidades.

Cada PDF simula um laudo entregue ao paciente/operadora:
  - Cabeçalho com identidade visual do laboratório
  - Dados do paciente e médico solicitante
  - Tabela de resultados com valores de referência
  - Parágrafo de interpretação clínica em linguagem natural
  - Rodapé com responsável técnico, CRM e número de protocolo

Estratégias de ruído (realismo para extração):
  - 3 layouts de laboratório distintos (Fleury, DASA, Pardini)
  - Datas em formatos variados (DD/MM/AAAA, DD-MM-AAAA, por extenso)
  - Abreviações inconsistentes (Glicemia vs Gli vs Glicose de Jejum)
  - Unidades variantes (mg/dL vs mg%)
  - Interpretações em linguagem natural geradas dinamicamente

Uso
---
    pip install reportlab numpy tqdm
    python gerar_laudos_pdf.py                      # 5 000 laudos
    python gerar_laudos_pdf.py --n 50000 --out ./laudos
    python gerar_laudos_pdf.py --n 200000 --workers 4
"""

import argparse
import math
import multiprocessing
import random
import sys
from datetime import date, datetime, timedelta
from io import BytesIO
from pathlib import Path

import numpy as np

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas as rl_canvas
    from reportlab.platypus import Paragraph
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.enums import TA_JUSTIFY
    pt = 1  # reportlab usa pontos como unidade base; 1 pt = 1 unidade canvas
except ImportError as e:
    print(e)
    print("Instale o reportlab: pip install reportlab")
    sys.exit(1)

try:
    from tqdm import tqdm as _tqdm
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False

# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTES — DADOS CLÍNICOS
# ─────────────────────────────────────────────────────────────────────────────

NOMES_M = [
    'Alexandre','Bruno','Carlos','Daniel','Eduardo','Felipe','Gustavo',
    'Henrique','Igor','João','Leandro','Marcelo','Nelson','Otávio','Pedro',
    'Rafael','Sérgio','Thiago','Vitor','Wellington','André','Bernardo',
    'Cláudio','Diego','Ernesto','Francisco','Gilberto','Hélio','Ivo','Jorge',
    'Augusto','Caio','Davi','Emanuel','Fábio','Gabriel','Nilton','Orlando',
    'Paulo','Renato','Saulo','Tiago','Valter','Wanderley','Xavier','Yuri',
]
NOMES_F = [
    'Ana','Beatriz','Carla','Diana','Elisa','Fernanda','Gabriela','Helena',
    'Isabela','Juliana','Karina','Lúcia','Mariana','Natália','Olívia',
    'Patrícia','Roberta','Sandra','Tatiana','Vanessa','Adriana','Bruna',
    'Cristina','Débora','Érica','Fátima','Giovanna','Irene','Jéssica',
    'Keila','Larissa','Mônica','Nathalie','Paula','Renata','Solange',
    'Telma','Vera','Yasmin','Aline','Bianca','Cecília','Danielle',
]
SOBRENOMES = [
    'Silva','Santos','Oliveira','Souza','Rodrigues','Ferreira','Alves',
    'Pereira','Lima','Gomes','Costa','Ribeiro','Martins','Carvalho',
    'Almeida','Lopes','Fernandes','Vieira','Barbosa','Rocha','Dias',
    'Nascimento','Andrade','Moreira','Nunes','Marques','Machado','Mendes',
    'Freitas','Correia','Teixeira','Ramos','Cunha','Pinto','Azevedo',
    'Melo','Monteiro','Cardoso','Cavalcante','Brito','Araújo','Leite',
]

MEDICOS = [
    ('Ana Beatriz Costa',      'CRM/SP 87432', 'Endocrinologia'),
    ('Carlos Eduardo Mendes',  'CRM/SP 54218', 'Cardiologia'),
    ('Fernanda Rocha Lima',    'CRM/MG 32109', 'Clínica Geral'),
    ('Gustavo Alves Teixeira', 'CRM/SP 91045', 'Medicina Interna'),
    ('Helena Martins Pereira', 'CRM/RJ 67823', 'Nefrologia'),
    ('João Pedro Barbosa',     'CRM/SP 48721', 'Clínica Médica'),
    ('Luciana Ferreira Melo',  'CRM/PR 22340', 'Endocrinologia'),
    ('Marcos Vinícius Dias',   'CRM/SP 73156', 'Cardiologia'),
    ('Natália Souza Andrade',  'CRM/BA 19872', 'Medicina Preventiva'),
    ('Rafael Rodrigues Nunes', 'CRM/SP 60934', 'Medicina Interna'),
    ('Sandra Oliveira Cunha',  'CRM/RS 35421', 'Clínica Geral'),
    ('Thiago Carvalho Moreira','CRM/SP 81267', 'Geriatria'),
]

CIDADES = [
    ('São Paulo','SP','01310-100'),('Rio de Janeiro','RJ','20040-020'),
    ('Belo Horizonte','MG','30130-110'),('Curitiba','PR','80010-020'),
    ('Porto Alegre','RS','90010-150'),('Salvador','BA','40020-000'),
    ('Campinas','SP','13010-040'),('Ribeirão Preto','SP','14010-931'),
    ('São Bernardo do Campo','SP','09710-001'),('Florianópolis','SC','88010-500'),
]

CID10 = {
    'alto':  [
        ('E11.9','Diabetes mellitus tipo 2, sem complicações'),
        ('I10',  'Hipertensão essencial (primária)'),
        ('E78.5','Hiperlipidemia mista'),
        ('E66.9','Obesidade não especificada'),
        ('I25.9','Doença isquêmica crônica do coração'),
        ('N18.3','Doença renal crônica, estágio 3'),
    ],
    'medio': [
        ('E11.9','Diabetes mellitus tipo 2'),
        ('I10',  'Hipertensão arterial sistêmica'),
        ('E78.0','Hipercolesterolemia pura'),
        ('E66.0','Obesidade devida a excesso de calorias'),
        ('J45.9','Asma não especificada'),
        ('F32.0','Episódio depressivo leve'),
    ],
    'baixo': [
        ('Z00.0','Exame médico geral'),
        ('Z13.6','Rastreamento de doenças cardiovasculares'),
        ('J06.9','Infecção aguda das vias aéreas superiores'),
        ('K29.7','Gastrite não especificada'),
        ('Z82.4','História familiar de doença isquêmica do coração'),
    ],
}

# ─────────────────────────────────────────────────────────────────────────────
# IDENTIDADES DE LABORATÓRIO (3 layouts distintos)
# ─────────────────────────────────────────────────────────────────────────────

LABS = [
    {
        'name':        'Laboratório Fleury',
        'short':       'FLEURY',
        'cnpj':        '60.840.055/0001-31',
        'cnes':        '2077472',
        'crm_resp':    'Dra. Marcia Tavares — CRF/SP 15.234',
        'color':       colors.HexColor('#003F7F'),       # azul-marinho
        'accent':      colors.HexColor('#00AEEF'),       # azul-claro
        'address':     'Av. General Waldomiro de Lima, 508 — Jabaquara — São Paulo/SP',
        'phone':       '(11) 3179-0000',
        'site':        'www.fleury.com.br',
        'style':       'formal',
    },
    {
        'name':        'Diagnósticos da América (DASA)',
        'short':       'DASA',
        'cnpj':        '61.486.650/0001-83',
        'cnes':        '3526180',
        'crm_resp':    'Dr. Paulo Riccio — CRF/SP 22.891',
        'color':       colors.HexColor('#C0392B'),       # vermelho
        'accent':      colors.HexColor('#E74C3C'),       # vermelho-claro
        'address':     'Rua Adolfo Lutz, 108 — Santa Cecília — São Paulo/SP',
        'phone':       '0800 722 3272',
        'site':        'www.dasa.com.br',
        'style':       'compacto',
    },
    {
        'name':        'Hermes Pardini',
        'short':       'PARDINI',
        'cnpj':        '19.378.769/0001-76',
        'cnes':        '6921504',
        'crm_resp':    'Dra. Cristiane Mendonça — CRF/MG 8.445',
        'color':       colors.HexColor('#1E8449'),       # verde
        'accent':      colors.HexColor('#27AE60'),       # verde-claro
        'address':     'Rua Aimorés, 66 — Funcionários — Belo Horizonte/MG',
        'phone':       '(31) 3228-6200',
        'site':        'www.hermespardini.com.br',
        'style':       'detalhado',
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# VARIAÇÕES DE NOMENCLATURA (ruído realista)
# ─────────────────────────────────────────────────────────────────────────────

EXAM_NAMES = {
    'glucose': [
        'Glicemia de Jejum', 'Glicose (jejum)', 'Glicose de Jejum',
        'Gli - Jejum 12h', 'Glicemia Plasmática em Jejum',
    ],
    'insulin': [
        'Insulina Basal', 'Insulina de Jejum', 'Insulina (basal)',
        'Insulina Plasmática', 'Ins - Jejum',
    ],
    'total_chol': [
        'Colesterol Total', 'Colesterol - Total', 'Colest. Total',
        'CT - Colesterol Total', 'Lipídios - Colesterol Total',
    ],
    'ldl': [
        'LDL Colesterol', 'LDL-Colesterol (Friedewald)', 'LDL-C',
        'Colesterol LDL', 'LDL Col. (calculado)',
    ],
    'hdl': [
        'HDL Colesterol', 'HDL-Colesterol', 'HDL-C',
        'Colesterol HDL', 'HDL Col.',
    ],
    'triglycerides': [
        'Triglicerídeos', 'Triglicérides', 'TG - Triglicerídeos',
        'Triglicérides (Enzimático)', 'Lipídios - Triglicerídeos',
    ],
    'homa_ir': [
        'HOMA-IR', 'HOMA IR (Insulino-resistência)', 'Índice HOMA-IR',
        'Resistência Insulínica - HOMA', 'HOMA-IR (calculado)',
    ],
    'sys_bp': [
        'Pressão Arterial Sistólica', 'PAS', 'Pressão Sistólica (mmHg)',
        'PA Sistólica', 'Pressão Arterial — Sistólica',
    ],
    'dia_bp': [
        'Pressão Arterial Diastólica', 'PAD', 'Pressão Diastólica (mmHg)',
        'PA Diastólica', 'Pressão Arterial — Diastólica',
    ],
}

UNITS = {
    'glucose':       ['mg/dL', 'mg/dL', 'mg%'],
    'insulin':       ['µUI/mL', 'uUI/mL', 'µU/mL', 'μIU/mL'],
    'total_chol':    ['mg/dL', 'mg/dL', 'mg%'],
    'ldl':           ['mg/dL', 'mg/dL', 'mg%'],
    'hdl':           ['mg/dL', 'mg/dL', 'mg%'],
    'triglycerides': ['mg/dL', 'mg/dL', 'mg%'],
    'homa_ir':       ['—', 'adimensional', ''],
    'sys_bp':        ['mmHg', 'mm Hg', 'mmHg'],
    'dia_bp':        ['mmHg', 'mm Hg', 'mmHg'],
}

REF_RANGES = {
    'glucose':       ('Desejável: < 100\nPré-diabetes: 100–125\nDiabetes: ≥ 126', lambda v, s: v > 99),
    'insulin':       ('Valor de referência: < 25 µUI/mL',                          lambda v, s: v > 25),
    'total_chol':    ('Desejável: < 200\nLimítrofe: 200–239\nAlto: ≥ 240',        lambda v, s: v >= 200),
    'ldl':           ('Ótimo: < 100\nDesejável: 100–129\nLimítrofe: 130–159\nAlto: ≥ 160', lambda v, s: v >= 130),
    'hdl':           ('Baixo risco: ≥ 60\nRisco: < 40 (M) / < 50 (F)',             lambda v, s: v < (50 if s == 'F' else 40)),
    'triglycerides': ('Desejável: < 150\nLimítrofe: 150–199\nAlto: ≥ 200',        lambda v, s: v >= 150),
    'homa_ir':       ('Normal: < 2,5\nResistência insulínica: ≥ 2,5',              lambda v, s: v >= 2.5),
    'sys_bp':        ('Normal: < 120\nElevada: 120–129\nHAS estágio 1: 130–139',  lambda v, s: v >= 130),
    'dia_bp':        ('Normal: < 80\nHAS estágio 1: 80–89\nHAS estágio 2: ≥ 90',  lambda v, s: v >= 80),
}

# ─────────────────────────────────────────────────────────────────────────────
# GERAÇÃO DE DADOS CLÍNICOS
# ─────────────────────────────────────────────────────────────────────────────

def _clamp(v, lo, hi):
    return max(lo, min(hi, v))

def _gauss(rng, mean, std, lo=-1e9, hi=1e9):
    return float(np.clip(rng.normal(mean, std), lo, hi))

def _sigmoid(x):
    return 1.0 / (1.0 + math.exp(-x))

def calc_homa_ir(glucose, insulin):
    return round((glucose * insulin) / 405, 2)

def calc_framingham(age, sex, tc, hdl, sbp, smoker, diabetic):
    if sex == 'M':
        pts = (-1 if age<35 else 0 if age<40 else 1 if age<45 else
               2 if age<50 else 3 if age<55 else 4 if age<60 else
               5 if age<65 else 6 if age<70 else 7)
        pts += -3 if tc<160 else 0 if tc<200 else 1 if tc<240 else 2 if tc<280 else 3
        pts += 2 if hdl<35 else 1 if hdl<45 else 0 if hdl<50 else -1 if hdl<60 else -2
        pts += -3 if sbp<120 else 0 if sbp<130 else 1 if sbp<140 else 2 if sbp<160 else 3
        if smoker: pts += 2
        if diabetic: pts += 2
        tbl = [1,2,2,3,4,4,6,7,9,11,14,18,22,27,33,40,47,56]
        return tbl[int(_clamp(pts + 3, 0, 17))]
    else:
        pts = (-9 if age<35 else -4 if age<40 else 0 if age<45 else
               3 if age<50 else 6 if age<55 else 7 if age<60 else 8)
        pts += -2 if tc<160 else 0 if tc<200 else 1 if tc<240 else 2 if tc<280 else 3
        pts += 5 if hdl<35 else 2 if hdl<45 else 1 if hdl<50 else 0 if hdl<60 else -2
        pts += -3 if sbp<120 else 0 if sbp<130 else 1 if sbp<140 else 2 if sbp<160 else 3
        if smoker: pts += 2
        if diabetic: pts += 4
        tbl = [1,2,2,3,3,4,5,6,7,8,9,11,13,15,17,20,24,27,32]
        return tbl[int(_clamp(pts + 2, 0, 18))]

def generate_patient_exam(seed: int, ref_date: date) -> dict:
    rng    = np.random.default_rng(seed)
    py_rng = random.Random(seed)

    tier = py_rng.choices(['alto','medio','baixo'], weights=[0.30, 0.40, 0.30])[0]
    sex  = 'M' if rng.random() > 0.52 else 'F'
    age  = int(_clamp(_gauss(rng, {'alto':58,'medio':47,'baixo':36}[tier], 9), 25, 78))

    smoker   = rng.random() < {'alto':0.55,'medio':0.25,'baixo':0.08}[tier]
    diabetic = rng.random() < {'alto':0.58,'medio':0.22,'baixo':0.04}[tier]

    params = {
        'alto':  dict(gM=140,iM=22,tcM=248,ldlM=168,hdlM=33 if sex=='M' else 42,tgM=225,sysM=152,diaM=95),
        'medio': dict(gM=106,iM=13,tcM=215,ldlM=138,hdlM=42 if sex=='M' else 51,tgM=158,sysM=134,diaM=84),
        'baixo': dict(gM=88, iM=7, tcM=178,ldlM=105,hdlM=54 if sex=='M' else 62,tgM=105,sysM=116,diaM=74),
    }[tier]

    glucose       = round(_clamp(_gauss(rng, params['gM'],   12),  60, 310))
    insulin       = round(_clamp(_gauss(rng, params['iM'],    3),   1,  60), 1)
    total_chol    = round(_clamp(_gauss(rng, params['tcM'],  18), 100, 360))
    ldl           = round(_clamp(_gauss(rng, params['ldlM'], 15),  40, 260))
    hdl           = round(_clamp(_gauss(rng, params['hdlM'],  7),  15, 105))
    triglycerides = round(_clamp(_gauss(rng, params['tgM'],  25),  40, 510))
    sys_bp        = round(_clamp(_gauss(rng, params['sysM'], 10),  88, 225))
    dia_bp        = round(_clamp(_gauss(rng, params['diaM'],  8),  55, 135))
    homa_ir       = calc_homa_ir(glucose, insulin)
    framingham    = calc_framingham(age, sex, total_chol, hdl, sys_bp, smoker, diabetic)

    birth_year = ref_date.year - age
    birth = date(birth_year, py_rng.randint(1,12), py_rng.randint(1,28))
    name_arr = NOMES_M if sex == 'M' else NOMES_F
    name = f"{py_rng.choice(name_arr)} {py_rng.choice(SOBRENOMES)}"
    cpf_d = [py_rng.randint(0,9) for _ in range(9)]
    s1 = sum((10-i)*v for i,v in enumerate(cpf_d)) % 11
    cpf_d.append(0 if s1<2 else 11-s1)
    s2 = sum((11-i)*v for i,v in enumerate(cpf_d)) % 11
    cpf_d.append(0 if s2<2 else 11-s2)
    cpf = f'{"".join(map(str,cpf_d[:3]))}.{"".join(map(str,cpf_d[3:6]))}.{"".join(map(str,cpf_d[6:9]))}-{"".join(map(str,cpf_d[9:]))}'

    city, state, cep = py_rng.choice(CIDADES)
    doctor = py_rng.choice(MEDICOS)
    lab    = py_rng.choice(LABS)
    cid_code, cid_desc = py_rng.choice(CID10[tier])

    days_ago = py_rng.randint(1, 365)
    exam_date = ref_date - timedelta(days=days_ago)
    collect_hour = py_rng.randint(6, 10)
    collect_min  = py_rng.choice([0, 15, 30, 45])
    report_dt    = datetime(exam_date.year, exam_date.month, exam_date.day,
                            collect_hour + py_rng.randint(2, 6),
                            py_rng.randint(0, 59))

    protocol = f"{lab['short'][:3]}{exam_date.strftime('%Y%m%d')}{seed:06d}"

    return {
        'seed':         seed,
        'tier':         tier,
        'patient_id':   f'P{seed:08d}',
        'name':         name,
        'age':          age,
        'sex':          sex,
        'birth_date':   birth,
        'cpf':          cpf,
        'city':         city,
        'state':        state,
        'cep':          cep,
        'doctor_name':  doctor[0],
        'doctor_crm':   doctor[1],
        'doctor_spec':  doctor[2],
        'cid_code':     cid_code,
        'cid_desc':     cid_desc,
        'lab':          lab,
        'exam_date':    exam_date,
        'collect_time': f'{collect_hour:02d}:{collect_min:02d}',
        'report_dt':    report_dt,
        'protocol':     protocol,
        'smoker':       smoker,
        'diabetic':     diabetic,
        'glucose':       glucose,
        'insulin':       insulin,
        'total_chol':    total_chol,
        'ldl':           ldl,
        'hdl':           hdl,
        'triglycerides': triglycerides,
        'homa_ir':       homa_ir,
        'sys_bp':        sys_bp,
        'dia_bp':        dia_bp,
        'framingham':    framingham,
    }

# ─────────────────────────────────────────────────────────────────────────────
# FORMATADORES DE DATAS (variação proposital)
# ─────────────────────────────────────────────────────────────────────────────

MESES_PT = ['janeiro','fevereiro','março','abril','maio','junho',
            'julho','agosto','setembro','outubro','novembro','dezembro']

def fmt_date(d: date, style: int) -> str:
    if style == 0: return d.strftime('%d/%m/%Y')
    if style == 1: return d.strftime('%d-%m-%Y')
    if style == 2: return f'{d.day} de {MESES_PT[d.month-1]} de {d.year}'
    if style == 3: return d.strftime('%d/%m/%y')
    return d.strftime('%Y-%m-%d')

# ─────────────────────────────────────────────────────────────────────────────
# GERAÇÃO DE TEXTO DE INTERPRETAÇÃO CLÍNICA
# ─────────────────────────────────────────────────────────────────────────────

def build_interpretation(d: dict, py_rng: random.Random) -> str:
    findings = []
    sex_term = 'paciente' if py_rng.random() > 0.5 else ('o paciente' if d['sex']=='M' else 'a paciente')

    if d['glucose'] > 125:
        findings.append(f"glicemia de jejum elevada ({d['glucose']} mg/dL), compatível com quadro de diabetes mellitus")
    elif d['glucose'] > 99:
        findings.append(f"glicemia de jejum em nível pré-diabético ({d['glucose']} mg/dL), sugerindo intolerância à glicose")

    if d['homa_ir'] >= 2.5:
        findings.append(f"índice HOMA-IR de {d['homa_ir']}, indicando resistência periférica à insulina")

    if d['total_chol'] >= 240:
        findings.append(f"hipercolesterolemia (CT = {d['total_chol']} mg/dL)")
    elif d['total_chol'] >= 200:
        findings.append(f"colesterol total limítrofe ({d['total_chol']} mg/dL)")

    if d['ldl'] >= 160:
        findings.append(f"LDL-colesterol elevado ({d['ldl']} mg/dL)")
    elif d['ldl'] >= 130:
        findings.append(f"LDL-colesterol limítrofe alto ({d['ldl']} mg/dL)")

    hdl_ref = 50 if d['sex'] == 'F' else 40
    if d['hdl'] < hdl_ref:
        findings.append(f"HDL-colesterol abaixo do desejável ({d['hdl']} mg/dL)")

    if d['triglycerides'] >= 200:
        findings.append(f"hipertrigliceridemia ({d['triglycerides']} mg/dL)")
    elif d['triglycerides'] >= 150:
        findings.append(f"triglicerídeos limítrofes ({d['triglycerides']} mg/dL)")

    if d['sys_bp'] >= 140:
        findings.append(f"hipertensão arterial sistêmica estágio 2 (PA = {d['sys_bp']}/{d['dia_bp']} mmHg)")
    elif d['sys_bp'] >= 130:
        findings.append(f"hipertensão arterial estágio 1 (PA = {d['sys_bp']}/{d['dia_bp']} mmHg)")

    if not findings:
        templates = [
            f"Os exames laboratoriais do {sex_term} apresentam-se dentro dos limites de referência adotados por este laboratório. "
            f"Recomenda-se acompanhamento clínico periódico conforme orientação médica.",
            f"Perfil metabólico e lipídico sem alterações significativas. "
            f"Manter hábitos saudáveis e repetir exames conforme protocolo.",
        ]
        return py_rng.choice(templates)

    connectors = [', ', '; ', ' e ', ', além de ']
    items = findings[:]
    text = items[0]
    for i in range(1, len(items)):
        conn = py_rng.choice(connectors) if i < len(items)-1 else ' e '
        text += conn + items[i]

    openers = [
        f"O perfil laboratorial do {sex_term} evidencia ",
        f"A análise dos resultados demonstra ",
        f"Os exames revelam ",
        f"O presente laudo identifica ",
    ]
    closers = [
        " Recomenda-se avaliação clínica complementar e ajuste terapêutico conforme indicação médica.",
        f" Sugere-se correlação clínica e seguimento com especialista em {d['doctor_spec'].lower()}.",
        " Os achados devem ser correlacionados com o quadro clínico do paciente.",
        " Encaminha-se ao médico assistente para avaliação e conduta apropriada.",
    ]
    return py_rng.choice(openers) + text + "." + py_rng.choice(closers)

# ─────────────────────────────────────────────────────────────────────────────
# RENDERIZAÇÃO DO PDF
# ─────────────────────────────────────────────────────────────────────────────

PAGE_W, PAGE_H = A4          # 595.27 × 841.89 pt
MARGIN_X = 40 * pt           # margem lateral
MARGIN_Y = 28 * pt           # margem vertical
CONTENT_W = PAGE_W - 2 * MARGIN_X

# cores neutras
C_BLACK  = colors.HexColor('#1A1A1A')
C_GRAY   = colors.HexColor('#555555')
C_LGRAY  = colors.HexColor('#EEEEEE')
C_MGRAY  = colors.HexColor('#CCCCCC')
C_RED    = colors.HexColor('#C0392B')
C_BLUE   = colors.HexColor('#1A5276')
C_GREEN  = colors.HexColor('#1E8449')
C_WHITE  = colors.white


def _draw_barcode_sim(c: rl_canvas.Canvas, x: float, y: float,
                      width: float, height: float, py_rng: random.Random):
    """Simula um código de barras com retângulos."""
    bar_x = x
    while bar_x < x + width - 2:
        bw = py_rng.choice([1, 1, 1, 2, 3]) * pt
        if py_rng.random() > 0.4:
            c.setFillColor(C_BLACK)
            c.rect(bar_x, y, bw, height, stroke=0, fill=1)
        bar_x += bw + py_rng.choice([0.5, 1, 1.5]) * pt
    c.setFillColor(C_BLACK)


def render_laudo(data: dict, py_rng: random.Random) -> bytes:
    buf = BytesIO()
    lab = data['lab']
    c   = rl_canvas.Canvas(buf, pagesize=A4)
    c.setTitle(f"Laudo — {data['protocol']}")

    y = PAGE_H - MARGIN_Y

    # ── CABEÇALHO ─────────────────────────────────────────────────────────────
    header_h = 58 * pt
    c.setFillColor(lab['color'])
    c.rect(0, PAGE_H - header_h, PAGE_W, header_h, stroke=0, fill=1)

    # faixa de destaque inferior do header
    c.setFillColor(lab['accent'])
    c.rect(0, PAGE_H - header_h - 4*pt, PAGE_W, 4*pt, stroke=0, fill=1)

    # nome do laboratório
    c.setFillColor(C_WHITE)
    c.setFont('Helvetica-Bold', 18)
    c.drawString(MARGIN_X, PAGE_H - 26*pt, lab['name'].upper())

    # subtítulo / tipo de documento
    c.setFont('Helvetica', 8)
    c.drawString(MARGIN_X, PAGE_H - 38*pt, 'RESULTADO DE EXAMES LABORATORIAIS')

    # info direita do header
    c.setFont('Helvetica', 7)
    info_right = [
        f"CNPJ: {lab['cnpj']}",
        f"CNES: {lab['cnes']}",
        lab['phone'],
        lab['site'],
    ]
    right_x = PAGE_W - MARGIN_X
    for i, line in enumerate(info_right):
        c.drawRightString(right_x, PAGE_H - 16*pt - i*9*pt, line)

    y = PAGE_H - header_h - 8*pt

    # ── ENDEREÇO ─────────────────────────────────────────────────────────────
    c.setFillColor(C_GRAY)
    c.setFont('Helvetica', 7)
    c.drawString(MARGIN_X, y, lab['address'])
    y -= 16*pt

    # ── PROTOCOLO / TÍTULO ───────────────────────────────────────────────────
    c.setFillColor(lab['color'])
    c.setFont('Helvetica-Bold', 10)
    c.drawString(MARGIN_X, y, 'LAUDO LABORATORIAL')
    c.setFont('Helvetica', 8)
    c.setFillColor(C_GRAY)
    date_style = py_rng.randint(0, 4)
    emit_str   = fmt_date(data['exam_date'], date_style)
    c.drawRightString(PAGE_W - MARGIN_X, y,
                      f"Protocolo: {data['protocol']}   |   Emissão: {emit_str}")
    y -= 4*pt
    c.setStrokeColor(lab['color'])
    c.setLineWidth(0.8)
    c.line(MARGIN_X, y, PAGE_W - MARGIN_X, y)
    y -= 10*pt

    # ── DADOS DO PACIENTE ────────────────────────────────────────────────────
    def section_title(text, ypos):
        c.setFillColor(C_LGRAY)
        c.rect(MARGIN_X, ypos - 2*pt, CONTENT_W, 14*pt, stroke=0, fill=1)
        c.setFillColor(lab['color'])
        c.setFont('Helvetica-Bold', 8)
        c.drawString(MARGIN_X + 4*pt, ypos + 3*pt, text.upper())
        return ypos - 16*pt

    y = section_title('Dados do Paciente', y)
    y -= 3*pt

    sex_label = 'Masculino' if data['sex'] == 'M' else 'Feminino'
    birth_str = fmt_date(data['birth_date'], py_rng.randint(0, 2))
    col2_x = MARGIN_X + CONTENT_W / 2

    def kv(label, value, x, ypos, font_size=8):
        c.setFont('Helvetica-Bold', font_size)
        c.setFillColor(C_GRAY)
        c.drawString(x, ypos, f'{label}:')
        c.setFont('Helvetica', font_size)
        c.setFillColor(C_BLACK)
        lw = c.stringWidth(f'{label}: ', 'Helvetica-Bold', font_size)
        c.drawString(x + lw, ypos, value)

    kv('Paciente',   data['name'],      MARGIN_X, y)
    kv('Sexo',       sex_label,         col2_x,   y)
    y -= 12*pt
    kv('Data de Nasc.', birth_str,      MARGIN_X, y)
    kv('Idade',      f"{data['age']} anos", col2_x, y)
    y -= 12*pt
    kv('CPF',        data['cpf'],       MARGIN_X, y)
    kv('CID-10',     f"{data['cid_code']} — {data['cid_desc'][:38]}", col2_x, y)
    y -= 12*pt
    kv('Município',  f"{data['city']}/{data['state']} — CEP {data['cep']}", MARGIN_X, y)
    y -= 14*pt

    c.setStrokeColor(C_MGRAY)
    c.setLineWidth(0.4)
    c.line(MARGIN_X, y, PAGE_W - MARGIN_X, y)
    y -= 10*pt

    # ── DADOS DA COLETA ──────────────────────────────────────────────────────
    y = section_title('Dados da Requisição', y)
    y -= 3*pt
    collect_str = (f"{fmt_date(data['exam_date'], py_rng.randint(0,3))} "
                   f"às {data['collect_time']}h")
    kv('Médico Solicitante', data['doctor_name'],  MARGIN_X, y)
    kv('CRM',                data['doctor_crm'],   col2_x,   y)
    y -= 12*pt
    kv('Especialidade',      data['doctor_spec'],  MARGIN_X, y)
    kv('Data de Coleta',     collect_str,          col2_x,   y)
    y -= 12*pt
    material = py_rng.choice([
        'Sangue venoso — soro (jejum de 12 horas)',
        'Sangue venoso — plasma EDTA (jejum ≥ 8h)',
        'Sangue venoso — soro (jejum de 10 a 12h)',
    ])
    kv('Material',  material,  MARGIN_X, y)
    y -= 16*pt

    # ── TABELA DE RESULTADOS ─────────────────────────────────────────────────
    c.setStrokeColor(C_MGRAY)
    c.line(MARGIN_X, y, PAGE_W - MARGIN_X, y)
    y -= 2*pt
    y = section_title('Resultado dos Exames', y)
    y -= 4*pt

    # cabeçalho da tabela
    cols = [0, 185*pt, 270*pt, 320*pt, 420*pt]  # posições X relativas ao MARGIN_X
    col_labels = ['EXAME', 'RESULTADO', 'UNIDADE', 'VALOR DE REFERÊNCIA', 'INTERP.']
    c.setFillColor(lab['color'])
    c.rect(MARGIN_X, y - 3*pt, CONTENT_W, 14*pt, stroke=0, fill=1)
    c.setFillColor(C_WHITE)
    c.setFont('Helvetica-Bold', 7)
    for ci, label in enumerate(col_labels):
        c.drawString(MARGIN_X + cols[ci] + 3*pt, y + 2*pt, label)
    y -= 16*pt

    exam_rows = [
        ('glucose',       data['glucose'],       2),
        ('insulin',       data['insulin'],        1),
        ('total_chol',    data['total_chol'],     0),
        ('ldl',           data['ldl'],            0),
        ('hdl',           data['hdl'],            0),
        ('triglycerides', data['triglycerides'],  0),
        ('homa_ir',       data['homa_ir'],        2),
        ('sys_bp',        data['sys_bp'],         0),
        ('dia_bp',        data['dia_bp'],         0),
    ]

    row_h = 24*pt
    for idx, (key, value, decimals) in enumerate(exam_rows):
        ref_text, altered_fn = REF_RANGES[key]
        is_alt = altered_fn(value, data['sex'])

        # fundo alternado
        bg = colors.HexColor('#F7F9FC') if idx % 2 == 0 else C_WHITE
        c.setFillColor(bg)
        c.rect(MARGIN_X, y - 2*pt, CONTENT_W, row_h, stroke=0, fill=1)

        # borda esquerda colorida se alterado
        if is_alt:
            c.setFillColor(C_RED)
            c.rect(MARGIN_X, y - 2*pt, 3*pt, row_h, stroke=0, fill=1)

        name_variants = EXAM_NAMES[key]
        exam_label = py_rng.choice(name_variants)
        unit_label = py_rng.choice(UNITS[key])
        val_str    = f'{value:.{decimals}f}'
        interp_sym = '↑ Alto' if is_alt and key not in ('hdl',) else ('↓ Baixo' if is_alt else 'Normal')
        if key == 'hdl' and is_alt:
            interp_sym = '↓ Baixo'
        interp_color = C_RED if is_alt else C_GREEN

        c.setFont('Helvetica', 8)
        c.setFillColor(C_BLACK)
        c.drawString(MARGIN_X + cols[0] + 5*pt, y + 7*pt, exam_label)

        c.setFont('Helvetica-Bold', 9)
        c.setFillColor(C_RED if is_alt else C_BLACK)
        c.drawString(MARGIN_X + cols[1] + 3*pt, y + 7*pt, val_str)

        c.setFont('Helvetica', 8)
        c.setFillColor(C_GRAY)
        c.drawString(MARGIN_X + cols[2] + 3*pt, y + 7*pt, unit_label)

        # referência em múltiplas linhas (fonte 6)
        c.setFont('Helvetica', 6)
        c.setFillColor(C_GRAY)
        ref_lines = ref_text.split('\n')
        for li, rline in enumerate(ref_lines[:2]):
            c.drawString(MARGIN_X + cols[3] + 3*pt, y + row_h - 9*pt - li*7*pt, rline)

        c.setFont('Helvetica-Bold', 8)
        c.setFillColor(interp_color)
        c.drawString(MARGIN_X + cols[4] + 3*pt, y + 7*pt, interp_sym)

        # linha divisória
        c.setStrokeColor(C_MGRAY)
        c.setLineWidth(0.3)
        c.line(MARGIN_X, y - 2*pt, PAGE_W - MARGIN_X, y - 2*pt)

        y -= row_h

    y -= 6*pt

    # ── INTERPRETAÇÃO CLÍNICA ────────────────────────────────────────────────
    c.setStrokeColor(C_MGRAY)
    c.line(MARGIN_X, y, PAGE_W - MARGIN_X, y)
    y -= 2*pt
    y = section_title('Interpretação Clínica', y)
    y -= 6*pt

    interp_text = build_interpretation(data, py_rng)
    style = ParagraphStyle('interp',
        fontName='Helvetica', fontSize=8, leading=12,
        textColor=C_BLACK, alignment=TA_JUSTIFY,
        leftIndent=4, rightIndent=4)
    para = Paragraph(interp_text, style)
    para_w, para_h = para.wrapOn(c, CONTENT_W - 8*pt, 200*pt)
    para.drawOn(c, MARGIN_X + 4*pt, y - para_h)
    y -= para_h + 12*pt

    # nota sobre o Escore de Framingham
    c.setFont('Helvetica-Oblique', 7)
    c.setFillColor(C_GRAY)
    c.drawString(MARGIN_X + 4*pt, y,
                 f'Risco cardiovascular em 10 anos (Escore de Framingham): {data["framingham"]}%')
    y -= 18*pt

    # ── RODAPÉ ───────────────────────────────────────────────────────────────
    footer_y = MARGIN_Y + 40*pt

    c.setStrokeColor(lab['color'])
    c.setLineWidth(0.6)
    c.line(MARGIN_X, footer_y + 30*pt, MARGIN_X + 120*pt, footer_y + 30*pt)

    c.setFont('Helvetica-Bold', 7)
    c.setFillColor(C_BLACK)
    c.drawString(MARGIN_X, footer_y + 22*pt, 'RESPONSÁVEL TÉCNICO')
    c.setFont('Helvetica', 7)
    c.drawString(MARGIN_X, footer_y + 13*pt, lab['crm_resp'])

    report_str = fmt_date(data['report_dt'].date(), 0) + f" às {data['report_dt'].strftime('%H:%M')}"
    c.setFont('Helvetica', 7)
    c.setFillColor(C_GRAY)
    c.drawString(MARGIN_X, footer_y + 4*pt,
                 f'Emitido em: {report_str}   |   Este laudo tem validade de 90 dias.')

    # código de barras simulado
    bc_x = PAGE_W - MARGIN_X - 110*pt
    bc_y = footer_y
    bc_w = 110*pt
    bc_h = 28*pt
    _draw_barcode_sim(c, bc_x, bc_y + 8*pt, bc_w, bc_h - 8*pt, py_rng)
    c.setFont('Helvetica', 6)
    c.setFillColor(C_BLACK)
    c.drawCentredString(bc_x + bc_w/2, bc_y + 2*pt, data['protocol'])

    # linha de rodapé final
    c.setStrokeColor(lab['accent'])
    c.setLineWidth(2)
    c.line(0, MARGIN_Y, PAGE_W, MARGIN_Y)
    c.setFillColor(lab['color'])
    c.setFont('Helvetica', 6)
    c.drawCentredString(PAGE_W/2, MARGIN_Y - 8*pt,
                        f'{lab["name"]} — {lab["address"]} — {lab["phone"]}')

    c.save()
    return buf.getvalue()

# ─────────────────────────────────────────────────────────────────────────────
# WORKER PARA MULTIPROCESSING
# ─────────────────────────────────────────────────────────────────────────────

def _worker(args):
    seed, ref_date_iso, out_dir = args
    ref_date = date.fromisoformat(ref_date_iso)
    py_rng   = random.Random(seed)
    data     = generate_patient_exam(seed, ref_date)
    pdf_bytes = render_laudo(data, py_rng)

    subdir = Path(out_dir) / f'P{seed:08d}'
    subdir.mkdir(parents=True, exist_ok=True)
    path = subdir / f'{data["protocol"]}.pdf'
    path.write_bytes(pdf_bytes)

    return {
        'file':       str(path.relative_to(out_dir)),
        'protocol':   data['protocol'],
        'patient_id': data['patient_id'],
        'patient':    data['name'],
        'exam_date':  data['exam_date'].isoformat(),
        'tier':       data['tier'],
        'lab':        data['lab']['short'],
        'glucose':    data['glucose'],
        'insulin':    data['insulin'],
        'total_chol': data['total_chol'],
        'ldl':        data['ldl'],
        'hdl':        data['hdl'],
        'triglycerides': data['triglycerides'],
        'homa_ir':    data['homa_ir'],
        'sys_bp':     data['sys_bp'],
        'dia_bp':     data['dia_bp'],
        'framingham': data['framingham'],
    }

# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Gerador de Laudos PDF — CarePlus')
    parser.add_argument('--n',       type=int, default=5_000,
                        help='Número de laudos a gerar (default: 5000)')
    parser.add_argument('--seed',    type=int, default=42,
                        help='Seed base para reprodutibilidade')
    parser.add_argument('--out',     type=str, default='./laudos',
                        help='Diretório de saída (default: ./laudos)')
    parser.add_argument('--workers', type=int,
                        default=max(1, multiprocessing.cpu_count() - 1),
                        help='Processos paralelos (default: CPUs-1)')
    parser.add_argument('--ref-date', type=str, default='2026-05-25',
                        help='Data de referência ISO (default: 2026-05-25)')
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    seeds    = list(range(args.seed, args.seed + args.n))
    task_args = [(s, args.ref_date, str(out_dir)) for s in seeds]

    print(f'\nCarePlus - Gerador de Laudos PDF')
    print(f'  Laudos a gerar : {args.n:,}')
    print(f'  Seed base      : {args.seed}')
    print(f'  Workers        : {args.workers}')
    print(f'  Saida          : {out_dir.resolve()}\n')

    index_rows = []

    if args.workers > 1:
        with multiprocessing.Pool(processes=args.workers) as pool:
            imap = pool.imap_unordered(_worker, task_args, chunksize=50)
            if HAS_TQDM:
                imap = _tqdm(imap, total=args.n, desc='Gerando PDFs', unit='pdf')
            for row in imap:
                index_rows.append(row)
    else:
        iterator = task_args
        if HAS_TQDM:
            iterator = _tqdm(task_args, desc='Gerando PDFs', unit='pdf')
        for ta in iterator:
            index_rows.append(_worker(ta))

    # salva índice CSV (ground truth para avaliação do extractor)
    import csv
    index_path = out_dir / 'index.csv'
    if index_rows:
        with open(index_path, 'w', newline='', encoding='utf-8') as f:
            w = csv.DictWriter(f, fieldnames=list(index_rows[0].keys()))
            w.writeheader()
            w.writerows(index_rows)

    # estatísticas
    by_tier  = {'alto': 0, 'medio': 0, 'baixo': 0}
    by_lab   = {}
    for r in index_rows:
        by_tier[r['tier']] += 1
        by_lab[r['lab']] = by_lab.get(r['lab'], 0) + 1

    sep = '=' * 40
    print(f'\n{sep}')
    print(f'  {len(index_rows):,} laudos gerados')
    print(f'  Indice (ground truth): {index_path}')
    print(f'\n  Por tier de risco:')
    for k, v in by_tier.items():
        print(f'    {k:>6}: {v:>6,} ({v/len(index_rows)*100:.1f}%)')
    print(f'\n  Por laboratorio:')
    for k, v in sorted(by_lab.items(), key=lambda x: -x[1]):
        print(f'    {k:>10}: {v:>6,}')
    print(f'{sep}\n')


if __name__ == '__main__':
    main()
