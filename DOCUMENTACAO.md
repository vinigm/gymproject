# Documentação — Hábitos · Vini & Vivi

Projeto pessoal de um casal (Vinicius e Victoria) para registrar e gamificar hábitos do dia a dia. É um PWA de página única por seção, sem framework nem build: HTML, CSS e JavaScript puro (ES modules) servidos estáticos. Os dados vivem no Firebase Firestore (com login Google restrito aos dois) e, quando o Firebase não está configurado, tudo cai automaticamente para o `localStorage` do próprio navegador. Além do registro de hábitos, o app calcula pontos, tem uma lojinha de prêmios com carteira, placares Vini x Vivi, recordes, estatísticas, ferramentas de foco (Pomodoro e Alongamento guiado), um painel de presença/foco para tablet e o acompanhamento de peso e dieta dos dois.

## Stack & arquitetura

- **Front-end puro, sem build**: HTML + CSS + JavaScript, servidos como arquivos estáticos. Não há bundler, transpiler nem passo de compilação.
- **ES modules**: todo o JavaScript é organizado em módulos (`import`/`export`) carregados diretamente pelo navegador a partir de `js/`.
- **Firebase Firestore + Google Auth**: SDK do Firebase 10.12.2 importado via CDN da gstatic (`firebase-config.js`). Autenticação por conta Google restrita a dois e-mails; dados persistidos no Firestore do projeto `gymproject-12fff`.
- **Modo local (fallback)**: quando o Firebase não está configurado, a flag `isConfigured` desliga o Firestore e cada módulo de storage grava/lê do `localStorage` (chaves prefixadas com `habitos-`). O mesmo código de página funciona nos dois modos de forma transparente.
- **PWA offline-tolerante**: `manifest.webmanifest` torna o app instalável (standalone, portrait) e o `service-worker.js` usa estratégia network-first com fallback ao cache quando offline.
- **Hospedagem**: GitHub Pages a partir da branch `main`.

Camadas principais:

- **Shell/boot/auth** (`index.html`, `js/app.js`, `js/auth.js`, `js/nav-menu.js`, `js/firebase-config.js`).
- **Storage** (`js/storage.js` e os storages especializados: `presence-storage.js`, `weight-storage.js`, `diet-storage.js`, `pomodoro-storage.js`, `stretch-storage.js`).
- **Motor de pontos** (`js/points-config.js`, `js/points-engine.js`, `js/points-utils.js`).
- **Páginas** (`js/*-page.js` + `*.html`).
- **Design system** (`css/style.css`, arquivo único).

## Como rodar e publicar

Consulte o `README.md` (189 linhas) para o passo a passo detalhado de setup e deploy. Resumo:

### Rodar localmente

O app é estático, então basta servi-lo por HTTP. A configuração de preview do projeto está em `.claude/launch.json` sob o nome **`habitos-static`**, servindo na porta **5173**. Manualmente, qualquer servidor estático resolve:

```
python3 -m http.server 5173
# ou
npx serve
```

Abrir `http://localhost:5173`. Sem chaves do Firebase preenchidas, o app roda em **modo local** (`localStorage`) — dá para testar tudo sem back-end.

### Configurar o Firebase (opcional para uso local, necessário para sincronizar)

1. Criar/abrir um projeto Firebase e colar as chaves em `js/firebase-config.js`.
2. Criar o Firestore.
3. Publicar as regras (ver seção "Regras do Firestore").

### Publicar

Publicação via **GitHub Pages a partir da branch `main`**. Ao dar push na `main`, o site atualiza. Lembre que, para invalidar caches antigos do Service Worker após um deploy, é preciso incrementar manualmente o nome do cache (ver PWA).

### Instalar como PWA

No iPhone/Android, abrir o site no navegador e usar "Adicionar à tela de início". O `manifest.webmanifest` (standalone, portrait) e as meta tags iOS no `<head>` dão o comportamento de app instalado.

## Estrutura de arquivos

### Páginas HTML (raiz)

| Arquivo | Papel |
| --- | --- |
| `index.html` | Página principal: registro de hábitos do dia (chips) dos dois usuários + histórico do mês; também hospeda a casca comum (auth-gate, topbar, nav) e registra o Service Worker |
| `points.html` | Página Pontos: totais por período, detalhamento por pessoa/dia e calendário diário |
| `casal.html` | Prêmios/loja do casal (carteira conjunta, `scope` "shared") |
| `victoria.html` | Loja pessoal da Vivi (carteira `scope` "personal-victoria") |
| `placares.html` | Comparação Vini x Vivi por dias/semanas/meses |
| `recordes.html` | Melhor dia/semana/mês de cada um + banner do recordista geral |
| `stats.html` | Estatísticas por pessoa (gráficos, sequências, resumos) |
| `alongamento.html` | Ferramenta de alongamento guiado (timer com auto-avanço) |
| `pomodoro.html` | Timer Pomodoro (foco/pausas) com estatísticas por usuário |
| `presence.html` | Status/presença (painel de foco Pomodoro para tablet, tempo real) |
| `kg-vini.html` | Peso + plano alimentar estruturado do Vini, com kcal/macros e estatísticas semanais |
| `kg-vivi.html` | Peso + dieta da Vivi (registro, gráfico, IMC, alimentos) |
| `config.html` | Configuração da tabela de pontos/prêmios (persistida em `config/points`) |

### JavaScript (`js/`)

| Arquivo | Papel |
| --- | --- |
| `app.js` | Boot da página principal, constantes globais (`USERS`, `APP_START_DATE`), navegação de data, render dos chips de extras |
| `auth.js` | Portão de autenticação (`setupAuthGate`), login Google, whitelist de e-mails, cache otimista de auth |
| `nav-menu.js` | Menu de navegação compartilhado (`NAV_ITEMS`, `mountNavMenu`), item ativo e `--stack-top` |
| `firebase-config.js` | Inicialização condicional do Firebase; exporta `db`, `auth`, `isConfigured` e helpers do Firestore |
| `tracker.js` | Lógica dos cards de hábitos: carga, edição, dirty-check, salvamento em lote |
| `tracker-model.js` | Regras puras do tracker: normalização, toggle dos grupos e opções válidas de distância da corrida |
| `storage.js` | Camada de dados de `days`, `transactions` e `config` (Firestore x localStorage) |
| `history.js` | Histórico do mês corrente na página principal (grid de 6 hábitos) |
| `points-config.js` | Tabela de pontos (`POINTS`), prêmios (`REWARDS`/`REWARDS_VICTORIA`), extras, datas de início e funções de override/reset |
| `water-options.js` | Fonte compartilhada das opções de hidratação (0,5–5 L), formatação, conversão e pontos padrão |
| `points-engine.js` | `pointsForDay(day)`: único ponto de cálculo dos pontos de um dia |
| `points-utils.js` | Helpers puros: `loadAndApplyConfig`, breakdown, agregações, recordes, totais |
| `tracking-cycle.js` | Ciclo de acompanhamento e filtros de escopo (`Ciclo atual` x `Histórico completo`) sem apagar dados; no Kg Vini também monta o acesso à `Dieta Oficial` |
| `points-page.js` | Página Pontos |
| `casal-page.js` | Loja do casal |
| `victoria-page.js` | Loja pessoal da Vivi |
| `placares-page.js` | Placares |
| `records-page.js` | Recordes |
| `stats-page.js` | Estatísticas (ativa) |
| `config-page.js` | Página de configuração da gamificação |
| `pomodoro-page.js` | Página do Pomodoro |
| `pomodoro-storage.js` | Storage de `pomodoro_sessions` e `pomodoro_config` |
| `alongamento-page.js` | Página de alongamento guiado (sessões hardcoded em `SESSIONS`) |
| `stretch-storage.js` | Storage de `stretch_sessions` |
| `presence-page.js` | Página de status/presença (ciclo Pomodoro, Wake Lock, fullscreen) |
| `presence-storage.js` | Storage de `presence` (tempo real via `onSnapshot`) |
| `kg-vivi-page.js` | Implementação compartilhada das páginas de peso + dieta de Vini e Vivi |
| `kg-vini-page.js` | Entrada do Kg Vini; reutiliza a implementação compartilhada |
| `vini-diet-plan.js` | Catálogo versionado do plano do Vini, valores nutricionais e cálculos puros |
| `vini-diet-ui.js` | Checklist do plano do Vini, hidratação, histórico e estatísticas diárias/semanais/ciclo |
| `weight-storage.js` | Storage de `weight_logs` + altura/seed em localStorage |
| `diet-storage.js` | Storage de `diet_logs`, incluindo o mapa legado `foods` e o plano estruturado `plan` |
| `stats.js` | **Código morto/legado** — não importado por nenhum HTML |
| `calendar.js` | **Código morto/legado** — não importado por nenhum HTML |

