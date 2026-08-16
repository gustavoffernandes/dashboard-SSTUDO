# Adicionar metodologia COPSOQ II-Br ao sistema

Hoje o sistema é 100% PROART: 91 questões, 4 escalas, 10 fatores, escala Likert 1-5 e faixas de risco fixas. O objetivo é manter tudo isso funcionando e adicionar o COPSOQ II-Br (versão curta) como segunda metodologia, escolhida por empresa.

## Como a metodologia é definida

- No cadastro da empresa/filial passa a existir o campo **Metodologia**: PROART (padrão) ou COPSOQ II-Br.
- Ao criar um formulário, a metodologia vem automaticamente da empresa e fica **travada** (exibida como selo, não editável).
- Empresas já cadastradas continuam como PROART, sem qualquer mudança de comportamento.
- Trocar a metodologia de uma empresa que já tem respostas fica bloqueado, com aviso explicando o motivo (as respostas antigas não são comparáveis).

## O questionário COPSOQ II-Br

40 questões em 23 dimensões, agrupadas em 7 domínios:

```text
Demandas no trabalho ......... Demandas quantitativas, Ritmo, Demandas emocionais
Organização e conteúdo ....... Influência, Possibilidade de desenvolvimento,
                               Significado, Comprometimento
Relações interpessoais ....... Previsibilidade, Reconhecimento, Clareza do papel,
                               Qualidade da liderança, Suporte social
Interface trabalho-indivíduo . Satisfação no trabalho, Conflitos trabalho-família
Valores do local de trabalho . Confiança na gestão, Justiça
Saúde e bem-estar ............ Saúde geral, Burnout, Estresse
Comportamentos ofensivos ..... Atenção sexual indesejada, Ameaças de violência,
                               Violência física, Bullying
```

O formulário público muda conforme a metodologia:
- Escala de resposta 0-4 com rótulos diferentes por bloco de questões (sempre/nunca, em grande parte/muito pouco, muito satisfeito/muito insatisfeito, excelente/ruim, sim com certeza/não).
- A questão 1B tem pontuação invertida.
- As questões 20-23 usam resposta de frequência (diariamente até não) e, quando positivas, abrem a seleção de quem pratica o comportamento (colegas, gerente, subordinados, clientes).
- Navegação por domínio, barra de progresso, revisão final e todas as etapas demográficas continuam iguais.

## Cálculo e classificação

Cada dimensão é a **soma** dos seus itens, com faixas próprias definidas no artigo. Exemplos:

| Dimensão | Pontuação | Seguro | Atenção | Risco |
|---|---|---|---|---|
| Demandas quantitativas | 0-8 | 0-3 | 4 | 5-8 |
| Ritmo de trabalho | 0-8 | 0-3 | 4-5 | 6-8 |
| Influência no trabalho | 0-8 | 5-8 | 4 | 0-3 |
| Clareza do papel | 0-8 | 6-8 | 4-5 | 0-3 |
| Satisfação no trabalho | 0-3 | 2-3 | — | 0-1 |
| Conflitos trabalho-família | 0-6 | 0-2 | 3 | 4-6 |
| Saúde geral | 0-4 | 3-4 | 2 | 0-1 |
| Burnout / Estresse | 0-8 | 0-2 | 3 | 4-8 |

Cada uma das 19 dimensões pontuáveis tem sua faixa própria cadastrada. Cores em semáforo: seguro verde, atenção amarelo, risco vermelho. Comportamentos ofensivos não recebem classificação.

## O que muda em cada tela

**Heatmap** — quando a empresa é COPSOQ, o filtro de escalas passa a listar os 7 domínios e o filtro de fatores lista as 23 dimensões. A célula mostra a **pontuação média da dimensão** (ex.: 5,2 de 8) com a cor da faixa correspondente. Colunas por setor como já é hoje.

**Relatórios PDF** — a matriz hierárquica passa a ser Domínio > Dimensão > Setor, com a pontuação média e o rótulo seguro/atenção/risco. A legenda de classificação é substituída pela do COPSOQ.

**Planos de ação** — a matriz P×S continua, alimentada pelas dimensões COPSOQ: exposição vem das dimensões de demandas e saúde (burnout, estresse), controle vem de influência, previsibilidade, suporte e liderança, gravidade vem de saúde geral e burnout. Os níveis PR1-PR4 e prazos permanecem idênticos. Um banco de ações sugeridas específico para as dimensões COPSOQ será criado, no mesmo formato atual (título, por quê, como).

**Comportamentos ofensivos** — painel próprio na análise, com contagem e frequência de cada tipo e o percentual por autor do comportamento, sem classificação de risco e com texto orientando sobre acolhimento e canais de denúncia.

**Análise, Respondentes, Evolução temporal, Comparação entre empresas** — passam a ler a metodologia do formulário e renderizar os domínios/dimensões corretos. A comparação entre empresas só permite comparar formulários da mesma metodologia.

## Detalhes técnicos

- Migração: coluna `methodology` em `google_forms_config` (texto, padrão `proart`), aplicada tanto ao registro placeholder da empresa quanto aos formulários.
- Novos arquivos `src/lib/copsoqQuestions.ts` (40 itens, blocos de resposta, inversão do 1B) e `src/lib/copsoqMethodology.ts` (domínios, dimensões, faixas por dimensão, classificação, P×S, ações sugeridas).
- Novo `src/lib/methodology.ts` como camada de resolução: recebe a metodologia do formulário e devolve escalas/fatores/questões/classificador, para que Heatmap, Reports, pdfExport, SurveyAnalysis e ActionPlans não façam import direto do PROART.
- `useSurveyData.ts` passa a expor `methodology` por config e por empresa.
- `PublicSurvey.tsx` monta os passos a partir da metodologia resolvida; respostas continuam gravadas em `survey_responses.answers` com os ids das questões COPSOQ.
- Nenhuma alteração no comportamento atual de formulários PROART existentes.
