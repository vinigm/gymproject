# Hábitos · Vini & Vivi — Processo de criação

> Documento contando a história de como o projeto foi construído, em ordem
> cronológica das decisões, com a arquitetura final, como manter o site e
> como fazer mudanças. Pra contexto técnico de setup (Firebase, GitHub
> Pages, instalação no iPhone), ver [README.md](./README.md).

---

## 1. O ponto de partida

A ideia foi do Vini: criar um app pra registrar hábitos saudáveis (academia,
corrida, água, alimentação, etc.) com ele e a Vivi. Sem app nativo iOS, a
estratégia foi um **site web instalável como PWA**, que vira ícone no
celular e funciona praticamente igual a um app.

### Decisões iniciais (e o porquê)

| Decisão                                        | Por quê                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| **HTML + CSS + JS puro, sem build**            | Funciona direto no GitHub Pages, zero npm install, manutenção simples                |
| **Firebase Firestore** pra dados               | Sincroniza entre celulares (essencial pra os dois usarem do mesmo lugar)             |
| **PWA com manifest + service worker**          | Vira ícone na home do iPhone, abre tela cheia, parece app nativo                     |
| **GitHub Pages pra hospedar**                  | Grátis, simples, integrado ao repositório, atualiza em ~1 min após push              |
| **Mobile-first, dark theme**                   | Caso de uso é registro rápido pelo celular durante o dia                             |

---

## 2. v1 — Esqueleto funcional

A primeira versão (commit `eb72834`) já saiu com:

- Tela de **seleção de perfil** (Vinicius / Vivi)
- **Tracker diário** com chips (exercícios, hidratação, almoço/janta)
- **3 views**: Hoje, Stats, Calendário (com tab bar inferior)
- Camada de storage com **fallback automático** pra `localStorage` quando o
  Firebase ainda não tava configurado
- **Service worker** registrado, app instalável

Estrutura modular já desde o início:
- `index.html` — shell do SPA
- `js/storage.js` — abstração Firestore ↔ localStorage
- `js/app.js` — controle de views e perfil
- `js/tracker.js` — registro do dia
- `js/stats.js` — estatísticas
- `js/calendar.js` — calendário mensal
- `js/firebase-config.js` — placeholders pras chaves

### Deploy inicial (a saga do PAT)

- Repositório criado em <https://github.com/vinigm/gymproject>
- Primeira tentativa de push falhou: PAT (Personal Access Token) com escopo
  errado (`repo:status` em vez de `repo` completo)
- Segundo PAT criado com o escopo certo → push funcionou
- Repo precisou virar **público** pra liberar GitHub Pages no plano grátis
- Firebase Auth domain `vinigm.github.io` adicionado nos Authorized Domains
- Regras do Firestore configuradas pra aceitar só docs no formato
  `vinicius_YYYY-MM-DD` ou `victoria_YYYY-MM-DD`

---

## 3. v2 — Layout single-page

O Vini pediu pra deixar tudo numa página só, "ambos os usuários ao mesmo
tempo". O refactor:

- Removida a tela de seleção de perfil + a tab bar inferior
- Página única com **3 seções verticais**: Hoje, Estatísticas, Calendário
- "Hoje" virou **2 colunas lado a lado** (Vini azul · Vivi rosa)
- Salvamento **independente por pessoa** (clicar em chip do Vini não
  dispara save da Vivi, e vice-versa)
- Cada coluna ganhou borda colorida no topo pra identificar de quem é

---

## 4. Refinamento das estatísticas

Várias melhorias de UI/UX nas stats:

- **Modalidades** com 0 registros foram filtradas (não mostra Yoga com 0)
- **Alimentação** virou um *half-donut* (gauge semi-circular) mostrando %
  de refeições limpas vs sujas, com total no centro
- Adicionada **média de água por dia** do mês como KPI
- Mudei a estrutura do Resumo pra ficar mais escaneável

Detalhe técnico: o donut é **SVG inline puro** com `stroke-dasharray` +
`pathLength="100"` — o dasharray vira literalmente "percent" e fica trivial
de animar.

---

## 5. Mais features pedidas

A lista foi crescendo conforme o app era usado. Adicionei nessa ordem:

### Cigarros (escala 0-6)

Novo chip group abaixo de Janta. 7 botões (0, 1, ..., 6), 0 em verde e 5-6
em vermelho. Persiste como string `"0"` a `"6"` ou null.