### Outros

| Arquivo | Papel |
| --- | --- |
| `css/style.css` | Design system single-file (~3463 linhas, dark theme) |
| `service-worker.js` | Cache network-first, offline fallback |
| `manifest.webmanifest` | Manifest PWA |
| `README.md` | Guia de setup/deploy |
| `PROCESSO.md` | História e arquitetura do projeto |
| `DIETA_VINI.md` | Fonte auditável do plano alimentar do Vini e decisões da integração com o tracker |
| `dieta_vini/` | 21 screenshots-fonte do plano alimentar (19 conteúdos únicos) |
| `tests/vini-diet-plan.test.mjs` | Testes dos cálculos, snapshots, opcionais, hidratação e arroz + purê |
| `tests/tracker-run-distance.test.mjs` | Testes das opções, seleção, troca e limpeza da distância de corrida |
| `tests/water-options.test.mjs` | Testes das opções de água nos dois cards, conversão em litros e pontuação |

## Boot & autenticação

### Fluxo de boot

O `<body class="is-loading">` começa com a `.page` invisível (`opacity:0`/`pointer-events:none`) e um spinner via `body.is-loading::after` (style.css:634-650). Um script inline no `<head>` (index.html:14-21) roda **antes** do CSS/JS pintar: se `localStorage.getItem("habitos-auth-uid")` existir, adiciona a classe `auth-hidden` ao `<html>`, o que faz `html.auth-hidden .auth-gate { display:none }` (style.css:630-631) esconder o login na hora, eliminando o flash da tela de login ao navegar entre páginas.

O boot real acontece no listener `DOMContentLoaded` de `app.js` (app.js:154-164). Há um guard: `if (!document.getElementById("date-input")) return;` — porque `app.js` também é importado por outras páginas só para reaproveitar `APP_START_DATE`/`USERS`; apenas a página principal (a única com o input de data) segue. Em seguida chama `mountNavMenu()` e `setupAuthGate({ onAuthorized: (user) => initApp(user) })`.

`initApp` (app.js:111-152) pinta a data, preenche `#storage-badge` conforme `storageMode`, chama `renderAuthFooter(user)`, registra listeners (`date-input` change, `btn-today`, `btn-save`, `beforeunload` com `hasUnsavedChanges()`), e num bloco try/finally carrega config/tracker/history/points; o `finally` remove `is-loading` do body, revelando a página.

As demais páginas repetem o mesmo par `mountNavMenu()` + `setupAuthGate(...)` no seu próprio `*-page.js` e removem `is-loading` no fim.

### Auth-gate reutilizável

`setupAuthGate` (auth.js:82-162) pega `#auth-gate` e os elementos `#btn-google-login`, `#auth-loading`, `#auth-error`, define os helpers `showLoading()`/`showLogin()`/`showError(html)` e liga o clique do botão a `signInWithGoogle()`. Se `auth` for null (Firebase não configurado) mostra erro e sai. Se houver `getCachedAuthUid()`, esconde o gate imediatamente (`gate.classList.add("is-hidden")`). Depois registra `onAuthStateChanged`:

- **sem user** → limpa cache (`setCachedAuthUid(null)`), `showLogin()` e reexibe o gate;
- **user com e-mail não autorizado** → limpa cache e mostra "Acesso negado" com botão `#auth-retry` que chama `signOutUser()`;
- **autorizado** → `setCachedAuthUid(user.uid)`, esconde o gate e, protegido pela flag `initialized` (só uma vez), chama `onAuthorized(user)`.

### E-mails autorizados

`AUTHORIZED_EMAILS = ["vinigm@gmail.com", "victoria.cerutti@gmail.com"]` (auth.js:10-13). `isAuthorizedEmail(email)` normaliza com `.toLowerCase()` e checa inclusão. O próprio arquivo lembra que essa lista precisa estar espelhada nas Rules do Firestore.

### Login Google (popup → redirect fallback)

O módulo cria `provider = new GoogleAuthProvider()` com `setCustomParameters({ prompt: "select_account" })`. No load, `getRedirectResult(auth)` processa o retorno de um eventual redirect anterior. `signInWithGoogle()` (auth.js:51-71) tenta **sempre** `signInWithPopup` primeiro; só cai para `signInWithRedirect` nos códigos `auth/popup-blocked` e `auth/cancelled-popup-request`; em `auth/popup-closed-by-user` lança `Error("Login cancelado")`; outros erros são repropagados. O redirect é o último caso porque em PWA no iOS ele quebra a sessão (abre no Safari fora do escopo). `signOutUser()` limpa o cache, faz `signOut(auth)` e dá `location.reload()`.

### Cache otimista de auth

Chave `AUTH_CACHE_KEY = "habitos-auth-uid"` no localStorage. `getCachedAuthUid()`/`setCachedAuthUid(uid)` gravam/removem o uid e sincronizam a classe `auth-hidden` no `<html>` via `document.documentElement.classList.toggle("auth-hidden", !!uid)`, casando com o script inline do `<head>`.

Observação: se o uid estiver em cache mas a sessão do Firebase estiver expirada, o gate aparece escondido no primeiro paint e `onAuthStateChanged(null)` depois limpa o cache e o reexibe — pode causar um pequeno flash reverso do login.

### Firebase

Em `firebase-config.js`, o SDK 10.12.2 é importado da CDN gstatic. `firebaseConfig` já vem preenchido (projectId `gymproject-12fff`). `isConfigured = !firebaseConfig.apiKey.includes("COLE_AQUI")`. Se configurado, inicializa `initializeApp`, `getFirestore`, `getAuth` e força `setPersistence(_auth, browserLocalPersistence)` para manter a sessão entre reloads. Exporta `db`, `auth`, `GoogleAuthProvider` e os helpers do Firestore (`doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, deleteDoc, orderBy, onSnapshot, serverTimestamp`).

## Navegação

O menu vem de `nav-menu.js`. `NAV_ITEMS` é um array de 13 itens `{href, icon, label, match}`: Hábitos, Pontos, Prêmios, Recordes, Placares, Stats, Alongar, Pomodoro, Status, Kg Vini, Kg Vivi, Vivi, Config.

`mountNavMenu(containerId="nav-menu")` pega o `<nav id="nav-menu">`, adiciona a classe `nav-menu` e um `aria-label`, e renderiza os `<a class="nav-item">` (ícone + label). O item ativo é decidido por `currentFile()` (último segmento de `window.location.pathname`, com `""` virando home) comparado a `item.match.includes(file)`; o ativo ganha `is-active` e `aria-current="page"` (a home casa com `["", "index.html"]`).

Em seguida o nav é posicionado logo abaixo da `.topbar`: `setOffsets()` mede `topbar.offsetHeight`, define `el.style.top` e expõe `--stack-top = (topbar + nav).offsetHeight` no `<html>` para outros elementos sticky (style.css:1533 usa `top: var(--stack-top, 100px)`). `setOffsets` roda no mount, no `resize` e via `setTimeout(…, 250)` para reajustar depois que fontes/layout assentam. Em páginas sem `.topbar` a variável não é setada e os stickies caem no fallback de 100px.

## Páginas & funcionalidades

### Hábitos (registro)

**O que faz.** Tela principal (`index.html`) onde Vini e Vivi marcam os hábitos do dia por chips, com aviso de alterações não salvas e salvamento em lote. Abaixo, um histórico do mês corrente.

**Como funciona por baixo.** Dois usuários fixos: `USERS = ["vinicius", "victoria"]`. A data ativa fica em `state.date` (default `todayISO()`, clampada a `APP_START_DATE = "2026-05-18"`). O HTML tem dois `<article class="person-card" data-user="vinicius|victoria">`, cada um com `.chip-grid[data-group="..."]` de `.chip[data-value="..."]`.

