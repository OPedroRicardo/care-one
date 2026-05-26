"""
Gerador de dataset de exames médicos fakes — CarePlus
======================================================
Produz centenas de milhares de registros alinhados com as entidades do
OperadoraDashboard (Patient, LabPoint) e exporta em CSV + JSON-lines.

Entidades geradas
-----------------
patients.csv        — Beneficiários (demográfico + flags clínicos)
exams.csv           — Exames laboratoriais por paciente / mês
internacoes.csv     — Internações hospitalares
consultas.csv       — Consultas ambulatoriais
sinistros.csv       — Sinistros/custos por evento
procedimentos.csv   — Procedimentos realizados em cada consulta

Uso
---
    pip install faker numpy pandas tqdm
    python gerar_exames.py                   # padrão: 200 000 exames
    python gerar_exames.py --exames 500000   # escala livre
    python gerar_exames.py --seed 99 --out ./data
"""

import argparse
import csv
import json
import math
import os
import random
import sys
from dataclasses import asdict, dataclass, field
from datetime import date, timedelta
from pathlib import Path
from typing import Literal

import numpy as np

# ── dependências opcionais ────────────────────────────────────────────────────
try:
    from tqdm import tqdm
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False

# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTES CLÍNICAS
# ─────────────────────────────────────────────────────────────────────────────

NOMES_M = [
    'Alexandre','Bruno','Carlos','Daniel','Eduardo','Felipe','Gustavo',
    'Henrique','Igor','João','Leandro','Marcelo','Nelson','Otávio','Pedro',
    'Rafael','Sérgio','Thiago','Vitor','Wellington','André','Bernardo',
    'Cláudio','Diego','Ernesto','Francisco','Gilberto','Hélio','Ivo','Jorge',
    'Augusto','Caio','Davi','Emanuel','Fábio','Gabriel','Hudson','Ígor',
    'Jair','Kauê','Luciano','Márcio','Nilton','Orlando','Paulo','Quirino',
    'Renato','Saulo','Tiago','Ubiratan','Valter','Wanderley','Xavier','Yuri',
]

NOMES_F = [
    'Ana','Beatriz','Carla','Diana','Elisa','Fernanda','Gabriela','Helena',
    'Isabela','Juliana','Karina','Lúcia','Mariana','Natália','Olívia',
    'Patrícia','Roberta','Sandra','Tatiana','Vanessa','Adriana','Bruna',
    'Cristina','Débora','Érica','Fátima','Giovanna','Hosana','Irene',
    'Jéssica','Keila','Larissa','Mônica','Nathalie','Orlanda','Paula',
    'Queila','Renata','Solange','Telma','Ursula','Vera','Wanda','Ximena',
    'Yasmin','Zélia','Aline','Bianca','Cecília','Danielle',
]

SOBRENOMES = [
    'Silva','Santos','Oliveira','Souza','Rodrigues','Ferreira','Alves',
    'Pereira','Lima','Gomes','Costa','Ribeiro','Martins','Carvalho',
    'Almeida','Lopes','Sousa','Fernandes','Vieira','Barbosa','Rocha',
    'Dias','Nascimento','Andrade','Moreira','Nunes','Marques','Machado',
    'Mendes','Freitas','Correia','Teixeira','Ramos','Cunha','Pinto',
    'Azevedo','Melo','Monteiro','Cardoso','Cavalcante','Brito','Araújo',
    'Peixoto','Fonseca','Pires','Lacerda','Queiroz','Xavier','Campos','Leite',
]

CIDADES = [
    ('São Paulo','SP'),('Rio de Janeiro','RJ'),('Belo Horizonte','MG'),
    ('Salvador','BA'),('Fortaleza','CE'),('Curitiba','PR'),('Manaus','AM'),
    ('Recife','PE'),('Porto Alegre','RS'),('Belém','PA'),('Goiânia','GO'),
    ('Guarulhos','SP'),('Campinas','SP'),('São Luís','MA'),('Maceió','AL'),
    ('Natal','RN'),('Teresina','PI'),('Campo Grande','MS'),('João Pessoa','PB'),
    ('Osasco','SP'),('Ribeirão Preto','SP'),('Sorocaba','SP'),('Uberlândia','MG'),
    ('Cuiabá','MT'),('Joinville','SC'),('Florianópolis','SC'),('São José','SC'),
    ('Aracaju','SE'),('Feira de Santana','BA'),('Londrina','PR'),
]

PLANOS = [
    ('Básico Ambulatorial','B001',350.0),
    ('Básico + Internação','B002',480.0),
    ('Avançado Ambulatorial','A001',680.0),
    ('Avançado + Odonto','A002',780.0),
    ('Premium Individual','P001',1200.0),
    ('Premium Família','P002',2100.0),
    ('Empresarial Standard','E001',550.0),
    ('Empresarial Plus','E002',820.0),
    ('Corporativo Gold','C001',1450.0),
]