### Histórico do mês (grid)

Visualização "tipo Excel" com **dias verticais** × **categorias horizontais**.
Cada célula colorida com label textual (Sim, Não, Limpo, Sujo, 1L, etc.) ou
❌ se não foi registrado. Layout 2 colunas (Vini/Vivi lado a lado).

### Botão Salvar explícito + edição de dias anteriores

Antes era auto-save com debounce. Vini pediu controle. Mudou pra:
- Clicar chips só atualiza estado local
- Botão "Salvar (N alterações)" no fim da seção
- **Date picker** nativo no topo permite escolher qualquer dia ≥ APP_START_DATE
- Calendário virou clicável → "editar este dia" → vai pra date picker

### Sobremesa Sim/Não + 0,5L de água

Novos chips. Sobremesa "Não" (+pts) / "Sim" (penalidade). Água 0,5L
adicionado ao grid 2×2.

### Badge de pontos na topbar

Pillzinha com gradient mostrando total de pontos do casal direto na home.

### APP_START_DATE

Constante única em `js/app.js` que controla a partir de quando o app
considera dados. Originalmente 17/05, depois 18/05. Tudo propaga
automaticamente (stats, histórico, calendário, date picker, badge).

---

## 6. Refatoração visual: Resumo + Detalhamento

### Resumo vertical (6 KPIs empilhados)

Antes era grid 2×2. Virou stack vertical com 6 linhas:
1. Dias com exercício no período
2. Dias de exercício em sequência (streak)
3. Média de água por dia · mês
4. Refeições limpas no período
5. Cigarros fumados no período
6. Dias sem fumar em sequência

### Streaks com semântica `satisfied / broken / skip`

Helper genérico `streakBackwards(byDate, statusFn)`:

| Hábito       | satisfied         | broken             | skip                |
| ------------ | ----------------- | ------------------ | ------------------- |
| Exercício    | ≥1 marcado        | (nunca)            | sem registro / 0    |
| Sem fumar    | cigs = 0          | cigs ≥ 1           | sem registro        |

**Tratamento especial pro dia de hoje**: se for "skip" (ainda não logou
hoje), pula hoje e começa do dia anterior — não zera streak só porque
ainda não marcou hoje. Se for "broken" (fumou), zera mesmo.

### Detalhamento por pessoa, por dia

Lista todos os dias com registros (mais recente primeiro), agrupados por
pessoa, com:
- Cabeçalho `18/05/2026 - Segunda Feira` (capitalizado)
- Linhas verde/vermelho com `+15` / `-30`
- Subtotal do dia
- Total da pessoa no fim
- Card "somado" embaixo das 2 colunas com total combinado
- Seletor de período (semana / mês / total)

---

## 7. Gamificação — sistema de pontos

A camada de pontos foi construída em iterações:

### Engine compartilhado

`js/points-engine.js` exporta `pointsForDay(day)` — calcula pontos a partir
dos chips do dia + tabela `POINTS`. **Crítico**: pontos são calculados em
runtime, não armazenados. Trocar valores na config recalcula tudo
historicamente.

### Página de pontos (`points.html`)

Mostra:
- Totais por período (semana / mês / total)
- Detalhamento por pessoa, por dia
- Calendário dinâmico (mais sobre isso abaixo)

### Recordes

`/recordes.html` (depois movido pra página própria) com:
- 3 banners no topo com gradient da pessoa que detém: **recorde de dia /
  semana / mês**
- Grid 2×2 com 6 cards (Vini × 3 períodos + Vivi × 3 períodos)
- Cada card mostra pts, data/intervalo, e as linhas que compuseram

### Placares

`/placares.html` com 3 cards (dias / semanas / meses), cada um contando
quantos buckets cada pessoa ganhou em comparação com o outro:
- "Vini ganhando por 3 dias" + placar "Vini 5 × 2 Vivi"
- Cor do top border = quem lidera
- Empate / sem dados ficam em cinza

### Modelo de carteira (transações no Firestore)

Quando o Vini começou a pensar em prêmios com preços altos (massagem 6500,
viagem 12000), ficou claro que o modelo "barra de progresso por período"
não fazia sentido. Mudou pra **carteira de moeda**:

- Nova coleção Firestore: `transactions`
- Cada doc: `{ scope, item, price, note, created_at }`
- Scope: `"shared"` (casal) ou `"personal-victoria"` (Vivi pessoal)
- Saldo = pontos ganhos − soma de prices das transações daquele scope