`tracker.js` mantém dois objetos por usuário: `saved[userId]` (o que está no banco) e `local[userId]` (o que está sendo editado). As regras puras ficam em `tracker-model.js`: `MULTI_GROUPS = new Set(["exercises","extras","gym_groups"])` são multi-select (arrays); os demais grupos são radio-like (string única, `Number` para `jiu_spar_min`/`stretch_min`/`run_km`, ou `null`).

- **Carga** — `refreshAllTrackers()` pega a data, faz `Promise.all(USERS.map(u => getDay(u, date)))`, garante arrays em `exercises/extras/gym_groups`, faz deep-copy para `saved[u]` e `local[u]`, e chama `paintCard(u)` + `paintSaveButton()`.
- **Edição** — `handleChipClick` passa `group` e `v` para `toggleTrackerValue`; se MULTI, faz toggle no array; se radio, guarda `Number(v)` (para `jiu_spar_min`/`stretch_min`/`run_km`) ou string, e clicar no valor já ativo zera para `null`. Marcar corrida abre os cards de distância (2,5 a 10 km); desmarcá-la recolhe o bloco e limpa `run_km`. A distância é descritiva e não altera os pontos fixos da corrida.
- **Blocos condicionais** — `paintCard` alterna classes no `.person-card`: `has-gym` (tem "academia"), `has-run` (tem "corrida"), `has-jiu` (tem "jiujitsu"), `has-jiu-session`, `has-stretch` (tem "alongamento"), revelando `.gym-detail`, `.run-detail`, `.jiu-detail`, `.jiu-spar`, `.stretch-detail`. O detalhe de corrida existe nos dois cards; jiu-jítsu e seus detalhes só existem no card do Vinicius.
- **Dirty-check** — `isDirtyUser` compara `JSON.stringify(normalizeTrackerDay(saved))` vs `normalizeTrackerDay(local)`. A normalização ordena arrays, trata nulos, valida `run_km` e coage tipos. `hasUnsavedChanges()` = `dirtyCount() > 0`.
- **Salvar** — `saveAllDirty()` filtra usuários dirty, `Promise.all(dirty.map(u => saveDay(u, date, local[u])))`, e em sucesso copia `saved[u] = deep-copy(local[u])`, repinta e mostra "salvo!". O `#btn-save` (ligado em `app.js`) chama `saveAndRefresh()` = `saveAllDirty()` + `refreshDependentViews()` (que roda `renderHistory()` + `refreshPointsBadge()`).
- **Navegação de data** — `#date-input` (min = `APP_START_DATE`) e `#btn-today` chamam `navigateToDate`, que clampa a data e, se houver pendências, dá `confirm()` (OK = salvar e mudar; Cancelar = descartar e mudar). Há `beforeunload` bloqueando fechar a aba com pendências.
- **Chips de "Outros hábitos"** — renderizados dinamicamente por `renderExtrasChips()` a partir de `EXTRAS_META`, depois de `loadAndApplyConfig()`. Os grids no HTML vêm vazios de propósito.

**Arquivos.** `index.html`, `js/tracker.js`, `js/tracker-model.js`, `js/storage.js`, `js/history.js`, `js/app.js`, `js/points-config.js`.

### Pontos

**O que faz.** Página `points.html` com totais por período, detalhamento por pessoa/dia e um calendário diário interativo.

**Como funciona por baixo.** `initPointsPage` → `renderHeaderPeriod`, `loadAndApplyConfig`, `_data = loadAllData()` (todos os dias dos dois usuários desde `APP_START_DATE`).

- `renderTotals` mostra 3 cards (semana/mês/total via `pointsInPeriod`) com a soma do casal e o valor por pessoa.
- `renderBreakdown` usa `breakdownByDay`: para o período escolhido (select `#breakdown-period`, default `weekly`) monta uma coluna por pessoa com blocos por dia (cada linha = categoria `label ×count` e `fmtPts`), subtotal por dia e total da coluna; embaixo, o card combinado.
- `renderDailyCalendar` desenha grade mensal (nav ‹/›) com pontos de Vini (azul) e Vivi (rosa) por célula (classes `has-bonus`/`has-penalty`); clicar num dia fixa `_calState.selectedDate` e re-renderiza o breakdown só daquele dia (toggle volta ao período).

**Arquivos.** `js/points-page.js`, `points.html`, `js/points-utils.js`, `js/points-engine.js`, `js/storage.js`.

### Prêmios (casal)

**O que faz.** `casal.html`: lojinha do casal com carteira conjunta, compra e histórico (`scope` "shared").

**Como funciona por baixo.** Não existe saldo persistido — a carteira é **derivada**: `balance = totalEarnedByUser(vini) + totalEarnedByUser(vivi) − totalSpent(txs scope "shared")` (casal-page.js:34-38, `earned = earnedVini + earnedVic`). `renderStore` lista `REWARDS` com barra de progresso (`pct = balance/price`) e habilita "Comprar" se `balance >= price`. Comprar → `confirm()` → `addTransaction({scope:"shared", item, price, note})` (grava com `created_at = serverTimestamp`) → `refreshAll()`. `renderHistory` lista as compras (desc por `created_at`) com botão "desfazer" → `deleteTransaction(id)` (devolve os pontos).

> **⚠️ Dupla contagem dos pontos ganhos.** Os pontos de cada pessoa entram **integralmente** em duas carteiras ao mesmo tempo, sem divisão nem dedução cruzada. Os pontos da Vivi, por exemplo, contam por inteiro tanto na carteira do casal (casal-page.js:34-38, `earned = earnedVini + earnedVic` — soma o total dela via `totalEarnedByUser`) quanto na carteira pessoal dela (victoria-page.js, `earned = totalEarnedByUser(victoria)`). **Só o GASTO é segregado por `scope`**: uma compra `"shared"` não abate a carteira `"personal-victoria"` e vice-versa. Ou seja, ganhar 100 pontos dá 100 na carteira do casal E 100 na carteira pessoal da Vivi — os mesmos pontos são "gastáveis" nos dois lugares independentemente.

**Arquivos.** `js/casal-page.js`, `casal.html`, `js/points-utils.js`, `js/storage.js`.

### Recordes

**O que faz.** `recordes.html`: melhor dia/semana/mês de cada um, com detalhamento, e banner do recordista geral de cada período.

**Como funciona por baixo.** `getBestDay`/`getBestWeek`/`getBestMonth` percorrem os dias de cada usuário, usam `breakdownForDays` para pegar total e linhas, pulam períodos sem itens e guardam o de maior total. Antes do cálculo, `filterDataByUserForTrackingScope` aplica o ciclo atual (padrão) ou libera o histórico completo. `renderRecordsBanner` mostra o dono do recorde geral de dia/semana/mês (`findTopByPeriod` compara os dois usuários). `renderRecords` mostra os cards Melhor dia/semana/mês por pessoa.

**Arquivos.** `js/records-page.js`, `recordes.html`, `js/points-utils.js`, `js/tracking-cycle.js`.

### Placares

**O que faz.** `placares.html`: comparação Vini x Vivi por dias, semanas e meses.

**Como funciona por baixo.** `computeScores` usa `compareBuckets(vMap, cMap)`, que conta em quantos **baldes** cada um teve mais pontos (vitória por balde; empate não conta para ninguém). `days` compara `pointsForDay` por data; `weeks`/`months` usam `aggregateByWeek`/`aggregateByMonth` (soma por segunda-feira da semana / por `YYYY-MM`). O conjunto recebido abre filtrado pelo ciclo atual; o seletor permite recalcular com o histórico completo. `renderScoreboards` mostra 3 cards (Dias/Semanas/Meses) com headline ("X ganhando por N…", "Empate" ou "Sem placares ainda") e o placar V × Vivi.

**Arquivos.** `js/placares-page.js`, `placares.html`, `js/points-utils.js`, `js/tracking-cycle.js`.

### Stats

**O que faz.** `stats.html`: estatísticas por pessoa, com toggle Vini/Vivi (`#stats-user-seg`), janela de 7/30/90 dias (`#vstat-range`) e seletor entre ciclo atual e histórico completo.