PRESTADORES = [
    ('Hospital das Clínicas','HC-001','hospital'),
    ('Hospital Albert Einstein','AE-001','hospital'),
    ('Hospital Sírio-Libanês','SL-001','hospital'),
    ('Hospital Santa Cruz','SC-001','hospital'),
    ('Hospital São Luiz','HSL-001','hospital'),
    ('UPA 24h Centro','UPA-001','upa'),
    ('UPA 24h Norte','UPA-002','upa'),
    ('Clínica Popular Saúde+','CP-001','clinica'),
    ('Clínica Bem Estar','CBE-001','clinica'),
    ('Lab Fleury','FL-001','laboratorio'),
    ('Lab Dasa','DA-001','laboratorio'),
    ('Lab Hermes Pardini','HP-001','laboratorio'),
    ('Centro de Diagnóstico Imagem','CDI-001','imagem'),
    ('Diagnósticos da América','DDA-001','imagem'),
]

ESPECIALIDADES = [
    'Clínica Geral','Cardiologia','Endocrinologia','Nefrologia','Neurologia',
    'Pneumologia','Gastroenterologia','Ortopedia','Ginecologia','Urologia',
    'Oftalmologia','Dermatologia','Psiquiatria','Reumatologia','Oncologia',
    'Hematologia','Infectologia','Geriatria','Medicina Preventiva',
]

CID10_MAP = {
    'alto':  [
        ('E11','Diabetes mellitus tipo 2'),
        ('I10','Hipertensão essencial primária'),
        ('E78','Hipercolesterolemia'),
        ('I25','Doença isquêmica crônica do coração'),
        ('E66','Obesidade'),
        ('N18','Doença renal crônica'),
        ('J44','DPOC'),
        ('I50','Insuficiência cardíaca'),
        ('E87','Desequilíbrio eletrolítico'),
    ],
    'medio': [
        ('E11','Diabetes mellitus tipo 2'),
        ('I10','Hipertensão essencial primária'),
        ('E78','Hipercolesterolemia'),
        ('E66','Obesidade'),
        ('J45','Asma'),
        ('K21','Doença de refluxo gastroesofágico'),
        ('M79','Fibromialgia/dor crônica'),
        ('F32','Episódio depressivo'),
    ],
    'baixo': [
        ('Z00','Exame geral de rotina'),
        ('J06','Infecção aguda das vias aéreas superiores'),
        ('K29','Gastrite'),
        ('M54','Dorsalgia'),
        ('L23','Dermatite de contato'),
        ('H52','Transtornos da refração'),
        ('J30','Rinite alérgica'),
    ],
}

PROCEDIMENTOS = [
    ('Consulta médica ambulatorial','31.10.01.01-3',150),
    ('Eletrocardiograma','40.36.01.01-2',80),
    ('Ecocardiograma','40.36.08.03-5',420),
    ('Holter 24h','40.36.01.04-7',310),
    ('MAPA 24h','40.36.01.05-5',280),
    ('Radiografia de tórax','40.11.01.03-7',120),
    ('Tomografia de tórax','40.11.07.01-8',950),
    ('Ultrassonografia abdominal','40.11.11.02-1',340),
    ('Ressonância magnética','40.11.09.01-6',1400),
    ('Colonoscopia','40.21.07.01-8',1200),
    ('Endoscopia digestiva','40.21.05.01-5',800),
    ('Teste de esforço','40.36.01.06-3',420),
    ('Espirometria','40.24.01.01-7',220),
    ('Densitometria óssea','40.11.05.01-1',280),
    ('Mamografia','40.11.03.02-9',310),
    ('Fundoscopia','40.26.01.01-0',180),
    ('Glicemia de jejum','40.30.09.06-9',25),
    ('HbA1c','40.30.09.01-8',55),
    ('Lipidograma completo','40.30.11.01-6',65),
    ('Hemograma completo','40.30.01.01-0',35),
    ('PCR ultrassensível','40.30.15.01-4',80),
    ('TSH + T4 livre','40.30.18.01-0',90),
    ('Urina tipo I','40.30.31.01-9',30),
    ('Creatinina + Ureia','40.30.07.02-3',45),
    ('TGO + TGP','40.30.12.01-0',50),
    ('Ácido úrico','40.30.01.05-3',30),
    ('Insulina de jejum','40.30.09.11-5',75),
    ('Vitamina D','40.30.23.01-8',95),
    ('Microalbuminúria','40.30.31.07-8',75),
    ('Homocisteína','40.30.23.05-0',110),
]