Implementado primeiro só pra Vivi pessoal (`victoria.html`), depois
expandido pro casal (`casal.html`).

---

## 8. Páginas separadas

À medida que o conteúdo crescia, splitting fez sentido:

| Página                 | Conteúdo                                                            |
| ---------------------- | ------------------------------------------------------------------- |
| `index.html`           | Tracker diário (Hoje + Stats + Histórico + Calendário simples)      |
| `points.html`          | Totais + Detalhamento + Calendário dinâmico                          |
| `recordes.html`        | Banners de recordes + grid de 6 cards                                |
| `placares.html`        | 3 placares Vini vs Vivi                                              |
| `casal.html`           | Carteira do casal + loja compartilhada + histórico                  |
| `victoria.html`        | Carteira pessoal da Vivi + loja pessoal dela + histórico            |
| `config.html`          | Editor de pontuação + criar hábitos novos + gerenciar recompensas   |

### Calendário dinâmico em `points.html`

Última grande feature antes do polishing:
- Grid mensal com cada célula mostrando dia + pts Vini (azul) + pts Vivi (rosa)
- Fundo verde tênue se dia positivo, vermelho se negativo
- **Clicar num dia** → detalhamento acima vira detalhamento daquele único dia
- Botão "voltar pro período" no card combinado

### Página de configuração

`/config.html` é onde mora a magia da customização sem código:
- Edita pontos de qualquer hábito (defaults vs override)
- Adiciona/remove hábitos novos em "Outros hábitos"
- Edita preços de prêmios e cria novos (compartilhada ou pessoal Vivi)
- Botão "Restaurar padrão" pra apagar todos os overrides

Os overrides ficam em `config/points` no Firestore (um único doc).
Defaults vivem no código (`js/points-config.js` → `DEFAULT_POINTS`,
`DEFAULT_EXTRAS_META`, `DEFAULT_REWARDS`, `DEFAULT_REWARDS_VICTORIA`).
Runtime tem versões mutáveis (`POINTS`, `EXTRAS_META`, `REWARDS`,
`REWARDS_VICTORIA`) que são populadas em todo page load.

---

## 9. Autenticação (Google Sign-In)

A versão inicial era totalmente pública. Qualquer um com o link podia
escrever. A solução:

- **Firebase Auth** com provider Google habilitado
- **Whitelist de emails** em `js/auth.js`:
  `["vinigm@gmail.com", "victoria.cerutti@gmail.com"]`
- **Regras do Firestore** exigem auth + email autorizado pra ler/escrever
- Tela de login full-screen como overlay (`#auth-gate`) com botão "Entrar
  com Google"
- Após login: cache de UID em `localStorage` pra esconder a tela
  rapidamente em navegações
- Inline `<script>` no `<head>` que adiciona `html.auth-hidden` antes
  mesmo do body renderizar → **zero flash** entre páginas

Fluxo de login:
1. Tenta `signInWithPopup` primeiro (UX melhor)
2. Se popup for bloqueado → fallback pra `signInWithRedirect`
3. iOS PWA standalone: popup abre como in-app browser sheet (funciona)

---

## 10. Polishing final

### Menu compacto em todas as páginas

`js/nav-menu.js` exporta `mountNavMenu()`. Cada página tem
`<nav id="nav-menu"></nav>` e chama no bootstrap. Detecta página atual via
`window.location.pathname` e destaca o item.

7 items: Hábitos · Pontos · Prêmios · Recordes · Placares · Vivi · Config.

### Spinner global em vez de "carregando..."

Cada página começa com `<body class="is-loading">`. CSS esconde `.page`
e mostra um spinner centralizado via `body::after`. Bootstrap de cada
página remove `is-loading` no fim do init (em `finally`), fazendo o
conteúdo aparecer fade-in.

### Barra de progresso nos cards de recompensa

Cards mostram bar visual com `pct = balance / price`. Quando atinge 100%,
borda fica verde e botão "Comprar" habilita.

### Renomeação Victoria → Vivi

Mudança apenas em **labels visíveis** (UI). Mantive os identificadores
internos (`userId: "victoria"`, document IDs, `personal-victoria` scope,
classes CSS, email) pra não invalidar os dados antigos no Firestore.

---

## 11. Arquitetura final

### Camadas