**Como funciona por baixo.** `initStatsPage` faz `renderAuthFooter`, `setupToggle()`, aguarda `loadAndApplyConfig()` e, via `Promise.all`, busca `getRange(u, APP_START_DATE, todayISO())` dos dois usuários + `getStretchSessions(u)`; guarda em `_daysByUser`/`_stretchByUser` e chama `render()`. Os dados são sempre buscados inteiros. Por padrão, `filterRecordsForTrackingScope` limita totais, médias, streaks, recordes, modalidades e sessões ao ciclo iniciado em **2026-07-15**; `Histórico completo` volta a usar `APP_START_DATE` sem reler ou alterar o banco.

Seções renderizadas, nesta ordem: **Pontos** (total, média/dia, semana, mês) · **Recordes** · **Resumo do período** (dias ativos, dias de exercício, % refeições limpas, média de água, cigarros) · **Sequências (atual · recorde)** (exercício, sem fumar, sem refri, sem sobremesa) · **Totais desde o início** · **Outros hábitos** · **Exercícios por modalidade** · **Alimentação** · **Cigarros & Nicotina** · **Jiu-jítsu** (só Vini) · **Pilates** (só Vivi) · **Alongamento** · **Academia**.

Gráficos: medidor semicircular SVG (`semiDonut`, refeições limpas x sujas), barras por dia da semana (`dowChart`), barras horizontais empilhadas por grupo muscular/DOW (`gymDowBars`), barras normalizadas de refeições por DOW (`mealDowChart`), somatório por DOW (`dowSumChart`, cigarros/chiclete), mini-calendário mensal com badges (`gymCalendar`) e barra de progresso (`bar`). Streaks: `currentStreak` anda para trás desde hoje; `bestStreak` anda para frente desde o início do escopo selecionado.

**Arquivos.** `js/stats-page.js`, `stats.html`, `js/points-utils.js`, `js/points-engine.js`, `js/storage.js`, `js/stretch-storage.js`, `js/tracking-cycle.js`. (`js/stats.js` e `js/calendar.js` são código morto — ver Modelo de dados/observações.)

### Alongamento

**O que faz.** `alongamento.html`: sessões guiadas de alongamento com timer e auto-avanço por exercício, alimentando o motor de pontos.

**Como funciona por baixo.** Três sessões fixas (5/10/15 min = 5/10/15 exercícios de 1 min cada), com janela de preparação de 5s entre exercícios, hardcoded no objeto `SESSIONS` de `alongamento-page.js`. Suporta pular exercício/prep, pausar/continuar e encerrar com confirmação; beeps de transição via Web Audio. Wake Lock mantém a tela acesa durante o timer (padrão descrito em PWA/Wake Lock). Ao concluir, grava histórico em `stretch_sessions` **e** marca o day-record via `markDayWithStretch`: adiciona `"alongamento"` a `exercises` e grava `stretch_min` — os dois campos são a ponte para os pontos. Estatísticas Hoje/Semana/Total + média por sessão, calendário mensal e histórico das 12 sessões recentes.

**Arquivos.** `alongamento.html`, `js/alongamento-page.js`, `js/stretch-storage.js`, `js/storage.js` (getDay/saveDay), `js/points-config.js` (bloco `POINTS.stretch`).

### Pomodoro

**O que faz.** `pomodoro.html`: timer Pomodoro (Foco / Pausa curta / Pausa longa) com categorias e estatísticas por usuário. É autocontido — **não dá pontos**.

**Como funciona por baixo.** Durações configuráveis por usuário (foco 1–180 min, pausas 1–60 min) e `cycles_per_long`; `nextBreakMode()` escolhe pausa longa quando `pomodorosCompleted % k === 0`. A transição foco→pausa é automática; pausa→foco não. Categorias editáveis por usuário (adicionar por prompt, remover com mínimo de 1). Só sessões de **foco** gravam tempo/categoria em `pomodoro_sessions`; pausas nunca são gravadas. Estatísticas Hoje/Semana/Total (tempo focado + nº de ciclos + breakdown por categoria) e histórico das 10 sessões recentes. Modo foco fullscreen (overlay preto `.pom-focus` + Fullscreen API com fallback webkit), controles que somem após 3s de inatividade, e beeps distintos via Web Audio (`beepTick` nos últimos 5s, `beepFocusDone` 3 subindo, `beepBreakDone` 2 descendo). Wake Lock durante o timer.

**Arquivos.** `pomodoro.html`, `js/pomodoro-page.js`, `js/pomodoro-storage.js`.

### Status (presença)

**O que faz.** `presence.html`: painel de foco compartilhado (pensado para um tablet no escritório) que alterna OCUPADO/Disponível em ciclos Pomodoro, com sincronização em tempo real e Wake Lock robusto.

**Como funciona por baixo.** `USERS = { vinicius: {name:"Vini", cls:"vini", emoji:"💙"}, victoria: {name:"Vivi", cls:"vic", emoji:"💗"} }`. Usuário ativo em `localStorage` sob `habitos-presence-active-user`. O estado é só `{ user, ocupado, since }`, com `since` = epoch ms de início do ciclo. **Nada é persistido por segmento** — tudo é recalculado a partir de `since`, então os dois tablets exibem o mesmo. Constantes: `FOCUS_SECS = 25*60`, `BREAK_SECS = 5*60`, `CYCLE_SECS = 1800`. `computeCycle(elapsedSec)` calcula ciclos completos e a fase (`focus`/`break`). `tick()` (a cada 1s) alterna as classes do hero/body, escreve o histórico (🍅 foco / ☕ pausa) em `#presence-log` e o cronômetro grande em `#presence-now`.

Cores: OCUPADO (fase foco) = `is-ocupado` + `presence-busy` (vermelho); Disponível (pausa/ocioso) = `is-livre` (verde). O hero é um botão grande; clicar faz feedback otimista e chama `setPresence`. Tela cheia via `presence-fullscreen` + Fullscreen API (fallback webkit). Sincronização em tempo real por `onSnapshot` na coleção `presence`. Wake Lock robusto detalhado na seção PWA.

**Arquivos.** `presence.html`, `js/presence-page.js`, `js/presence-storage.js`.

### Kg Vini e Kg Vivi (peso + dieta)

**O que faz.** `kg-vivi.html` e `kg-vini.html`: acompanhamento individual de peso (registro, gráfico e IMC) e alimentação. O atributo `data-kg-user="victoria|vinicius"` do `<body>` define o usuário e separa os dados pelo `userId`. A Vivi mantém o tracker genérico por alimentos; o Vini usa o plano prescrito e versionado em `DIETA_VINI.md`.

**Como funciona por baixo.** A implementação é compartilhada por `kg-vivi-page.js`; `kg-vini-page.js` é a entrada da nova página. O seletor `#kg-section-seg` ("⚖️ Peso" / "🍽️ Dieta") usa `habitos-kg-section` para Vivi e `habitos-kg-section-vinicius` para Vini.

- **Peso** — `renderWeight()` monta hero, formulário, gráfico, IMC e últimos registros. O registro continua sem horário e separado por usuário. Gráfico, comparação e lista abrem no ciclo atual; o hero também mostra a variação desde a primeira pesagem do ciclo. `Histórico completo` recupera visualmente todas as pesagens anteriores.
- **Dieta da Vivi** — `renderDiet()` monta o cardápio genérico, resumo, metas provisórias, histórico e estatísticas. `computeNutrition` soma kcal/proteína/carbo/gordura e `setDietDay` persiste o mapa `foods` por usuário/data.
- **Dieta do Vini** — `renderViniDietTracker()` monta navegação por data, resumo nutricional, checkboxes individuais com seletores de quantidade agrupados por momento alimentar, hidratação, semana, ciclo e histórico editável. O plano `vini-nutri-2026-07-v3` contabiliza cobertura de 4 momentos principais (café, almoço, lanche e jantar); pré/pós-treino e belisco são contextuais. Cada mudança chama `withViniDietSummary` antes de `setViniDietPlanDay`, preservando um snapshot de kcal/macros junto dos alimentos e quantidades marcados. No Kg Vini, o seletor de acompanhamento oferece ainda `Dieta Oficial`: `renderViniOfficialDiet()` troca a área de conteúdo por uma consulta estática das 18 composições completas e da hidratação, sem inputs nem persistência; ao entrar nela a seção muda para Dieta, e abrir Peso retorna ao Ciclo atual.