# ─────────────────────────────────────────────────────────────────────────────
# HELPERS ESTATÍSTICOS
# ─────────────────────────────────────────────────────────────────────────────

def _gauss(rng: np.random.Generator, mean: float, std: float,
           lo: float = -1e9, hi: float = 1e9) -> float:
    val = rng.normal(mean, std)
    return float(np.clip(val, lo, hi))


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _lin_reg(vals: list[float]) -> float:
    n = len(vals)
    if n < 2:
        return 0.0
    mx = (n - 1) / 2
    my = sum(vals) / n
    num = sum((i - mx) * (v - my) for i, v in enumerate(vals))
    den = sum((i - mx) ** 2 for i in range(n))
    return round(num / den, 2) if den else 0.0


# ─────────────────────────────────────────────────────────────────────────────
# CÁLCULOS CLÍNICOS (espelham o data.ts)
# ─────────────────────────────────────────────────────────────────────────────

def calc_homa_ir(glucose: float, insulin: float) -> float:
    return round((glucose * insulin) / 405, 2)


def calc_framingham(age: int, sex: str, tc: float, hdl: float,
                    sbp: float, smoker: bool, diabetic: bool) -> int:
    if sex == 'M':
        pts = (
            -1 if age < 35 else 0 if age < 40 else 1 if age < 45 else
            2 if age < 50 else 3 if age < 55 else 4 if age < 60 else
            5 if age < 65 else 6 if age < 70 else 7
        )
        pts += -3 if tc < 160 else 0 if tc < 200 else 1 if tc < 240 else 2 if tc < 280 else 3
        pts += 2 if hdl < 35 else 1 if hdl < 45 else 0 if hdl < 50 else -1 if hdl < 60 else -2
        pts += -3 if sbp < 120 else 0 if sbp < 130 else 1 if sbp < 140 else 2 if sbp < 160 else 3
        if smoker: pts += 2
        if diabetic: pts += 2
        tbl = [1,2,2,3,4,4,6,7,9,11,14,18,22,27,33,40,47,56]
        return tbl[int(_clamp(pts + 3, 0, 17))]
    else:
        pts = (
            -9 if age < 35 else -4 if age < 40 else 0 if age < 45 else
            3 if age < 50 else 6 if age < 55 else 7 if age < 60 else 8
        )
        pts += -2 if tc < 160 else 0 if tc < 200 else 1 if tc < 240 else 2 if tc < 280 else 3
        pts += 5 if hdl < 35 else 2 if hdl < 45 else 1 if hdl < 50 else 0 if hdl < 60 else -2
        pts += -3 if sbp < 120 else 0 if sbp < 130 else 1 if sbp < 140 else 2 if sbp < 160 else 3
        if smoker: pts += 2
        if diabetic: pts += 4
        tbl = [1,2,2,3,3,4,5,6,7,8,9,11,13,15,17,20,24,27,32]
        return tbl[int(_clamp(pts + 2, 0, 18))]


def calc_composite(fram: int, homa: float, sbp: float,
                   altered: int, conf: float) -> float:
    f_n = _clamp(fram / 45, 0, 1)
    h_n = _clamp(homa / 5.5, 0, 1)
    b_n = _clamp((sbp - 110) / 70, 0, 1)
    m_n = altered / 7
    raw = 0.35 * f_n + 0.25 * h_n + 0.20 * b_n + 0.20 * m_n
    return round(_sigmoid(8 * (raw - 0.42)) * 100 * conf, 1)


def is_altered(key: str, val: float, sex: str) -> bool:
    limits = {
        'glucose': lambda v, s: v > 99,
        'insulin': lambda v, s: v > 25,
        'total_chol': lambda v, s: v >= 200,
        'ldl': lambda v, s: v >= 130,
        'hdl': lambda v, s: v < (50 if s == 'F' else 40),
        'triglycerides': lambda v, s: v >= 150,
        'sys_bp': lambda v, s: v >= 130,
    }
    fn = limits.get(key)
    return fn(val, sex) if fn else False


# ─────────────────────────────────────────────────────────────────────────────
# DATACLASSES
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class Patient:
    patient_id: str
    name: str
    age: int
    sex: str                        # M | F
    birth_date: str
    cpf: str
    cidade: str
    estado: str
    plano_nome: str
    plano_codigo: str
    mensalidade: float
    smoker: bool
    diabetic: bool
    medicated: bool
    prev_internacao: bool
    consultas_12m: int
    dias_ultimo_exame: int
    homa_ir: float
    framingham: int
    composite_score: float
    confidence: float
    risk_level: str                 # alto | medio | baixo
    altered_count: int
    trend_glucose: float
    trend_chol: float
    projected_cost: float