```
┌─────────────────────────────────────────────────────┐
│                    HTML pages (7)                    │
│  index · points · recordes · placares · casal ·     │
│  victoria · config                                   │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│                Page bootstraps (JS)                  │
│  app.js · points-page · records-page · placares-    │
│  page · casal-page · victoria-page · config-page    │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│               Shared modules (JS)                    │
│  • points-config.js  ← defaults + runtime           │
│  • points-engine.js  ← pointsForDay()               │
│  • points-utils.js   ← helpers (breakdown, períodos)│
│  • storage.js        ← Firestore + transactions     │
│  • auth.js           ← gate + whitelist             │
│  • nav-menu.js       ← menu compartilhado           │
│  • tracker.js        ← chips do tracker             │
│  • stats / history / calendar.js  ← seções          │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│           Firebase (via firebase-config.js)          │
│  • Firestore: days/, transactions/, config/points    │
│  • Auth: Google provider + whitelist nas Rules       │
└─────────────────────────────────────────────────────┘
```

### Modelo de dados

**Coleção `days`** — registros diários:
```js
days/{userId}_{YYYY-MM-DD} = {
  userId, date,
  exercises: ["academia", "corrida", ...],
  run_km: 2.5 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | null,
  extras: ["marmita", "leitura", ...],
  water: "0.5L" | "1L" | "1.5L" | "2L" | "2.5L" | "3L" | "3.5L" | "4L" | "4.5L" | "5L" | null,
  lunch: "limpo" | "sujo" | null,
  dinner: "limpo" | "sujo" | null,
  cigarettes: "0" .. "6" | null,
  dessert: "sim" | "nao" | null,
  soda: "sim" | "nao" | null,
  updatedAt: serverTimestamp()
}
```

**Coleção `transactions`** — resgates de prêmios:
```js
transactions/{auto-id} = {
  scope: "shared" | "personal-victoria",
  item, price, note,
  created_at: serverTimestamp()
}
```

**Coleção `config`** — overrides editáveis pela UI:
```js
config/points = {
  exercises?: { academia: 50, ... },
  water?: { "1L": 10, ... },
  meals?: { lunch: {...}, dinner: {...} },
  cigarettes?: -15,
  dessert?: { sim: 0, nao: 50 },
  soda?: { sim: -10, nao: 70 },
  extras?: { marmita: 80, ... },
  extras_custom?: [{ key, label, icon, points, custom: true }],
  rewards_shared?: [{ name, price, ... }],
  rewards_victoria?: [{ name, price, ... }]
}
```

Só os campos **diferentes do default** vão pro Firestore. Defaults vivem
no código, override só com o diff. Restaurar = apagar o doc.