**Metas diárias da Vivi (`GOALS`).** Valores **provisórios** (comentário explícito no código: "Quando tiver os certos, troque só aqui"; a UI mostra a nota "metas provisórias — ajuste quando tiver os números certos"):

| Meta | Valor-alvo |
| --- | --- |
| Calorias (`kcal`) | 2000 kcal |
| Proteína (`p`) | 90 g |
| Carbo (`c`) | 250 g |
| Gordura (`f`) | 65 g |

**Cardápio genérico da Vivi (`DIET_MENU`).** 4 refeições, cada uma com seus alimentos, opções de quantidade e perfil nutricional aproximado. `per: "unit"` = valores por unidade; `per: "100g"` = valores por 100 g. `FOOD_NUTRI` indexa por `${refeição.alimento}`.

| Refeição (key) | Alimentos (opções · `per`) — kcal / P / C / G |
| --- | --- |
| **Café da manhã** (`cafe` 🌅) | Ovo [1,2,3,4] unid → 72 / 6,3 / 0,4 / 4,8 · Pão fatias [1,2,3] unid → 65 / 2,2 / 12 / 0,8 |
| **Lanche da manhã** (`lanche_manha` 🥪) | Whey doses [1,2] unid → 120 / 24 / 3 / 1,5 · Iogurte [1,2] unid → 100 / 6 / 12 / 3 · Pão fatias [1,2] unid → 65 / 2,2 / 12 / 0,8 |
| **Almoço** (`almoco` ☀️) | Arroz [50,100,150] g → 130 / 2,7 / 28 / 0,3 · Feijão [50,100,150] g → 80 / 5 / 14 / 0,5 · Carne [50,100,150] g → 220 / 26 / 0 / 12 · Frango [50,100,150] g → 165 / 31 / 0 / 3,6 · Peixe [50,100,150] g → 130 / 26 / 0 / 3 |
| **Janta** (`janta` 🌙) | Mesmos 5 alimentos do almoço (arroz, feijão, carne, frango, peixe), todos `per:"100g"`, opções [50,100,150] g e valores idênticos |

**Plano do Vini (`VINI_MEALS`, `VINI_FOOD_GROUPS` e `VINI_OFFICIAL_MEALS`).** `VINI_MEALS` preserva a estrutura usada pelo tracker: pré-treino, café da manhã, 5 opções de almoço, 5 opções técnicas de lanche, pós-treino, 5 opções de jantar e belisco. `VINI_FOOD_GROUPS` achata esse catálogo para a interface: cada alimento aparece em um único card por momento, enquanto as porções prescritas e faixas úteis viram botões de quantidade. Banana, ovos e produtos inteiros usam unidades; pão usa fatias; whey usa medidas; líquidos usam ml; os demais alimentos mensuráveis usam gramas. Os macros são escalados pela razão entre a quantidade registrada e a quantidade de referência. `VINI_OFFICIAL_MEALS` é a projeção fiel para consulta: reúne Pro Force e Natural Whey como alternativas dentro da mesma refeição do `IMG_3071.PNG`, resultando nas 18 composições completas mostradas nos prints. Itens “à vontade” são registráveis, mas não entram na soma nutricional.

**Estatísticas do Vini.** O dia mostra kcal/macros somados a partir dos alimentos e quantidades marcados, quantidade de alimentos, cobertura dos 4 momentos principais e hidratação. A semana da data selecionada mostra dias registrados, kcal totais e médias, macros totais e médios, distribuição energética P/C/G, média de alimentos por registro e comparação com a semana anterior. O ciclo mostra médias, água, melhor sequência, marcos de dias, frequência por momento e alimentos mais marcados com sua quantidade acumulada. Tudo respeita `Ciclo atual` x `Histórico completo`.

**Arquivos.** `kg-vini.html`, `kg-vivi.html`, `js/kg-vini-page.js`, `js/kg-vivi-page.js`, `js/vini-diet-plan.js`, `js/vini-diet-ui.js`, `js/vini-official-diet.js`, `js/weight-storage.js`, `js/diet-storage.js`, `js/tracking-cycle.js`, `DIETA_VINI.md`.

### Vivi

**O que faz.** `victoria.html`: carteira, loja e histórico pessoais da Vivi (`scope` "personal-victoria").

**Como funciona por baixo.** `initVictoriaPage` chama `loadAndApplyConfig()` (para `REWARDS_VICTORIA` refletir `config/points`) e `refreshAll()`, que via `Promise.all` busca `getRange("victoria", APP_START_DATE, hoje)` + `getTransactions({scope: "personal-victoria"})`. `renderWallet`: `earned = totalEarnedByUser(dias da Vivi)`, `spent = totalSpent(txs)`, `balance = earned − spent` (mais semana/mês via `pointsInPeriod`). `renderStore` itera `REWARDS_VICTORIA` com barra de progresso e botão Comprar (`confirm` → `addTransaction` → `refreshAll`). `renderHistory` lista as transações com data formatada e botão "desfazer" (`deleteTransaction`).

> **Atenção — dupla contagem.** O `earned` aqui é o total **integral** dos pontos da Vivi desde o início (`totalEarnedByUser(victoria)`), o mesmo valor que também compõe a carteira do casal (ver "Prêmios (casal)"). Não é um orçamento pessoal separado: os pontos dela alimentam as duas carteiras simultaneamente, e só o gasto (`scope`) é isolado por carteira.

**Arquivos.** `js/victoria-page.js`, `victoria.html`, `js/points-utils.js`, `js/storage.js`.

### Config

**O que faz.** `config.html`: edita ao vivo a tabela de pontos e prêmios, persistindo em `config/points`.

**Como funciona por baixo.** `initConfigPage` faz reset aos defaults (`resetPoints`/`resetExtrasMeta`/`resetRewards`), `loadConfigOverrides()`, aplica `applyPoints`/`applyExtrasCustom`/`applyRewardsFromOverride`, chama `renderForm()` e liga submit=`handleSave` e `#btn-config-reset`=`handleReset`. `SECTIONS` define os blocos: 💪 Exercícios, 🧘 Alongamento por duração, 💧 Hidratação (gerada por `WATER_LITRES_OPTIONS`, com keys escapadas), 🍽️ Refeições, 🚬 Cigarros/Nicotina, 🍰 Sobremesa, 🥤 Refrigerante, ✨ Outros hábitos (`dynamic:"extras"`), 🎁 Recompensas (`dynamic:"rewards"`). `buildOverride()` monta um objeto **enxuto** (só o que difere do default): campos alterados, `extras`/`extras_custom`, `rewards_shared`/`rewards_victoria`. `handleSave` chama `saveConfigOverrides(override)` e reaplica em runtime; `handleReset` chama `clearConfigOverrides` + reset. Os overrides valem globalmente — os pontos são recalculados na hora por `pointsForDay`.

**Arquivos.** `js/config-page.js`, `config.html`, `js/points-config.js`, `js/water-options.js`, `js/points-utils.js`, `js/storage.js`.

## Modelo de dados

Todas as coleções têm um módulo de storage próprio com fallback automático para `localStorage` quando `isConfigured` é falso.

### Coleção `days`

