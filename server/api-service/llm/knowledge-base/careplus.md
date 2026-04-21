# CarePlus — Sistema de Triagem Inteligente

## O que é o CarePlus?

O CarePlus é um sistema de triagem hospitalar baseado no protocolo NEWS2 (National Early Warning Score 2).
Ele coleta sinais vitais do paciente por meio de um totem de autoatendimento e calcula automaticamente
o nível de risco clínico, auxiliando a equipe de saúde na priorização do atendimento.

---

## Como funciona a triagem?

1. O paciente se identifica no totem com CPF.
2. O sistema coleta os sinais vitais: frequência respiratória, frequência cardíaca, saturação de oxigênio (SpO2), temperatura e pressão arterial sistólica.
3. Também registra se o paciente usa oxigênio suplementar e se possui histórico de insuficiência respiratória hipercápnica.
4. O algoritmo NEWS2 calcula a pontuação total e classifica o risco.
5. O resultado é exibido ao paciente e enviado à equipe de saúde.

---

## Sinais Vitais Monitorados

| Sinal Vital                     | Unidade     | Intervalo Normal       |
|---------------------------------|-------------|------------------------|
| Frequência Respiratória (FR)    | irpm        | 12–20                  |
| Frequência Cardíaca (FC)        | bpm         | 51–90                  |
| Saturação de Oxigênio (SpO2)    | %           | ≥ 96                   |
| Temperatura                     | °C          | 36,1–38,0              |
| Pressão Arterial Sistólica (PA) | mmHg        | 111–219                |
| Oxigênio Suplementar            | Sim / Não   | —                      |

---

## Classificação de Risco NEWS2

| Pontuação Total | Classificação       | Conduta Recomendada                          |
|-----------------|---------------------|----------------------------------------------|
| 0               | Nenhum risco        | Monitoramento rotineiro                      |
| 1–4             | Baixo risco         | Reavaliar em 4–6 horas                       |
| 5–6             | Risco moderado      | Avaliação médica urgente (30–60 min)         |
| 7 ou mais       | Alto risco          | Avaliação médica emergencial imediata        |
| 3 em 1 parâmetro| Risco moderado/alto | Avaliação médica urgente                     |

---

## Pontuação por Parâmetro

### Frequência Respiratória
- 0 pontos: 12–20 irpm
- 1 ponto: 9–11 irpm
- 2 pontos: 21–24 irpm
- 3 pontos: ≤ 8 ou ≥ 25 irpm

### Pressão Arterial Sistólica
- 0 pontos: 111–219 mmHg
- 1 ponto: 101–110 mmHg
- 2 pontos: 91–100 mmHg
- 3 pontos: ≤ 90 ou ≥ 220 mmHg

### Frequência Cardíaca
- 0 pontos: 51–90 bpm
- 1 ponto: 41–50 ou 91–110 bpm
- 2 pontos: 111–130 bpm
- 3 pontos: ≤ 40 ou ≥ 131 bpm

### Temperatura
- 0 pontos: 36,1–38,0 °C
- 1 ponto: 35,1–36,0 ou 38,1–39,0 °C
- 2 pontos: ≥ 39,1 °C
- 3 pontos: ≤ 35,0 °C

### Saturação de Oxigênio (escala padrão)
- 0 pontos: ≥ 96%
- 1 ponto: 94–95%
- 2 pontos: 92–93%
- 3 pontos: ≤ 91%

### Uso de Oxigênio Suplementar
- 0 pontos: Não usa oxigênio
- 2 pontos: Usa oxigênio suplementar

---

## Dúvidas Frequentes dos Pacientes

### O que fazer se o resultado indicar alto risco?
Aguarde na sala de espera prioritária. Um profissional de saúde será notificado automaticamente e irá atendê-lo com urgência.

### Posso refazer a triagem?
Sim. Caso acredite que houve erro na medição, informe a recepção para que um profissional refaça a coleta.

### Os dados são armazenados com segurança?
Sim. Todos os dados são criptografados e armazenados em conformidade com a LGPD.

### O totem substitui a consulta médica?
Não. O CarePlus é uma ferramenta de triagem e auxílio à decisão clínica, não substitui a avaliação médica.

---

## Contato e Suporte

Em caso de falha no equipamento ou dúvidas técnicas, contate a equipe de TI hospitalar ou chame um atendente na recepção.
