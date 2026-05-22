# PROATIVA — Plataforma de Diagnóstico Organizacional em SST

Plataforma SaaS para diagnóstico de **Saúde e Segurança do Trabalho (SST)** baseada na metodologia **PROART**.  
Permite que empresas apliquem pesquisas (via Google Forms ou link público), visualizem indicadores em dashboards, comparem unidades/filiais, gerem planos de ação e exportem relatórios.

**Stack:** React 18 · Vite 5 · TypeScript · Tailwind CSS · shadcn/ui · Recharts · Supabase (Auth, Postgres com RLS, Edge Functions).

---

## 📋 Pré-requisitos

| Ferramenta | Windows | Mac/Linux |
|---|---|---|
| **Node.js** 18+ | [Instalador LTS](https://nodejs.org/) | `brew install node` |
| **Git** | [Git for Windows](https://git-scm.com/download/win) | `brew install git` |

---

## 🚀 Instalação

```bash
git clone <URL_DO_REPOSITORIO>
cd proativa-dashboard
npm install
npm run dev
```

Acesse: **http://localhost:8080/**

### Variáveis de ambiente

As credenciais públicas do Supabase já estão configuradas no arquivo `.env` (chaves anon/publishable — seguras para o front).  
Segredos do backend (`GOOGLE_SHEETS_API_KEY`, `RESEND_API_KEY`, etc.) ficam no painel do Supabase em **Edge Functions → Secrets**.

---

## 🔑 Funcionalidades

### Dashboards e análise
| Página | Descrição |
|---|---|
| **Dashboard** | Visão geral com KPIs, gráficos por fator de risco e métricas consolidadas |
| **Análise da Pesquisa** | Análise pergunta a pergunta com gráficos interativos |
| **Heatmap** | Mapa de calor por fator (Contexto, Vivências, Saúde, Práticas) ou **TODOS** os fatores, com filtro por **setor** e classificação de risco (Bom / Moderado / Ruim) |
| **Comparativo** | Comparação entre empresas e filiais cadastradas |
| **Evolução Temporal** | Comparação histórica entre formulários do mesmo título |
| **Demografia** | Distribuição demográfica dos respondentes |
| **Respostas Livres** | Visualização de respostas abertas/discursivas |

### Gestão
| Página | Descrição |
|---|---|
| **Empresas** | Cadastro de empresas e filiais (cada filial é tratada como empresa independente, identificada por nome + cidade) |
| **Formulários** | Cadastro de formulários (Google Sheets ou link público) |
| **Respondentes** | Lista de sessões e respostas individuais |
| **Planos de Ação** | Criação e acompanhamento de tarefas vinculadas a formulários |
| **Anotações** | Notas e observações por empresa |
| **Relatórios** | Exportação PDF/CSV com filtro por **setor**, coluna de **risco** colorida (verde/amarelo/vermelho) |
| **Usuários** | Gestão de usuários e papéis (admin) |
| **Assinatura** | Gerenciamento do plano contratado |

---

## 👥 Papéis de Usuário

| Papel | Acesso |
|---|---|
| **user** | Visualiza dashboards, cria planos de ação e anotações da sua conta |
| **company_user** | Acesso restrito da empresa (com anonimização de dados pessoais) |
| **admin** | Tudo do `user` + gestão de empresas, formulários, respondentes, usuários e integrações da sua família/conta |
| **super_admin** (GOD) | Acesso global a todos os dados de todas as contas. Não precisa de plano nem assinatura. Criado manualmente |

> Papéis são armazenados na tabela `user_roles` (nunca em `profiles`) e protegidos por RLS via a função `has_role()`.

### Criando o usuário GOD (super_admin)

1. **Supabase → Authentication → Users → Add user** (marque *auto-confirm*).
2. Execute no SQL Editor:
   ```sql
   INSERT INTO public.user_roles (user_id, role, parent_admin_id, company_id)
   VALUES ('<UUID_DO_USUARIO>', 'super_admin', NULL, NULL);
   ```

Não é necessário criar `subscription` nem `system_account` para esse usuário.

---

## 📊 Coleta de Respostas

A plataforma suporta **duas formas** de coletar respostas:

### Opção A — Link público (`/pesquisa/:slug`)
O respondente acessa o link, preenche o formulário diretamente na plataforma e a resposta é salva no banco. Não exige Google Sheets.

### Opção B — Google Forms + Google Sheets
1. Crie o formulário no [Google Forms](https://docs.google.com/forms) e vincule a uma planilha de respostas.
2. Compartilhe a planilha como **Qualquer pessoa com o link → Leitor**.
3. Copie o **ID da planilha** da URL (`/spreadsheets/d/<ID>/edit`) e o **nome exato da aba**.
4. No app, vá em **Formulários → Nova Integração**, preencha empresa, ID, aba e (opcional) URL.
5. Clique em **Sincronizar**. Existe ainda a edge function `auto-sync` para sincronização periódica.

**Colunas reconhecidas automaticamente:** Nome, Idade, Sexo/Gênero, Setor. As demais colunas são tratadas como perguntas (escala Likert 1–5).

> ⚠️ A sincronização **substitui** as respostas anteriores daquela integração (não é incremental).

---

## 📂 Estrutura do Projeto

```
src/
├── components/        Componentes reutilizáveis (UI, gráficos, layout)
├── pages/             Páginas (rotas em src/App.tsx)
├── hooks/             Hooks (useSurveyData, useActionPlans, usePlans, ...)
├── contexts/          AuthContext
├── integrations/      Cliente Supabase + tipagens geradas
├── lib/               Utilitários (pdfExport, proartMethodology, ...)
└── data/              Mock data para desenvolvimento

supabase/
├── migrations/        Schema SQL versionado (RLS, funções, triggers)
└── functions/         Edge Functions
    ├── sync-google-sheets/   Importa respostas da planilha
    ├── auto-sync/            Sincronização automática agendada
    └── create-user/          Criação de usuários por admin
```

---

## 🧪 Scripts

```bash
npm run dev          # ambiente de desenvolvimento (porta 8080)
npm run build        # build de produção
npm run preview      # serve o build localmente
npm run lint         # ESLint
npm run test         # vitest (run único)
npm run test:watch   # vitest em watch
```

---

## 🆘 Troubleshooting

| Problema | Solução |
|---|---|
| Tela em branco | Confirme que `npm run dev` está rodando sem erros |
| Porta 8080 ocupada | **Win:** `netstat -ano \| findstr :8080` → `taskkill /PID <PID> /F` · **Mac/Linux:** `lsof -i :8080` → `kill -9 <PID>` |
| "Failed to fetch" ao sincronizar | Verifique `GOOGLE_SHEETS_API_KEY` nos segredos do Supabase |
| "Erro ao acessar Google Sheets" | Planilha precisa estar pública (link → Leitor) e o ID correto |
| "Nenhuma resposta encontrada" | Confira o nome exato da aba e se existem respostas na planilha |
| Dashboard vazio | Selecione a empresa/formulário no filtro após sincronizar |
| Usuário não vê dados de outra conta | Comportamento esperado — apenas `super_admin` enxerga tudo |

---

## 📄 Licença

© 2026 PROATIVA. Todos os direitos reservados.