- **Doc ID**: `${userId}_${YYYY-MM-DD}` (ex.: `vinicius_2026-07-15`), via `dayKey(userId, date)`.
- **Módulo**: `js/storage.js` (`COL = "days"`). Leitura por `getDoc` direto; `getRange` faz `Promise.all` de `getDoc` por ID (não usa query — decisão explícita para não travar sob as regras).
- **Campos**: `userId` ("vinicius"|"victoria"), `date`, `exercises` (string[]), `gym_groups` (string[]), `extras` (string[]), `run_km` (Number ∈ {2.5, 3, 4, 5, 6, 7, 8, 9, 10}|null), `water` ("0.5L"|"1L"|"1.5L"|"2L"|"2.5L"|"3L"|"3.5L"|"4L"|"4.5L"|"5L"|null), `lunch`/`dinner` ("limpo"|"sujo"|null), `dessert` ("sim"|"nao"|null), `soda` ("sim"|"nao"|null), `cigarettes` (string "0".."6"|null), `nicotine_gum` (string "0".."10"|null), `jiu_session` ("6h30"|"12h"|"16h30"|"19h30"|"Sab11"|null), `jiu_spar_min` (Number ∈ {15, 20, 25, 30, 35, 40, 45, 50, 60}|null), `stretch_min` (Number 5/10/15|null), `updatedAt` (serverTimestamp no Firebase / ISO string no local).
- **Valores dos grupos**: `exercises` — Vini: academia, corrida, jiujitsu, alongamento; Vivi: academia, corrida, yoga, pilates, bicicleta, alongamento. `run_km` (radio, nos dois cards): 2.5, 3, 4, 5, 6, 7, 8, 9, 10. `gym_groups`: costa, triceps, peito, biceps, perna, ombro, lombar, abdominal. `jiu_session` (radio, só card Vini): 6h30, 12h, 16h30, 19h30, Sab11. `jiu_spar_min` (radio→Number, só Vini): 15, 20, 25, 30, 35, 40, 45, 50, 60. `extras`: keys de `EXTRAS_META` (marmita, vegetais, fruta, cafe, mercado, escada, leitura, conversa, skincare, suplemento + custom).
- **Observação**: `emptyDay()` inicializa `{userId, date, exercises:[], run_km:null, water:null, lunch:null, dinner:null, updatedAt:null}` — os demais campos só existem no doc depois de marcados.

### Coleção `transactions`

- **Doc ID**: automático (Firestore) ou `local-${Date.now()}` (localStorage).
- **Módulo**: `js/storage.js` (`TX_COL = "transactions"`).
- **Campos**: `scope` ("shared" | "personal-victoria" | "personal-vinicius" reservado/futuro), `item` (nome do prêmio), `price` (Number), `note` (string|null), `created_at` (serverTimestamp / ISO). `getTransactions({scope})` filtra por `where("scope","==",scope)` e ordena por `created_at` desc.

### Coleção `config` (doc único `points`)

- **Doc ID**: `points` (`CONFIG_COL = "config"`, `CONFIG_POINTS_DOC = "points"`).
- **Módulo**: `js/storage.js`.
- **Campos**: override **parcial** de `POINTS` (só folhas numéricas editadas) + `extras` (overrides de defaults) + `extras_custom` (`[{key,label,icon,points}]`) + `rewards_shared[]` + `rewards_victoria[]` (cada item `{name,icon,price,description,custom?}`). Funções: `loadConfigOverrides`, `saveConfigOverrides`, `clearConfigOverrides` (que faz `setDoc({})` no Firebase — o doc continua existindo vazio).

### Coleção `pomodoro_sessions`

- **Doc ID**: automático (`addDoc`) ou `local-${Date.now()}`.
- **Módulo**: `js/pomodoro-storage.js` (`SES_COL`). Um doc por sessão de **foco** concluída (pausas não são gravadas).
- **Campos**: `userId`, `category`, `duration_min` (Number = `focus_min` do momento), `completedAt` (ISO), `date` (`completedAt.slice(0,10)`), `created_at` (serverTimestamp). Leitura por `where("userId","==",userId)`, ordenada no cliente por `completedAt` desc.

### Coleção `pomodoro_config`

- **Doc ID**: `userId` (1 doc por usuário), via `setDoc`.
- **Módulo**: `js/pomodoro-storage.js` (`CFG_COL`).
- **Campos**: `focus_min`, `short_min`, `long_min`, `cycles_per_long` (Numbers), `categories` (string[]), `userId`. `DEFAULT_POMODORO_CONFIG = { focus_min:25, short_min:5, long_min:10, cycles_per_long:3, categories:["Trabalho","Estudo"] }`.

### Coleção `stretch_sessions`

- **Doc ID**: automático (`addDoc`) ou `local-${Date.now()}`.
- **Módulo**: `js/stretch-storage.js` (`COL`). Um doc por timer de alongamento concluído.
- **Campos**: `userId`, `duration_min` (Number 5|10|15 = a duração da sessão), `completedAt` (ISO), `date` (`YYYY-MM-DD`), `created_at` (serverTimestamp). Leitura por `where("userId","==",userId)` ordenada por `completedAt` desc.

### Coleção `presence`

- **Doc ID**: `userId` (1 doc por pessoa = status atual).
- **Módulo**: `js/presence-storage.js` (`COL = "presence"`).
- **Campos**: `userId`, `ocupado` (bool), `since` (epoch ms | null), `updatedAt` (serverTimestamp). `setPresence(userId, ocupado)` recalcula `since` (`Date.now()` se ocupado, senão `null`). `subscribePresence(userId, cb)` usa `onSnapshot`.

### Coleção `weight_logs`

- **Doc ID**: automático (`addDoc`).
- **Módulo**: `js/weight-storage.js` (`COL = "weight_logs"`).
- **Campos**: `userId`, `weight` (Number, kg), `fasting` (bool), `date` (`YYYY-MM-DD`), `time` (string, sempre `""` no fluxo atual), `at` (epoch ms), `created_at` (serverTimestamp). Query por `where("userId","==",userId)`, ordenado por `at`. `deleteWeightEntry` remove por id. Altura e flag de seed ficam em localStorage (não no Firestore).

### Coleção `diet_logs`

- **Doc ID**: `${userId}_${date}` (via `keyOf`) — 1 doc por usuário por dia.
- **Módulo**: `js/diet-storage.js` (`COL = "diet_logs"`).
- **Campos comuns**: `userId`, `date` (`YYYY-MM-DD`) e `updatedAt` (serverTimestamp).
- **Tracker genérico/legado**: `foods` (mapa `{ "refeição.alimento": quantidade }`, ex.: `{ "cafe.ovo": 2, "almoco.arroz": 100 }`). `cleanFoods` remove quantidades ≤ 0.
- **Plano do Vini**: `planVersion` e `plan`, contendo `{ version, foods, amounts, meals, hydrationMl, trainingDay, summary }`. `foods[groupId]` guarda os IDs dos alimentos marcados e `amounts[groupId][foodId]` guarda sua quantidade. `meals` permanece somente para leitura e migração do formato v1 (`{ optionId, checked[] }`); IDs de porção da v2 também são migrados. `summary` guarda o snapshot de `consumed`, quantidade de itens, cobertura dos momentos principais e hidratação.
- **Compatibilidade**: `setDietDay` e `setViniDietPlanDay` usam `setDoc(..., {merge:true})`; portanto `foods` e `plan` coexistem e nenhum registro do formato anterior é apagado.

### Regras de pontuação (`DEFAULT_POINTS`)

- exercises: academia 50, corrida 70, yoga 70, jiujitsu 50, pilates 50, bicicleta 50, alongamento 0.
- stretch: "5"→15, "10"→30, "15"→45.
- water: 0,5–5 L em intervalos de 0,5 L, com 10 pontos por litro (5–50 pontos).
- meals.lunch/dinner: limpo +15, sujo −15.
- cigarettes: −15 por cigarro (multiplica pela quantidade). nicotine_gum: 0 (default).
- dessert: nao +50, sim 0. soda: nao +70, sim −10.
- extras: marmita 80, vegetais 40, fruta 40, cafe 10, mercado 30, escada 20, leitura 10, conversa 80, skincare 15, suplemento 30.

### Prêmios

- **Casal** (`DEFAULT_REWARDS`, em pts): Date romântico 1000, Cinema 1200, Aula experimental 2000, Delivery (pizza ou pastel) 2500, Game Night com porcarias 3000, Experiência 4500, Roupa de academia nova 5000, Massagem relaxante 6500, Tênis novo de corrida 8000, Final de semana de descanso 12000.
- **Pessoais da Vivi** (`DEFAULT_REWARDS_VICTORIA`): Esmalte novo 300, Manicure 500, Skincare especial 800, Livro novo 600, Roupa nova 1500, Bolsa / acessório 2500.

### Constantes globais

`USERS = ["vinicius","victoria"]`, `APP_START_DATE = "2026-05-18"`, `CATEGORY_START_DATES = { academia:"2026-05-18", jiujitsu:"2026-06-08", pilates:"2026-06-09" }`. `TRACKING_CYCLES` define para os dois o ciclo `nutri-2026-07`, iniciado em `2026-07-15` e ainda sem data final. Projeto Firebase: `gymproject-12fff`.