### Regras do Firestore (atual)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /days/{docId} {
      allow read, write: if
        request.auth != null
        && request.auth.token.email in ['vinigm@gmail.com', 'victoria.cerutti@gmail.com']
        && docId.matches("^(vinicius|victoria)_\\d{4}-\\d{2}-\\d{2}$");
    }
    match /transactions/{anyId} {
      allow read, write: if
        request.auth != null
        && request.auth.token.email in ['vinigm@gmail.com', 'victoria.cerutti@gmail.com'];
    }
    match /config/{anyId} {
      allow read, write: if
        request.auth != null
        && request.auth.token.email in ['vinigm@gmail.com', 'victoria.cerutti@gmail.com'];
    }
  }
}
```

---

## 12. Sequência completa de commits (highlights)

| Commit                                                                                 | O que tinha                                |
| -------------------------------------------------------------------------------------- | ------------------------------------------ |
| `habitos v1: registro diário, stats, calendário e PWA`                                 | Esqueleto inicial                          |
| `habitos v2: layout single-page com 2 colunas (Vini│Vic)`                              | Tirou perfil/tabs                          |
| `feat: tracker de cigarros fumados (escala 0-6)`                                       | Cigarros                                   |
| `feat: histórico do mês em grid`                                                       | Grid mensal                                |
| `feat: salvar explícito + edição de dias anteriores via date picker`                   | Botão Salvar + date input                  |
| `fix: getRange por ID direto (evita query travada com as regras)`                      | Bug crítico Firestore                      |
| `feat: 0,5L de água + sobremesa sim/não + badge de pontos na main`                     | Mais hábitos + topbar                      |
| `feat: detalhamento agrupado por dia com data + subtotal`                              | Detalhamento granular                      |
| `feat: gamificação — página de pontos + prêmios configuráveis`                         | Sistema de pontos                          |
| `feat: seção Recordes + Placares`                                                      | Comparações entre Vini/Vivi                |
| `feat: páginas separadas (recordes/placares/vic) + menu + carteira pessoal Vic`        | Split de pages                             |
| `feat: autenticação com Google (whitelist Vini + Vic)`                                  | Auth                                       |
| `feat: criar novos hábitos + recompensas pela página de config`                        | Editor de config completo                  |
| `feat: menu de navegação compacto em todas as páginas`                                 | Nav-menu                                   |
| `feat: página de Prêmios do casal com carteira compartilhada e loja`                   | Carteira do casal                          |
| `feat: barra de progresso nos cards de recompensa`                                      | Visual de progresso                        |
| `feat: calendário dinâmico na página de pontos`                                        | Click → detalhamento                       |
| `fix: zero flash da tela de login` + `fix: esconder página até dados carregarem`       | Polishing final                            |
| `chore: trocar 'Victoria/Vic' por 'Vivi'`                                              | Renomeação                                 |

---

## 13. Como manter / fazer mudanças

### Para adicionar um novo hábito (multi-select como Marmita):
- Opção 1 (rápida): editar `DEFAULT_EXTRAS_META` em `js/points-config.js`
- Opção 2 (sem código): clicar "Criar novo hábito" em `/config.html`

### Para mudar valores de pontos:
- Direto em `/config.html` (recomendado)
- Ou editar `DEFAULT_POINTS` em `js/points-config.js` (afeta novos
  ambientes; quem já tem override no Firestore vê o override)

### Para adicionar um novo prêmio:
- Opção 1 (sem código): "Criar nova recompensa" em `/config.html`
- Opção 2 (código): editar `DEFAULT_REWARDS` ou
  `DEFAULT_REWARDS_VICTORIA` em `js/points-config.js`

### Para adicionar uma nova página:
1. Cria `nova.html` (copia estrutura de uma existente)
2. Cria `js/nova-page.js` com `setupAuthGate({ onAuthorized: ... })`
3. Adiciona item em `NAV_ITEMS` em `js/nav-menu.js`
4. Push → aparece em todo lugar

### Para mover a data de início:
- Editar `APP_START_DATE` em `js/app.js` (uma única linha)

### Para adicionar/remover usuário autorizado:
- Editar `AUTHORIZED_EMAILS` em `js/auth.js`
- Atualizar a array nas Rules do Firestore (console)

### Pra fazer push de mudanças:
- `git add` → `git commit` → `git push origin main`
- GitHub Pages atualiza em ~1 minuto

### Service worker:
- Network-first strategy: sempre puxa a versão mais recente quando online
- Cache só serve quando offline
- Nenhum drama de "preso na versão antiga" como tinha antes

---

## 14. O que poderia evoluir depois

Algumas ideias que ficaram no ar:

- **Sync em tempo real** (onSnapshot) — hoje carrega só ao abrir a página
- **Página pessoal do Vini** (`vinicius.html`) com scope `"personal-vinicius"`
- **Limites de frequência** nas compras (ex: "pizza só 1x por semana")
- **Exportar/importar dados** em JSON
- **Notificações push** lembrando de registrar
- **Mais hábitos integrados ao Apple Health** (passos, sono, etc.)
- **Modo offline mais robusto** com fila de saves
- **Backup automático** do Firestore (function que exporta diário)

---

## 15. Lições do processo

- **Calcular em runtime, não armazenar** — mudar tabela de pontos
  recalcula histórico inteiro sem migração de dados
- **Defaults no código, overrides no banco** — mantém código como source
  of truth E permite customização sem deploy
- **Document IDs com formato controlado** (`vinicius_YYYY-MM-DD`) — facilita
  rules e queries por range sem composite index
- **Single page bootstrap por página** — cada `.html` carrega seu próprio
  `*-page.js`, com helpers compartilhados via `points-utils.js`
- **Auth com whitelist + rules em camadas** — proteção real, não obscuridade
- **Inline `<script>` no `<head>` pra zero FOUC** — esconder UI antes do
  body renderizar é a única forma de evitar flash em PWA
- **Network-first SW** — pra app de duas pessoas que sempre atualizam,
  cache-first vira pesadelo de "porque tá com a versão velha"

---

*Construído por Vini com a ajuda do Claude, entre 18 e 19 de maio de 2026.*
