# Guia de Documentação — Care One

> Use este arquivo como briefing para qualquer ferramenta de design, geração ou automação.
> Ele descreve **o que documentar**, **para quem** e **como estruturar** — não é a documentação final.

---

## Contexto do projeto

**Care One** é uma plataforma de medicina preventiva orientada a dados, desenvolvida como PoC acadêmica na FIAP (1CCPR, Grupo 1) em parceria com a Care Plus / Bupa.

O projeto resolve dois problemas concretos da operadora:
1. O app Blua é reativo — o beneficiário só interage quando já está doente
2. A operadora não enxerga risco no portfólio antes de eventos caros acontecerem

**Stack:** NestJS · Next.js · MySQL · Claude API (RAG + function calling)

**Materiais existentes no repositório:**
- README (instruções de execução)
- Pitch deck (slides)
- Landing page (HTML)
- Dashboard React (analytics de portfólio)
- Notebook Python (chatbot RAG)
- Diagramas de arquitetura
- Vídeo demo

---

## Públicos e o que cada um precisa

| Público | Pergunta central | Tom | Profundidade |
|---|---|---|---|
| Banca / mentores FIAP | O projeto cumpre os critérios? | Acadêmico, preciso | Alta — mostrar decisões técnicas |
| Diretoria Care Plus | Vale investir? | Executivo, direto | Baixa — números e próximos passos |
| Clientes / investidores | Qual o problema resolvido? | Comercial, narrativo | Média — problema → solução → impacto |
| Time técnico | Como funciona e como contribuir? | Técnico, objetivo | Alta — arquitetura, APIs, contratos |

A documentação final deve funcionar para todos ao mesmo tempo, com navegação que permita cada perfil encontrar o que precisa sem ler o todo.

---

## Estrutura da documentação

### 1. Visão geral do produto (`overview`)

O que é, para quem é, qual o problema que resolve. Deve ser compreensível por qualquer pessoa em menos de 2 minutos.

**Conteúdo obrigatório:**
- Nome, tagline e contexto (Care Plus / FIAP)
- O problema em uma frase: sinistralidade gerada por falta de prevenção
- A solução em dois pilares (check-up conversacional + dashboard analítico)
- Status atual: PoC funcional com dados simulados

**Dica de redação:** escreva o parágrafo de visão geral como se fosse para o LinkedIn da Care Plus publicar. Sem jargão técnico, sem siglas não explicadas.

---

### 2. Pilares da solução (`solution`)

Dois produtos dentro do ecossistema Care One. Cada um merece seção própria.

#### 2a. BluaDiagnostics — Check-up Digital
- **O que faz:** chatbot clínico conversacional integrado ao Blua
- **Como funciona:** RAG sobre base de conhecimento clínico + system prompt com guardrails + function calling para histórico/agendamento
- **Persona:** beneficiário em autoavaliação
- **Diferencial:** detecta red flags e encaminha antes do evento agudo

#### 2b. Dashboard Preventivo
- **O que faz:** estratifica risco do portfólio de beneficiários
- **Como funciona:** scores clínicos calculados (Framingham, HOMA-IR, eGFR) sobre exames já existentes
- **Persona:** operador clínico e médico care
- **Diferencial:** projeção de ROI em sinistralidade evitável + curva de Pareto

**Para cada pilar, documentar:**
- Fluxo do usuário (do ponto de entrada até a saída de valor)
- Screenshot ou link para demo
- Decisões de design relevantes (ex: por que reutilizar exames existentes em vez de pedir novos)

---

### 3. Arquitetura técnica (`architecture`)

Para o time técnico e para a banca FIAP avaliar profundidade.

**O que incluir:**