O ciclo é somente uma camada de leitura: `days`, `stretch_sessions`, `weight_logs` e `diet_logs` continuam completos. Stats, Recordes, Placares e Kg abrem em `Ciclo atual` e oferecem `Histórico completo`. A página Pontos, as carteiras, compras e saldos de recompensas **não** usam esse filtro e continuam acumulados desde `APP_START_DATE`.

### Principais chaves de localStorage (prefixo `habitos-`)

- `habitos-days-v1` (days), `habitos-transactions-v1` (transactions), `habitos-config-points-v1` (config).
- `habitos-diet-logs-v1` (diet), `habitos-weight-logs-v1` (weight), `habitos-pomodoro-sessions-v1` (sessões pomodoro), `habitos-stretch-sessions-v1` (sessões de alongamento).
- Prefixos por usuário (concatenam o userId): `habitos-pomodoro-cfg-`, `habitos-presence-`, `habitos-weight-height-` (altura, default 1,63 m), `habitos-weight-seeded-` (flag de seed).
- Estado de UI/sessão: `habitos-auth-uid` (cache do UID logado), `habitos-presence-active-user` (usuário ativo no Status), `habitos-kg-section` (aba Peso/Dieta da Vivi) e `habitos-kg-section-vinicius` (aba do Vini). Há ainda a chave legada `habitos-vini-vic`.

## Regras do Firestore

As regras não estão versionadas em arquivo no repositório — a fonte da verdade é o console do Firebase (também transcritas no `PROCESSO.md`). Elas cobrem apenas `days`, `transactions` e `config` no bloco documentado; as coleções mais novas (`presence`, `weight_logs`, `diet_logs`, `pomodoro_sessions`, `pomodoro_config`, `stretch_sessions`) precisam de regras equivalentes no console. Bloco atual:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isCouple() {
      return request.auth != null
        && request.auth.token.email in ['vinigm@gmail.com', 'victoria.cerutti@gmail.com'];
    }
    match /days/{docId} {
      allow read, write: if isCouple()
        && docId.matches("^(vinicius|victoria)_\\d{4}-\\d{2}-\\d{2}$");
    }
    match /transactions/{anyId}       { allow read, write: if isCouple(); }
    match /config/{anyId}             { allow read, write: if isCouple(); }
    match /pomodoro_sessions/{anyId}  { allow read, write: if isCouple(); }
    match /pomodoro_config/{anyId}    { allow read, write: if isCouple(); }
    match /stretch_sessions/{anyId}   { allow read, write: if isCouple(); }
    match /presence/{anyId}           { allow read, write: if isCouple(); }
    match /weight_logs/{anyId}        { allow read, write: if isCouple(); }
    match /diet_logs/{anyId}          { allow read, write: if isCouple(); }
  }
}
```

A whitelist de e-mails aqui é a mesma de `AUTHORIZED_EMAILS` em `auth.js` — as duas precisam ficar sincronizadas.

## Camada de storage & padrões

- **`isConfigured` decide o backend.** Definido em `firebase-config.js` (`isConfigured = !firebaseConfig.apiKey.includes("COLE_AQUI")`). Cada módulo de storage tem duas ramificações: se `isConfigured`, usa Firestore; senão, `localStorage`. As páginas não sabem qual está ativo. `storageMode = isConfigured ? "firebase" : "local"` é exibido no `#storage-badge`.
- **Padrão dos módulos.** Cada coleção tem seu módulo com uma constante de nome (`COL`/`TX_COL`/`SES_COL`/`CFG_COL`/`CONFIG_COL`), um `keyOf`/`dayKey` para doc IDs determinísticos, e helpers de leitura/escrita em localStorage no fallback. Ao criar coleção nova, replica-se esse esqueleto.
- **Dois formatos de doc ID.** Determinístico (`days`, `diet_logs` = `userId_data`; `presence`, `pomodoro_config` = `userId`) vs auto-id com `created_at` (`transactions`, `weight_logs`, `pomodoro_sessions`, `stretch_sessions`).
- **`days` evita queries.** `getRange` faz `Promise.all` de `getDoc` por ID em vez de `query`, decisão explícita para não travar sob as regras (o formato do doc ID é validado pelas rules).
- **`onSnapshot` para tempo real.** Só o Status (`presence-storage.js`) usa `onSnapshot`, para que os dois tablets vejam o mesmo estado ao vivo. No fallback local, usa `localStorage` + um evento custom `"presence-local"` (o evento `storage` nativo não dispara na própria aba).
- **`serverTimestamp`.** As escritas no Firebase usam `serverTimestamp()` em `updatedAt`/`created_at`; no fallback local, gravam um ISO string (`new Date().toISOString()`).
- **`config/points` guarda só o diff.** O override é enxuto (só o que difere dos defaults do código); restaurar padrão = gravar `{}`.
- **Ordenações client-side.** Vários storages ordenam no cliente (`localeCompare` desc de `completedAt`/`at`) em vez de `orderBy`, e usam `where("userId","==",...)` sem índice composto; erros de regra costumam ser engolidos retornando `[]` com `console.warn`.

## Design system (CSS)

`css/style.css` é o único arquivo de estilos (~3191 linhas), sem framework, mobile-first e **dark-only** (não há `prefers-color-scheme` nem `data-theme`).

### Variáveis de `:root`

- **Superfícies/estrutura**: `--bg:#0b1220`, `--bg-2:#0f172a`, `--card:#111c33`, `--card-2:#16223f`, `--border:#1f2c4d`.
- **Texto**: `--text:#e5edff`, `--muted:#8a99c0`.
- **Marca por pessoa**: `--vini:#60a5fa` (azul, Vinicius), `--vic:#f472b6` (rosa, Victoria/Vivi) — usadas como `border-top` de 3px nos cards via `[data-user="vinicius"|"victoria"]`.
- **Semânticas**: `--accent:#6ea8ff`, `--good:#34d399`, `--bad:#f87171`, `--water:#38bdf8`, `--ex:#a78bfa`.
- **Tokens de layout**: `--shadow:0 6px 20px rgba(0,0,0,.35)`, `--radius:14px`, `--safe-bottom`/`--safe-top` (`env(safe-area-inset-*)` para o notch do iPhone).

Amarelos (`#fbbf24`/`#fcd34d`/`#fde68a`) e roxos/azuis de gradiente **não têm variável** — são hardcoded (IMC warn, macro gordura, prep do timer). `#0b1220` também aparece hardcoded como cor de texto sobre fundos claros (avatares, chips "on").

### Componentes reutilizáveis