@dataclass
class LabExam:
    exam_id: str
    patient_id: str
    exam_date: str
    lab_code: str
    lab_name: str
    glucose: float
    insulin: float
    total_chol: float
    ldl: float
    hdl: float
    triglycerides: float
    sys_bp: float
    dia_bp: float
    homa_ir: float
    altered_markers: int
    # flags individuais
    flag_glucose: bool
    flag_insulin: bool
    flag_total_chol: bool
    flag_ldl: bool
    flag_hdl: bool
    flag_triglycerides: bool
    flag_sys_bp: bool


@dataclass
class Internacao:
    internacao_id: str
    patient_id: str
    data_entrada: str
    data_saida: str
    dias_internado: int
    hospital_codigo: str
    hospital_nome: str
    especialidade: str
    cid_principal: str
    descricao_cid: str
    custo_total: float
    tipo: str                       # eletiva | urgencia | emergencia


@dataclass
class Consulta:
    consulta_id: str
    patient_id: str
    data_consulta: str
    prestador_codigo: str
    prestador_nome: str
    tipo_prestador: str
    especialidade: str
    cid: str
    descricao_cid: str
    custo: float
    retorno: bool


@dataclass
class Sinistro:
    sinistro_id: str
    patient_id: str
    data_evento: str
    tipo_evento: str                # consulta | internacao | exame | procedimento
    evento_ref_id: str
    valor_total: float
    valor_reembolsado: float
    status: str                     # pago | pendente | negado


@dataclass
class Procedimento:
    proc_id: str
    consulta_id: str
    patient_id: str
    data: str
    codigo_tuss: str
    descricao: str
    custo_unitario: float
    quantidade: int
    custo_total: float


# ─────────────────────────────────────────────────────────────────────────────
# GERADOR PRINCIPAL
# ─────────────────────────────────────────────────────────────────────────────