```
Camadas do sistema:
- Frontend: Next.js App + Dashboard React + Chatbot UI
- API: NestJS REST — módulos: patients, exams, risk-scoring, chat, knowledge-base
- AI: Claude API → RAG Engine → Function Calling → (LangGraph opcional)
- Data: MySQL + Vector Store + Knowledge Base
- Analytics: Score Engine (Framingham, HOMA-IR, eGFR) com pesos adaptativos
```

**Diagramas a incluir:**
- Diagrama de camadas (já existe no repo — referenciar)
- Fluxo do chatbot: entrada → RAG → guardrail → resposta → log
- Fluxo de scoring: exame recebido → score calculado → estratificação → alerta

**Decisões técnicas a documentar:**
- Por que Claude API e não GPT-4 (justificar com critérios: latência, custo, qualidade clínica)
- Por que exames existentes como fonte primária (elimina fricção de adoção)
- Por que scores clínicos validados e não ML proprietário (auditabilidade + sem dados reais na PoC)

---

### 4. Scores clínicos (`clinical-scoring`)

Seção crítica para credibilidade médica. Detalhar as três fórmulas implementadas:

| Score | O que mede | Threshold de risco | Fonte |
|---|---|---|---|
| Framingham | Risco cardiovascular em 10 anos | > 20% = alto risco | AHA / ACC |
| HOMA-IR | Resistência à insulina | > 2.5 = resistência | Literatura clínica |
| eGFR (CKD-EPI) | Função renal | < 60 ml/min = comprometido | KDIGO 2021 |

**Documentar também:**
- Como o sistema lida com exames ausentes (pesos adaptativos + indicador de confiança)
- Quais combinações de exames ativam cada score
- Limitação explícita: scores são triagem, não diagnóstico

---

### 5. RAG e base de conhecimento (`knowledge-base`)

| Documento | Tipo | Papel no sistema | Status na PoC |
|---|---|---|---|
| Protocolo Manchester | Clínico | Classificação de urgência | Simulado |
| Políticas Care Plus | Regulatório | Guardrails de cobertura | Simulado |
| Bulas / interações medicamentosas | Farmacologia | Validação pré-prescrição | Simulado |
| Diretrizes AHA/ESC | Diretriz clínica | Base para Framingham | Incluído |
| Cartilha preventiva Care Plus | Institucional | Tom de voz ao beneficiário | A incluir |

**O que documentar além da lista:**
- Estratégia de chunking (como os docs foram segmentados)
- Modelo de embedding utilizado
- Como o sistema decide quando buscar no RAG vs responder diretamente

---

### 6. API Reference (`api`)

Documentação mínima dos endpoints para devs e integradores.

**Formato sugerido para cada endpoint:**
```
MÉTODO  /rota
Descrição em uma linha
Parâmetros: (se houver)
Resposta: estrutura JSON simplificada
```

**Endpoints core a documentar:**
- `GET /patients` — lista com scores
- `GET /patients/:id/risk` — detalhe de risco por paciente
- `POST /chat/session` — inicia sessão com system prompt clínico
- `POST /chat/message` — envia mensagem com contexto injetado
- `GET /exams/:patientId` — exames com status de validade
- `GET /analytics/portfolio` — distribuição de risco + ROI
- `POST /knowledge/search` — busca semântica na base RAG

---

### 7. Segurança, ética e compliance (`safety`)

Seção obrigatória para qualquer documentação de produto de saúde com IA.

**Riscos a mapear e como foram tratados:**

| Risco | Mitigação implementada | Status |
|---|---|---|
| Alucinação clínica | RAG restrito + disclaimer em toda resposta + HITL | Mitigado |
| LGPD | Dados anonimizados na PoC, pseudonimização planejada | Mitigado na PoC |
| Responsabilidade clínica | IA sugere, médico aprova — nunca prescreve sozinha | Mitigado |
| Viés algorítmico | Scores baseados em equações validadas, não ML proprietário | Monitorar |
| Escalabilidade da PoC | Dados simulados — validação real é fase seguinte | Escopo definido |

