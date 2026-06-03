## Ajustes no Heatmap

### 1. Remover filtro das 4 escalas (EOT, EEG, EIST, EDT)

Em `src/pages/Heatmap.tsx`, remover os botões de seções (atualmente: "Todos", "EOT", "EEG", "EIST", "EDT") e toda a lógica de `activeSection` / `getAvailableSections()` / renderização condicional por seção.

### 2. Adicionar filtro multi-seleção dos 10 fatores PROART

Os 10 fatores já existem em `src/lib/proartMethodology.ts` (`ALL_FACTORS`):

- **EOT**: Divisão das Tarefas (c1–c7), Divisão Social do Trabalho (c8–c19)
- **EEG**: Estilo Individualista (g1–g11, negativo), Estilo Coletivista (g12–g21, positivo)
- **EIST**: Falta de Sentido (v1–v9), Esgotamento Mental (v10–v17), Falta de Reconhecimento (v18–v28)
- **EDT**: Danos Psicológicos (s1–s7), Danos Sociais (s8–s14), Danos Físicos (s15–s23)

Adicionar um novo componente `FactorFilter` (ou reaproveitar o padrão visual de `MultiSelectCompanies`) que liste os 10 fatores agrupados visualmente pela escala de origem, permitindo selecionar um ou mais. Padrão inicial: todos selecionados.

### 3. Exibir o fator de cada pergunta na tabela

Em `src/components/dashboard/HeatmapTable.tsx`:

- Adicionar uma nova coluna **"Fator"** logo após a coluna "Pergunta" (também sticky à esquerda).
- Mapear cada `question.id` para o fator correspondente via `ALL_FACTORS` (criar helper `getFactorByQuestionId(id)`).
- Mostrar `factor.shortName` com badge sutil, e tooltip com o nome completo.
- Quando várias perguntas seguidas pertencerem ao mesmo fator, usar `rowSpan` para agrupar visualmente (ex.: c1–c7 mostra "Divisão das Tarefas" uma única vez com rowSpan=7).

### 4. Renderização da tabela única filtrada por fatores

Com fatores selecionados, montar a lista de perguntas exibidas pela união dos `questionIds` dos fatores escolhidos (ordenadas pelo `number` global). A tabela passa a ser única (não mais segmentada por seção).

### 5. Classificação de risco por fator (correção importante)

Hoje o heatmap usa `isNegativeSection` por seção inteira, o que está incorreto para EEG (mista: Individualista é negativa, Coletivista é positiva). A classificação passará a ser **por fator**, usando `factor.type` de `ALL_FACTORS`:

- **Fatores positivos** (Divisão das Tarefas, Divisão Social, Coletivista): ≥3,70 BAIXO 🟢 · 2,30–3,69 MÉDIO 🟡 · <2,30 ALTO 🔴
- **Fatores negativos** (Individualista, todos os EIST, todos os EDT): ≤2,29 BAIXO 🟢 · 2,30–3,69 MÉDIO 🟡 · ≥3,70 ALTO 🔴

Isso já está alinhado ao `classifyRisk()` em `proartMethodology.ts` — passaremos a usá-lo no heatmap em vez da função local `getRisk`, garantindo coerência entre Heatmap, PDF e demais telas.

A legenda do heatmap passa a mostrar as duas faixas (positivas e negativas) explicitamente, já que a tabela pode misturar fatores dos dois tipos.

### 6. Verificação dos cálculos PROART

A média por pergunta continua sendo média simples das respostas (escala Likert 1–5), arredondada a 2 casas — coerente com o método. As perguntas invertidas (`INVERTED_QUESTION_IDS`) já são tratadas no momento da ingestão das respostas (em `useSurveyData`), portanto o valor que chega ao heatmap já está orientado corretamente. Os limiares 1,00–2,29 / 2,30–3,69 / 3,70–5,00 são exatamente os definidos pelo manual PROART de Facas — confirmados.

### Arquivos a alterar

- `src/pages/Heatmap.tsx` — remover botões de seção, adicionar `FactorFilter`, simplificar renderização.
- `src/components/dashboard/HeatmapTable.tsx` — coluna "Fator" com rowSpan, classificação por fator, legenda dupla.
- `src/components/dashboard/FactorFilter.tsx` *(novo)* — multi-select agrupado por escala.
- `src/lib/proartMethodology.ts` — adicionar helper `getFactorByQuestionId(id)` (export utilitário).

Sem alterações em backend, RLS ou outras telas (Reports/PDF já usam `classifyRisk` corretamente).
