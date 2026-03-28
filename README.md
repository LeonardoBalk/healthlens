# HealthLens

HealthLens é uma ferramenta web para visualização e exploração de dados de saúde pública. Faça upload de um dataset, obtenha estatísticas e gráficos interativos, e converse com seus dados usando inteligência artificial.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini-AI-4285F4?logo=google&logoColor=white)


## Sobre

O HealthLens recebe arquivos de dados de saúde (CSV, JSON, XLSX), processa com Pandas, gera visualizações interativas com Recharts e oferece um chat com IA (Google Gemini) para exploração dos dados em linguagem natural. Pensado para profissionais e gestores de saúde que precisam interpretar dados do DATASUS, e-SUS e SINAN sem conhecimento técnico em ciência de dados.

## Funcionalidades

- Upload de arquivos CSV, JSON e XLSX com drag and drop
- Estatísticas descritivas automáticas (média, mediana, desvio padrão, percentis)
- Gráficos interativos: séries temporais, histograma, scatter plot, box plot, barras
- Chat com IA para perguntas em linguagem natural sobre os dados
- Relatórios exportáveis em PDF
- Dark mode por padrão

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, Recharts |
| Backend | Express.js, TypeScript |
| Processamento | Python 3.11, FastAPI, Pandas |
| Banco de dados | Supabase (PostgreSQL) |
| IA | Google Gemini API |
| Deploy | Vercel (frontend), Railway (backend e processamento) |

## Rodando localmente

```bash
git clone https://github.com/seu-usuario/healthlens.git
cd healthlens
```

**Frontend:**
```bash
cd client
pnpm install
cp .env.example .env
pnpm dev
```

**Backend:**
```bash
cd server
pnpm install
cp .env.example .env
pnpm dev
```

**Processamento:**
```bash
cd processing
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

## Variáveis de ambiente

```env
# client/.env
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# server/.env
SUPABASE_URL=
SUPABASE_ANON_KEY=
PROCESSING_URL=http://localhost:8000
PORT=3001

# processing/.env
GEMINI_API_KEY=
```

## Autores

- **Leonardo Balk** — [github.com/leobalk](https://github.com/leonardobalk)
- **João Henrique Scherer Wolski** — [[github.com/joaowolski](https://github.com/joaohsw)]

Projeto de Software I — Sistemas de Informação, UFSM (2026/1)
