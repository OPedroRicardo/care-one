# Relatório — Lógica Digital Aplicada ao Projeto CarePlus

## 1. Apresentação do Projeto e Escopo

O **CarePlus Next** é um sistema de saúde composto por vários módulos: um totem IoT que coleta sinais vitais via dispositivos físicos, um orquestrador que gerencia a fila de atendimento via MQTT, um canal de comunicação assíncrona (Valkey), uma API REST que processa os dados e um painel web para os profissionais de saúde. Todos esses módulos se comunicam de forma paralela e independente, o que torna a modelagem booleana completa do sistema muito extensa para o escopo desta atividade.

Por isso, optamos por trabalhar apenas com o módulo de **cálculo do escore NEWS2**, que concentra decisões booleanas claras e isoladas — sem depender de rede, banco de dados ou outros serviços externos.

---

## 2. O Escore NEWS2

O NEWS2 é um algoritmo clínico que avalia o estado do paciente somando pontuações de seis sinais vitais (frequência respiratória, saturação de oxigênio, pressão arterial, frequência cardíaca, temperatura e uso de oxigênio suplementar). Cada sinal recebe de 0 a 3 pontos. O total determina o nível de risco.

Neste trabalho modelamos duas decisões booleanas do algoritmo:

1. **Qual tabela de SpO2 usar** — varia conforme o estado clínico do paciente
2. **Se deve pontuar o uso de oxigênio** — depende de o paciente usar oxigênio suplementar

> **Notação:** `*` = AND, `+` = OR, `'` = NOT. Exemplo: `H' * O` = "não tem hipercapnia E usa oxigênio".

---

## 3. Sistema 1 — Seleção da Tabela de SpO2

### 3.1 Objetivo

A saturação de oxigênio (SpO2) não pode ser avaliada da mesma forma para todos os pacientes. Pacientes com **hipercapnia** — condição em que há acúmulo de CO₂ no sangue — têm metas de SpO2 diferentes e precisam de uma tabela de referência específica, que ainda varia conforme o uso de oxigênio suplementar.

O sistema seleciona uma entre três tabelas:

| Tabela | Condição |
|--------|----------|
| Normal | Sem hipercapnia |
| Hipercápnica em ar | Com hipercapnia, sem oxigênio |
| Hipercápnica com O₂ | Com hipercapnia, com oxigênio |

### 3.2 Variáveis

| Letra | Significado | Vale 1 quando |
|-------|-------------|---------------|
| H | hipercapnia | Paciente tem hipercapnia |
| O | oxigenio | Paciente usa oxigênio suplementar |
| N | tabelaNormal | Tabela normal é selecionada |
| R | tabelaHipAr | Tabela hipercápnica em ar é selecionada |
| P | tabelaHipOxy | Tabela hipercápnica com O₂ é selecionada |

### 3.3 Expressão Original

Escrevendo todas as condições de forma explícita:

```
N_original = (H' * O') + (H' * O)
R_original = H * O'
P_original = H * O
```

A redundância está em **N_original**: os dois termos diferem apenas em O. Quando não há hipercapnia, o estado do oxigênio é irrelevante para essa decisão.

### 3.4 Simplificação

```
N_original = (H' * O') + (H' * O)
       = H' * (O' + O)      [Lei Distributiva]
       = H' * 1             [Lei do Complemento: O' + O = 1]
       = H'                 [Lei da Identidade: X * 1 = X]

∴  N_simplificado = H'
```

R e P já estão na forma mínima.

**Expressões simplificadas:**

```
N_simplificado = H'
R_simplificado = H * O'
P_simplificado = H * O
```

### 3.5 Mapa de Karnaugh — Saída N

```
         O=0    O=1
       ┌──────┬──────┐
  H=0  │  1   │  1   │
       ├──────┼──────┤
  H=1  │  0   │  0   │
       └──────┴──────┘
```

Os dois 1s formam um grupo na linha H=0. O varia dentro do grupo e é eliminado. Resultado: **N = H'** ✓

### 3.6 Tabela Verdade Comparativa

| H | O | N_original | R_original | P_original | N_simplificado | R_simplificado | P_simplificado |
|:-:|:-:|:------:|:------:|:------:|:-------:|:-------:|:-------:|
| 0 | 0 |   1    |   0    |   0    |    1    |    0    |    0    |
| 0 | 1 |   1    |   0    |   0    |    1    |    0    |    0    |
| 1 | 0 |   0    |   1    |   0    |    0    |    1    |    0    |
| 1 | 1 |   0    |   0    |   1    |    0    |    0    |    1    |

### 3.7 Equivalência

As colunas original e simplificada são idênticas nas 4 linhas:

```
N_original(H, O) = N_simplificado(H, O)  para todo (H, O) ∈ {0,1}²   ✓
```

---

## 4. Sistema 2 — Pontuação por Uso de Oxigênio

### 4.1 Objetivo

O NEWS2 adiciona 2 pontos ao escore quando o paciente está usando oxigênio suplementar. Essa regra é independente de qualquer outro sinal vital — inclusive de hipercapnia. Um desenvolvedor desatento poderia escrever a condição considerando também o estado de hipercapnia, gerando uma expressão redundante.

### 4.2 Variáveis

| Letra | Significado | Vale 1 quando |
|-------|-------------|---------------|
| O | usaOxigenio | Paciente usa oxigênio suplementar |
| H | hipercapnia | Paciente tem hipercapnia |
| A | adicionarPontos | Pontuação de oxigênio é somada ao total |

### 4.3 Expressão Original

```
A_original = (O * H) + (O * H')
```

### 4.4 Simplificação

```
A_original = (O * H) + (O * H')
       = O * (H + H')      [Lei Distributiva]
       = O * 1             [Lei do Complemento: H + H' = 1]
       = O                 [Lei da Identidade: X * 1 = X]

∴  A_simplificado = O
```

### 4.5 Mapa de Karnaugh — Saída A

```
         H=0    H=1
       ┌──────┬──────┐
  O=0  │  0   │  0   │
       ├──────┼──────┤
  O=1  │  1   │  1   │
       └──────┴──────┘
```

Os dois 1s formam um grupo na linha O=1. H é eliminado. Resultado: **A = O** ✓

### 4.6 Tabela Verdade Comparativa

| O | H | A_original | A_simplificado |
|:-:|:-:|:------:|:-------:|
| 0 | 0 |   0    |    0    |
| 0 | 1 |   0    |    0    |
| 1 | 0 |   1    |    1    |
| 1 | 1 |   1    |    1    |

### 4.7 Equivalência

```
A_original(O, H) = A_simplificado(O, H)  para todo (O, H) ∈ {0,1}²   ✓
```

---

## 5. Resumo

| Sistema | Original | Simplificada | Variável eliminada | Leis usadas |
|---------|----------|:------------:|:------------------:|-------------|
| Tabela SpO2 (N) | `(H'*O') + (H'*O)` | `H'` | O | Distributiva, Complemento, Identidade |
| Pontuação O₂ (A) | `(O*H) + (O*H')` | `O` | H | Distributiva, Complemento, Identidade |

---

## 6. Conclusão

Os dois sistemas demonstram o mesmo padrão de simplificação: quando uma variável aparece nos dois lados de uma disjunção — tanto em sua forma normal quanto negada — ela pode ser eliminada completamente. Em ambos os casos, as tabelas verdade confirmam que as expressões originais e simplificadas produzem saídas idênticas em todos os cenários possíveis, provando a equivalência lógica. Simplificar não muda o comportamento — apenas torna a lógica mais direta.