- **Chips**: `.chip` (base), `.chip.is-on` (fundo accent), variantes `.chip--good.is-on` (verde), `.chip--bad.is-on` (vermelho), `.chip--num` (escala numérica; `data-value="0"` verde, `"5"/"6"` vermelho para cigarros). Grades `.chip-grid` + modificadores `--1/--2/--3/--5/--6/--7` (não há `--4`; grids de 4 usam layout ad-hoc). `.exercise-stack` empilha chips + blocos condicionais.
- **Blocos condicionais**: `.gym-detail`/`.run-detail`/`.jiu-detail`/`.stretch-detail`/`.jiu-spar`, revelados por `.person-card.has-gym`/`.has-run`/`.has-jiu`/`.has-stretch`/`.has-jiu-session`.
- **Segmented control**: `.seg > .seg-btn`, ativo `.seg-btn.is-on`; underline por pessoa via `.seg-btn[data-user=...].is-on`. `.stats-user-seg` é a variante full-width. O ciclo reutiliza o padrão em `.tracking-scope-seg` dentro de `.tracking-cycle-card`.
- **Cards de pessoa**: `.person-card` (border-top colorido por `data-user`), `.person-head`/`.person-name`, estado `.has-pending` (anel accent).
- **Avatares**: `.avatar` + `.avatar--vini`/`.avatar--vic` + tamanhos `--md/--sm/--xs`.
- **Estrutura de página**: `.page`, `.topbar`/`.brand`/`.topbar-date`/`.topbar-right`/`.points-badge`, `.nav-menu`/`.nav-item`/`.nav-item.is-active`, `.block`/`.block-head` (wrapper de seção). `.stats-toggle-bar` sticky usa `top: var(--stack-top)`.
- **Save/registro**: `.save-bar`/`.save-btn`/`.save-btn.is-dirty`, `.date-input` (`color-scheme:dark`), `.saved-pill`, `.sync-status[data-kind=ok|err]`.
- **Stats/gráficos**: `.stat-card`/`.stat-row`/`.bar>i`, `.kpi`/`.kpi-row`, `.donut` (gauge SVG 180°, `pathLength=100`), `.hg-*` (histórico grid), `.dow-chart`/`.meal-stack`, `.gym-dow-*`/`.gym-cal-*`.
- **Calendários**: `.calendar`/`.cal-cell`, `.dcal-*` (calendário de pontos, `.has-bonus`/`.has-penalty`).
- **Domínios específicos**: `.totals-*`/`.bd-*` (detalhamento), `.rec-*`/`.banner-card` (recordes), `.sb-*`/`.scoreboards` (placares), `.vic-*`/`.casal-*` (carteiras), `.config-*`/`.extra-*`/`.reward-*` (config), `.along-*` (alongamento/timer), `.pom-*` (pomodoro + overlay `.pom-focus`), `.presence-*` (status; `.presence-hero.is-ocupado`/`.is-livre`, switch `.presence-switch`, `body.presence-fullscreen`).
- **KG/Dieta**: `.kg-hero`/`.kg-hero-value`, `.kg-form`/`.kg-weight-input`/`.kg-height-input`/`.kg-check`, `.kg-seg`, `.kg-chart-wrap`/`.kgc-line`/`.kgc-area`/`.kgc-dot`, `.kg-imc-grid`/`.kg-stat` (`.imc--low/--ok/--warn/--high`), `.kg-list`. Dieta: `.diet-meal-group`/`.food-row`/`.food-chip`, `.nutri`/`.nutri-kcal`/`.nutri-macros` (`.nutri-p` verde, `.nutri-c` azul-água, `.nutri-f` amarelo), `.goals`/`.goal-row`/`.goal-fill` (`.is-met`), `.diet-days`/`.diet-day-row`.

### Responsivo

Breakpoints: `@media (max-width:359px)` compacta chips; `(max-width:420/480px)` faz reflow de grids de config/reward/totals; `(min-width:640px)` aumenta padding e grids (ex.: `.two-col` gap 16px).

## PWA, offline & Wake Lock

### Manifest

`manifest.webmanifest`: `name` "Hábitos · Vini & Vic", `short_name` "Hábitos", `start_url`/`scope` `"./"`, `display` standalone, `orientation` portrait, `background_color` `#0b1220`, `theme_color` `#0f172a`, um único ícone `./icons/icon.svg` (`sizes:any`, `purpose:any maskable`). Meta tags iOS no `<head>` (`apple-mobile-web-app-capable`, `-status-bar-style`, `-title` "Hábitos") completam o comportamento de app.

### Service Worker

`service-worker.js`, estratégia **network-first** com fallback offline. `CACHE = "habitos-shell-v24"`. No `install` faz `self.skipWaiting()`; no `activate` deleta todos os caches com nome diferente de `CACHE` e chama `self.clients.claim()`. No `fetch`: deixa passar direto hosts que contenham `googleapis.com`, `firebaseio.com` ou `gstatic.com`, e métodos diferentes de GET; para o resto faz `fetch(req, { cache: "no-store" })`, clona a resposta para o cache em background e, se a rede falhar, responde com `caches.match(req)`. Isso garante versão fresca quando online e evita ficar preso em versão antiga após deploy. O SW é registrado por `index.html` no evento `load`.

Para invalidar caches antigos num deploy, é preciso **incrementar manualmente o nome do cache** (`habitos-shell-v24`) — o número é a versão efetiva do shell. Em rede lenta mas presente não há timeout: o app espera a rede em vez de servir o cache.

### Wake Lock

- **Padrão nas ferramentas (Pomodoro/Alongamento)**: variável de módulo `wakeLock`; `requestWakeLock()` faz `if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen')` em try/catch silencioso; `releaseWakeLock()` libera e zera. Como o browser solta o lock quando a aba perde visibilidade, um listener de `visibilitychange` readquire o lock ao voltar visível **e** com o timer ativo. O lock é pedido no start e liberado no stop/finish/reset/troca de usuário.
- **Wake Lock robusto no Status (`presence-page.js`)**: ligado por padrão (`wakeEnabled = true`), com três camadas: (1) `visibilitychange` readquire ao voltar; (2) **heartbeat** `setInterval(...12000ms)` repõe o lock se caiu silenciosamente; (3) **fallback NoSleep** — `ensureNoSleepVideo()` cria um `<canvas>` 2x2 que troca de cor a cada 1s e vira `captureStream(2)` alimentando um `<video>` mudo/loop/playsinline escondido (`opacity:0`, 1px), tocado por `playNoSleep()`, mantendo a tela acesa onde a Wake Lock API é instável (iPad/Safari). Reassina no evento `release` com `setTimeout(requestWakeLock, 400)`. `updateWakeUI()` atualiza o botão `#wake-toggle`; no `pagehide` cancela `unsub`, limpa o timer e solta o lock.

## Como adicionar uma nova página

Guia passo a passo, seguindo os padrões existentes:

1. **Criar `X.html` copiando a casca.** Comece de um HTML existente (ex.: `points.html`). Mantenha o script inline no `<head>` que lê `habitos-auth-uid` e aplica `auth-hidden`, o `<body class="is-loading">`, o `.auth-gate`, a `.topbar`, o `<nav id="nav-menu">`, o `<main class="page">` e as meta tags iOS. Importe seu módulo com `<script type="module" src="js/X-page.js">`.

2. **Criar `js/X-page.js`.** No `DOMContentLoaded`, chame `mountNavMenu()` e `setupAuthGate({ onAuthorized: (user) => initXPage(user) })`. Em `initXPage`, faça o render, chame `renderAuthFooter(user)` se quiser o rodapé, e no fim (ou num `finally`) remova `is-loading` do `<body>` para revelar a página.

3. **Storage, se precisar de dados novos.** Crie `js/X-storage.js` replicando o esqueleto dos storages existentes: constante de nome da coleção (`COL`), `keyOf`/doc ID, ramificação `if (isConfigured) { ...Firestore... } else { ...localStorage... }`, com `serverTimestamp()` no Firebase e ISO string no fallback. Se reaproveitar `days`/`transactions`/`config`, importe de `js/storage.js`.

4. **Adicionar o item no `NAV_ITEMS`.** Em `js/nav-menu.js`, inclua `{href:"X.html", icon:"…", label:"…", match:["X.html"]}` na posição desejada — o menu aparece em todas as páginas automaticamente.

5. **Estilos no `css/style.css`.** Reutilize os componentes existentes (`.block`, `.chip`, `.seg`, `.person-card` etc.) e as variáveis de `:root`. Se criar componentes próprios, use um prefixo de classe dedicado (como `.pom-*`, `.along-*`, `.kg-*`) e respeite o tema dark.

6. **Regra da coleção no Firestore.** Adicione o bloco da nova coleção nas regras do console do Firebase (mesmo modelo `allow read, write: if isCouple();`, e `docId.matches(...)` se o ID for determinístico). Lembre que as regras não estão versionadas no repositório.

## Referências

- **`README.md`** (189 linhas): guia prático de setup e deploy — rodar local sem Firebase (cai em modo localStorage), criar/configurar o projeto Firebase e colar chaves em `js/firebase-config.js`, criar o banco, publicar as regras, deploy no GitHub Pages, instalar como PWA (iPhone/Android), estrutura de pastas e modelo da coleção `days`.
- **`PROCESSO.md`** (524 linhas): história cronológica e arquitetura — decisões de stack, evolução v1→v2 (single-page 2 colunas), gamificação em runtime, split em páginas HTML, auth Google com whitelist, camadas da arquitetura, modelo de dados (`days`/`transactions`/`config`), regras atuais e lições aprendidas.

Nota: `README.md` e `PROCESSO.md` descrevem apenas `days`, `transactions` e `config`; as coleções adicionadas depois (`presence`, `weight_logs`, `diet_logs`, `pomodoro_sessions`, `pomodoro_config`, `stretch_sessions`) e os componentes CSS mais novos ainda não estão cobertos nesses documentos.