class DatasetGenerator:

    def __init__(self, n_target_exams: int = 200_000, seed: int = 42,
                 ref_date: date = date(2026, 5, 25)):
        self.rng = np.random.default_rng(seed)
        self.py_rng = random.Random(seed)
        self.ref_date = ref_date
        self.n_target_exams = n_target_exams

        # Distribui pacientes: ~30% alto, ~40% médio, ~30% baixo
        self.n_patients = max(100, n_target_exams // 6)  # ~6 exames/paciente
        n_alto  = int(self.n_patients * 0.30)
        n_medio = int(self.n_patients * 0.40)
        n_baixo = self.n_patients - n_alto - n_medio
        self.tier_counts = {'alto': n_alto, 'medio': n_medio, 'baixo': n_baixo}

        # Contadores para IDs únicos
        self._exam_seq = 0
        self._intern_seq = 0
        self._consul_seq = 0
        self._sinistro_seq = 0
        self._proc_seq = 0

    # ── IDs ──────────────────────────────────────────────────────────────────

    def _next_exam_id(self) -> str:
        self._exam_seq += 1
        return f'EX{self._exam_seq:08d}'

    def _next_intern_id(self) -> str:
        self._intern_seq += 1
        return f'IN{self._intern_seq:07d}'

    def _next_consul_id(self) -> str:
        self._consul_seq += 1
        return f'CO{self._consul_seq:08d}'

    def _next_sinistro_id(self) -> str:
        self._sinistro_seq += 1
        return f'SI{self._sinistro_seq:09d}'

    def _next_proc_id(self) -> str:
        self._proc_seq += 1
        return f'PR{self._proc_seq:09d}'

    # ── Utilidades ───────────────────────────────────────────────────────────

    def _random_cpf(self) -> str:
        d = [self.py_rng.randint(0, 9) for _ in range(9)]
        s1 = sum((10 - i) * v for i, v in enumerate(d)) % 11
        d.append(0 if s1 < 2 else 11 - s1)
        s2 = sum((11 - i) * v for i, v in enumerate(d)) % 11
        d.append(0 if s2 < 2 else 11 - s2)
        return f'{"".join(map(str,d[:3]))}.{"".join(map(str,d[3:6]))}.{"".join(map(str,d[6:9]))}-{"".join(map(str,d[9:]))}'

    def _random_date_before(self, ref: date, max_days: int) -> date:
        delta = self.py_rng.randint(1, max_days)
        return ref - timedelta(days=delta)

    def _fmt(self, d: date) -> str:
        return d.isoformat()

    # ── Geração de paciente ──────────────────────────────────────────────────

    def _make_patient(self, pid: int, tier: str) -> tuple[Patient, dict]:
        sex = 'M' if self.rng.random() > 0.52 else 'F'
        age_means = {'alto': 58, 'medio': 47, 'baixo': 36}
        age = int(_clamp(_gauss(self.rng, age_means[tier], 9), 25, 75))

        smoker_p   = {'alto': 0.55, 'medio': 0.25, 'baixo': 0.08}[tier]
        diabetic_p = {'alto': 0.58, 'medio': 0.22, 'baixo': 0.04}[tier]
        smoker   = self.rng.random() < smoker_p
        diabetic = self.rng.random() < diabetic_p
        medicated = diabetic or (tier != 'baixo' and self.rng.random() < 0.50)
        prev_int  = self.rng.random() < {'alto': 0.48, 'medio': 0.12, 'baixo': 0.02}[tier]
        cons12m   = int(_clamp(_gauss(self.rng, {'alto': 7,'medio': 4,'baixo': 2}[tier], 2), 0, 15))
        dias_ult  = int(_clamp(_gauss(self.rng, {'alto': 48,'medio': 90,'baixo': 135}[tier], 30), 7, 180))

        birth_year = self.ref_date.year - age
        birth = date(birth_year, self.py_rng.randint(1, 12), self.py_rng.randint(1, 28))
        cidade, estado = self.py_rng.choice(CIDADES)
        plano = self.py_rng.choice(PLANOS)
        cpf = self._random_cpf()
        name_arr = NOMES_M if sex == 'M' else NOMES_F
        name = f"{self.py_rng.choice(name_arr)} {self.py_rng.choice(SOBRENOMES)}"

        # parâmetros laboratoriais por tier
        params = {
            'alto':  dict(gM=140,iM=22,tcM=248,ldlM=168,hdlM=33 if sex=='M' else 42,tgM=225,sysM=152,diaM=95,trend=1.6),
            'medio': dict(gM=106,iM=13,tcM=215,ldlM=138,hdlM=42 if sex=='M' else 51,tgM=158,sysM=134,diaM=84,trend=0.3),
            'baixo': dict(gM=88, iM=7, tcM=178,ldlM=105,hdlM=54 if sex=='M' else 62,tgM=105,sysM=116,diaM=74,trend=-0.2),
        }[tier]

        # exames mensais (últimos 6 meses → série temporal)
        exams_ts = []
        for m in range(5, -1, -1):
            o = (5 - m) * params['trend']
            exams_ts.append({
                'glucose':       round(_clamp(_gauss(self.rng, params['gM']   + o*0.8, 12), 60, 310)),
                'insulin':       round(_clamp(_gauss(self.rng, params['iM']   + o*0.4,  3),  1, 60), 1),
                'total_chol':    round(_clamp(_gauss(self.rng, params['tcM']  + o*0.5, 18), 100, 360)),
                'ldl':           round(_clamp(_gauss(self.rng, params['ldlM'] + o*0.4, 15),  40, 260)),
                'hdl':           round(_clamp(_gauss(self.rng, params['hdlM'] - o*0.15, 7),  15, 105)),
                'triglycerides': round(_clamp(_gauss(self.rng, params['tgM']  + o*0.6, 25),  40, 510)),
                'sys_bp':        round(_clamp(_gauss(self.rng, params['sysM'] + o*0.3, 10),  88, 225)),
                'dia_bp':        round(_clamp(_gauss(self.rng, params['diaM'] + o*0.2,  8),  55, 135)),
            })

        lat = exams_ts[-1]
        homa = calc_homa_ir(lat['glucose'], lat['insulin'])
        fram = calc_framingham(age, sex, lat['total_chol'], lat['hdl'], lat['sys_bp'], smoker, diabetic)
        flags = {k: is_altered(k, lat[k], sex)
                 for k in ('glucose','insulin','total_chol','ldl','hdl','triglycerides','sys_bp')}
        alt_count = sum(flags.values())
        conf = _clamp(0.55 + 0.07 * 6 + 0.04 * alt_count, 0.6, 0.97)
        composite = calc_composite(fram, homa, lat['sys_bp'], alt_count, conf)
        risk = 'alto' if composite >= 55 else 'medio' if composite >= 28 else 'baixo'
        trend_g = _lin_reg([e['glucose'] for e in exams_ts])
        trend_c = _lin_reg([e['total_chol'] for e in exams_ts])
        base_cost = {True: 68000, None: 28000, False: 7500}[
            composite >= 55 or None if composite >= 28 else False]
        proj_cost = round(_clamp(_gauss(self.rng, base_cost, base_cost * 0.22), 3000, 150000))

        p = Patient(
            patient_id    = f'P{pid:08d}',
            name          = name,
            age           = age,
            sex           = sex,
            birth_date    = self._fmt(birth),
            cpf           = cpf,
            cidade        = cidade,
            estado        = estado,
            plano_nome    = plano[0],
            plano_codigo  = plano[1],
            mensalidade   = plano[2],
            smoker        = smoker,
            diabetic      = diabetic,
            medicated     = medicated,
            prev_internacao = prev_int,
            consultas_12m = cons12m,
            dias_ultimo_exame = dias_ult,
            homa_ir       = homa,
            framingham    = fram,
            composite_score = composite,
            confidence    = round(conf, 3),
            risk_level    = risk,
            altered_count = alt_count,
            trend_glucose = trend_g,
            trend_chol    = trend_c,
            projected_cost = proj_cost,
        )
        return p, {'exams_ts': exams_ts, 'params': params, 'tier': tier,
                   'sex': sex, 'smoker': smoker, 'diabetic': diabetic, 'risk': risk}

    # ── Exames laboratoriais ─────────────────────────────────────────────────

    def _make_lab_exams(self, patient: Patient, meta: dict) -> list[LabExam]:
        exams_ts = meta['exams_ts']
        sex = meta['sex']
        out = []
        lab = self.py_rng.choice([p for p in PRESTADORES if p[2] == 'laboratorio'])
        for i, e in enumerate(exams_ts):
            exam_date = self.ref_date - timedelta(days=(5 - i) * 30 + self.py_rng.randint(-5, 5))
            flags = {k: is_altered(k, e[k], sex)
                     for k in ('glucose','insulin','total_chol','ldl','hdl','triglycerides','sys_bp')}
            out.append(LabExam(
                exam_id        = self._next_exam_id(),
                patient_id     = patient.patient_id,
                exam_date      = self._fmt(exam_date),
                lab_code       = lab[1],
                lab_name       = lab[0],
                glucose        = e['glucose'],
                insulin        = e['insulin'],
                total_chol     = e['total_chol'],
                ldl            = e['ldl'],
                hdl            = e['hdl'],
                triglycerides  = e['triglycerides'],
                sys_bp         = e['sys_bp'],
                dia_bp         = e['dia_bp'],
                homa_ir        = calc_homa_ir(e['glucose'], e['insulin']),
                altered_markers= sum(flags.values()),
                flag_glucose        = flags['glucose'],
                flag_insulin        = flags['insulin'],
                flag_total_chol     = flags['total_chol'],
                flag_ldl            = flags['ldl'],
                flag_hdl            = flags['hdl'],
                flag_triglycerides  = flags['triglycerides'],
                flag_sys_bp         = flags['sys_bp'],
            ))
        return out

    # ── Internações ──────────────────────────────────────────────────────────

    def _make_internacoes(self, patient: Patient, meta: dict) -> list[Internacao]:
        tier = meta['tier']
        risk = meta['risk']
        n_int_prob = {'alto': 0.55, 'medio': 0.18, 'baixo': 0.04}[tier]
        if self.rng.random() > n_int_prob:
            return []

        n = self.py_rng.choices([1, 2, 3], weights=[0.6, 0.3, 0.1])[0]
        hospitals = [p for p in PRESTADORES if p[2] == 'hospital']
        cids = CID10_MAP[risk]
        out = []
        for _ in range(n):
            cid_code, cid_desc = self.py_rng.choice(cids)
            hospital = self.py_rng.choice(hospitals)
            dias = self.py_rng.choices(range(1, 22),
                weights=[max(0.01, 1/(i+1)) for i in range(21)])[0]
            entrada = self._random_date_before(self.ref_date, 365)
            saida   = entrada + timedelta(days=dias)
            tipo    = self.py_rng.choices(
                ['eletiva','urgencia','emergencia'],
                weights=[0.5, 0.3, 0.2] if risk == 'alto' else [0.7, 0.25, 0.05]
            )[0]
            diaria  = self.py_rng.uniform(1200, 3500)
            custo   = round(diaria * dias + self.py_rng.uniform(500, 8000), 2)
            out.append(Internacao(
                internacao_id  = self._next_intern_id(),
                patient_id     = patient.patient_id,
                data_entrada   = self._fmt(entrada),
                data_saida     = self._fmt(saida),
                dias_internado = dias,
                hospital_codigo= hospital[1],
                hospital_nome  = hospital[0],
                especialidade  = self.py_rng.choice(ESPECIALIDADES),
                cid_principal  = cid_code,
                descricao_cid  = cid_desc,
                custo_total    = custo,
                tipo           = tipo,
            ))
        return out

    # ── Consultas ────────────────────────────────────────────────────────────

    def _make_consultas(self, patient: Patient, meta: dict) -> list[Consulta]:
        tier = meta['tier']
        risk = meta['risk']
        n = patient.consultas_12m
        cids = CID10_MAP[risk]
        prestadores_amb = [p for p in PRESTADORES if p[2] in ('clinica','hospital')]
        out = []
        for i in range(n):
            cid_code, cid_desc = self.py_rng.choice(cids)
            prest = self.py_rng.choice(prestadores_amb)
            data  = self._random_date_before(self.ref_date, 365)
            custo = round(self.py_rng.uniform(120, 450), 2)
            retorno = self.rng.random() < 0.35
            out.append(Consulta(
                consulta_id    = self._next_consul_id(),
                patient_id     = patient.patient_id,
                data_consulta  = self._fmt(data),
                prestador_codigo= prest[1],
                prestador_nome = prest[0],
                tipo_prestador = prest[2],
                especialidade  = self.py_rng.choice(ESPECIALIDADES),
                cid            = cid_code,
                descricao_cid  = cid_desc,
                custo          = custo,
                retorno        = retorno,
            ))
        return out

    # ── Procedimentos ────────────────────────────────────────────────────────

    def _make_procedimentos(self, consultas: list[Consulta],
                             patient: Patient, meta: dict) -> list[Procedimento]:
        tier = meta['tier']
        n_procs = {'alto': (2, 6), 'medio': (1, 4), 'baixo': (0, 2)}[tier]
        out = []
        for c in consultas:
            n = self.py_rng.randint(*n_procs)
            chosen = self.py_rng.sample(PROCEDIMENTOS, min(n, len(PROCEDIMENTOS)))
            for desc, tuss, base_cost in chosen:
                qty  = self.py_rng.choices([1, 2], weights=[0.9, 0.1])[0]
                cost = round(base_cost * self.py_rng.uniform(0.85, 1.20) * qty, 2)
                out.append(Procedimento(
                    proc_id       = self._next_proc_id(),
                    consulta_id   = c.consulta_id,
                    patient_id    = patient.patient_id,
                    data          = c.data_consulta,
                    codigo_tuss   = tuss,
                    descricao     = desc,
                    custo_unitario= round(base_cost * self.py_rng.uniform(0.85, 1.20), 2),
                    quantidade    = qty,
                    custo_total   = cost,
                ))
        return out

    # ── Sinistros ────────────────────────────────────────────────────────────

    def _make_sinistros(self, patient: Patient,
                         exams: list[LabExam],
                         internacoes: list[Internacao],
                         consultas: list[Consulta],
                         procedimentos: list[Procedimento]) -> list[Sinistro]:
        out = []
        status_w = [0.80, 0.15, 0.05]

        def _add(tipo, ref_id, data, valor):
            reimb = round(valor * self.py_rng.uniform(0.60, 0.95), 2)
            status = self.py_rng.choices(['pago','pendente','negado'], weights=status_w)[0]
            out.append(Sinistro(
                sinistro_id     = self._next_sinistro_id(),
                patient_id      = patient.patient_id,
                data_evento     = data,
                tipo_evento     = tipo,
                evento_ref_id   = ref_id,
                valor_total     = round(valor, 2),
                valor_reembolsado= reimb,
                status          = status,
            ))

        exam_custo = {'alto': 280, 'medio': 160, 'baixo': 80}
        tier = 'alto' if patient.composite_score >= 55 else 'medio' if patient.composite_score >= 28 else 'baixo'
        for e in exams:
            _add('exame', e.exam_id, e.exam_date, self.py_rng.uniform(exam_custo[tier]*0.7, exam_custo[tier]*1.4))
        for i in internacoes:
            _add('internacao', i.internacao_id, i.data_entrada, i.custo_total)
        for c in consultas:
            _add('consulta', c.consulta_id, c.data_consulta, c.custo)
        for p in procedimentos:
            _add('procedimento', p.proc_id, p.data, p.custo_total)
        return out

    # ── Orquestração ─────────────────────────────────────────────────────────

    def generate(self):
        patients, all_exams, all_intern, all_consul, all_proc, all_sinistros = [], [], [], [], [], []
        pid = 0

        tiers_flat: list[str] = []
        for tier, count in self.tier_counts.items():
            tiers_flat.extend([tier] * count)
        self.py_rng.shuffle(tiers_flat)

        iterator = enumerate(tiers_flat)
        if HAS_TQDM:
            from tqdm import tqdm as _tqdm
            iterator = _tqdm(enumerate(tiers_flat), total=len(tiers_flat),
                             desc='Gerando pacientes', unit='pac')

        for i, tier in iterator:
            pid += 1
            patient, meta = self._make_patient(pid, tier)
            exams     = self._make_lab_exams(patient, meta)
            internacoes = self._make_internacoes(patient, meta)
            consultas   = self._make_consultas(patient, meta)
            procs       = self._make_procedimentos(consultas, patient, meta)
            sinistros   = self._make_sinistros(patient, exams, internacoes, consultas, procs)

            patients.append(patient)
            all_exams.extend(exams)
            all_intern.extend(internacoes)
            all_consul.extend(consultas)
            all_proc.extend(procs)
            all_sinistros.extend(sinistros)

        return {
            'patients': patients,
            'exams': all_exams,
            'internacoes': all_intern,
            'consultas': all_consul,
            'procedimentos': all_proc,
            'sinistros': all_sinistros,
        }


# ─────────────────────────────────────────────────────────────────────────────
# EXPORTAÇÃO
# ─────────────────────────────────────────────────────────────────────────────

def write_csv(path: Path, rows: list, label: str):
    if not rows:
        print(f'  [aviso] {label}: nenhum registro')
        return
    with open(path, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=list(asdict(rows[0]).keys()))
        w.writeheader()
        for r in rows:
            w.writerow(asdict(r))
    print(f'  {label}: {len(rows):,} registros → {path}')


def write_jsonl(path: Path, rows: list, label: str):
    if not rows:
        return
    with open(path, 'w', encoding='utf-8') as f:
        for r in rows:
            f.write(json.dumps(asdict(r), ensure_ascii=False) + '\n')
    print(f'  {label} (JSONL): {len(rows):,} registros → {path}')


def print_summary(data: dict):
    total_sinistro = sum(s.valor_total for s in data['sinistros'])
    total_custo_int = sum(i.custo_total for i in data['internacoes'])
    print('\n══════════════════════════════════════════')
    print('  RESUMO DO DATASET GERADO')
    print('══════════════════════════════════════════')
    print(f"  Pacientes:       {len(data['patients']):>10,}")
    print(f"  Exames lab.:     {len(data['exams']):>10,}")
    print(f"  Internações:     {len(data['internacoes']):>10,}")
    print(f"  Consultas:       {len(data['consultas']):>10,}")
    print(f"  Procedimentos:   {len(data['procedimentos']):>10,}")
    print(f"  Sinistros:       {len(data['sinistros']):>10,}")
    print(f"  Custo internações: R$ {total_custo_int:>14,.2f}")
    print(f"  Total sinistros:   R$ {total_sinistro:>14,.2f}")

    by_risk = {'alto': 0, 'medio': 0, 'baixo': 0}
    for p in data['patients']:
        by_risk[p.risk_level] += 1
    print(f"\n  Distribuição de risco:")
    for k, v in by_risk.items():
        pct = v / len(data['patients']) * 100
        print(f"    {k:>6}: {v:>6,} ({pct:.1f}%)")
    print('══════════════════════════════════════════\n')


# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Gerador de dataset CarePlus')
    parser.add_argument('--exames', type=int, default=200_000,
                        help='Número alvo de exames laboratoriais (default: 200000)')
    parser.add_argument('--seed', type=int, default=42, help='Seed aleatória')
    parser.add_argument('--out', type=str, default='./data',
                        help='Diretório de saída (default: ./data)')
    parser.add_argument('--jsonl', action='store_true',
                        help='Exportar também em JSON-lines além do CSV')
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f'\nCarePlus Dataset Generator')
    print(f'  Alvo de exames : {args.exames:,}')
    print(f'  Seed           : {args.seed}')
    print(f'  Saída          : {out_dir.resolve()}\n')

    gen  = DatasetGenerator(n_target_exams=args.exames, seed=args.seed)
    data = gen.generate()

    print('\nExportando CSVs...')
    write_csv(out_dir / 'patients.csv',       data['patients'],      'patients')
    write_csv(out_dir / 'exams.csv',          data['exams'],         'exams')
    write_csv(out_dir / 'internacoes.csv',    data['internacoes'],   'internacoes')
    write_csv(out_dir / 'consultas.csv',      data['consultas'],     'consultas')
    write_csv(out_dir / 'procedimentos.csv',  data['procedimentos'], 'procedimentos')
    write_csv(out_dir / 'sinistros.csv',      data['sinistros'],     'sinistros')

    if args.jsonl:
        print('\nExportando JSON-lines...')
        write_jsonl(out_dir / 'patients.jsonl',      data['patients'],      'patients')
        write_jsonl(out_dir / 'exams.jsonl',         data['exams'],         'exams')
        write_jsonl(out_dir / 'internacoes.jsonl',   data['internacoes'],   'internacoes')
        write_jsonl(out_dir / 'consultas.jsonl',     data['consultas'],     'consultas')
        write_jsonl(out_dir / 'procedimentos.jsonl', data['procedimentos'], 'procedimentos')
        write_jsonl(out_dir / 'sinistros.jsonl',     data['sinistros'],     'sinistros')

    print_summary(data)


if __name__ == '__main__':
    main()