**Princípio a deixar explícito em todas as visões:** a IA é uma ferramenta de apoio à decisão médica, com humano no loop em todos os pontos críticos.

---

### 8. Impacto e ROI (`impact`)

Para a visão comercial e executiva.

**Números a apresentar:**
- 15% de redução potencial de sinistralidade com prevenção ativa (referência de literatura)
- Custo incremental de coleta: zero (reutiliza exames existentes)
- 80+ pacientes analisados na PoC com scoring clínico funcional
- 3 scores clínicos validados por literatura

**Estrutura narrativa do ROI:**
1. Identificar os 20% do portfólio que geram 80% do custo (Pareto)
2. Quantificar o custo médio por evento evitável (hospitalização, complicação)
3. Estimar o percentual de eventos interceptáveis com intervenção precoce
4. Calcular ROI por beneficiário ativo na plataforma

**Deixar claro:** os números da PoC são projeções baseadas em literatura. Validação com dados reais Care Plus é o próximo passo.

---

### 9. Roadmap (`roadmap`)

| Fase | Prazo estimado | Marco |
|---|---|---|
| Fase 0 | Concluído | PoC funcional com dados simulados |
| Fase 1 | 0–3 meses | Piloto interno com dados reais anonimizados + validação clínica |
| Fase 2 | 3–6 meses | Piloto com grupo restrito de beneficiários no Blua |
| Fase 3 | 6–12 meses | Rollout + vertical de medicina ocupacional (NR-1) |

**A expansão para medicina ocupacional** foi sugerida diretamente pelos mentores Juliana Hungaro Fidelis e Renato Rossi na reunião de feedback. Documentar como oportunidade endossada pela própria Care Plus, não apenas como ideia interna.

---

### 10. Contexto acadêmico (`academic`) — incluir apenas no README e na versão FIAP

Mapeamento de entregas por disciplina:

| Disciplina | Entregável | Sprints |
|---|---|---|
| PAI — Prompt & IA | Chatbot RAG + function calling (notebook Python) | 1–4 |
| Modelagem Matemática | Regressão clínica, sistemas lineares | 2–3 |
| Machine Learning | Regressão logística, sklearn, AUC-ROC, F1 | 3 |
| Python Automação | Pipeline de dados, CodeCarbon | 2–3 |
| Estrutura de Dados (C) | Fila de pacientes, pilha com undo, visualizador ANSI | 3–4 |
| Energia / IoT | Cálculo de emissões CO₂, ESP32 | 4 |

---

## Formatos de saída sugeridos

| Formato | Uso | Ferramentas sugeridas |
|---|---|---|
| `README.md` expandido | GitHub — entrada técnica e acadêmica | Este guia + conteúdo do repo |
| Página web interativa | Apresentação universal com visões por público | Claude / v0 / Cursor com este guia como briefing |
| Pitch deck atualizado | Banca FIAP + diretoria Care Plus | Figma / PowerPoint com seções 1, 2, 8 e 9 |
| `TECHNICAL.md` | Referência técnica standalone | Seções 3, 4, 5 e 6 deste guia |
| `SAFETY.md` | Compliance e ética — obrigatório para produto de saúde | Seção 7 deste guia |

---

## Instruções para usar este guia como briefing

Quando for gerar qualquer output de documentação (página, deck, README, vídeo):

1. **Informe o público-alvo** da peça específica — o tom muda drasticamente
2. **Referencie os materiais existentes** (pitch deck, dashboard, notebook, diagrama) como fonte de verdade para detalhes
3. **Não invente números** — use apenas os da seção de impacto, marcando como projeção
4. **Mantenha o disclaimer clínico** em qualquer peça que descreva as capacidades do chatbot
5. **A estética é livre**, mas o produto é de saúde — seriedade e clareza prevalecem sobre criatividade excessiva

---

*Gerado como briefing de documentação — Care One · CCPR Grupo 1 · FIAP 2025*
