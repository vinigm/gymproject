// ─────────────────────────────────────────────────────────────────────
//  DATAS DE INÍCIO POR CATEGORIA
// ---------------------------------------------------------------------
//  Quando você começou a registrar cada categoria de exercício.
//  Aparece nas Stats como "X dias desde DD de mês". Use YYYY-MM-DD.
//  Pra começar uma categoria do zero, basta atualizar a data aqui.
// ─────────────────────────────────────────────────────────────────────
export const CATEGORY_START_DATES = {
  academia: "2026-05-18",
  jiujitsu: "2026-06-08",
  pilates:  "2026-06-09",
};


// ─────────────────────────────────────────────────────────────────────
//  METADADOS DOS "OUTROS HÁBITOS"
// ---------------------------------------------------------------------
//  Lista de hábitos extras (chave + label + ícone). É a fonte de verdade
//  pra renderizar os chips dinamicamente. Usuário pode adicionar customs
//  pela página /config.html (vão pra coleção config/points como
//  `extras_custom`).
// ─────────────────────────────────────────────────────────────────────
export const DEFAULT_EXTRAS_META = [
  { key: "marmita",    label: "Marmita",     icon: "🍱" },
  { key: "vegetais",   label: "Vegetais",    icon: "🥗" },
  { key: "fruta",      label: "Fruta",       icon: "🍎" },
  { key: "cafe",       label: "Café manhã",  icon: "☕" },
  { key: "mercado",    label: "Mercado",     icon: "🛒" },
  { key: "escada",     label: "Escada",      icon: "🪜" },
  { key: "leitura",    label: "Leitura",     icon: "📚" },
  { key: "conversa",   label: "Conversa",    icon: "💬" },
  { key: "skincare",   label: "Skincare",    icon: "✨" },
  { key: "suplemento", label: "Suplemento",  icon: "💊" },
];

// Runtime mutável — começa como cópia dos defaults; applyExtrasCustom
// adiciona/atualiza com customs do usuário.
export const EXTRAS_META = JSON.parse(JSON.stringify(DEFAULT_EXTRAS_META));

// =====================================================================
//  CONFIGURAÇÃO DA GAMIFICAÇÃO
// ---------------------------------------------------------------------
//  Edite os valores deste arquivo pra mudar pontuação ou prêmios.
//  Salve, dê push no repo e a página de pontuação atualiza sozinha.
//  Nenhum outro arquivo do projeto precisa ser tocado.
// =====================================================================


// ─────────────────────────────────────────────────────────────────────
//  1) PONTOS POR HÁBITO (DEFAULTS)
// ─────────────────────────────────────────────────────────────────────
//  Esses valores são os "padrões". A página /config.html permite
//  sobrescrever ao vivo (salvo no Firestore em config/points).
//  Restaurar padrão na UI = volta pros valores abaixo.
// ─────────────────────────────────────────────────────────────────────
export const DEFAULT_POINTS = {

  // Pontos por TIPO de exercício feito (cada exercício marcado soma).
  exercises: {
    academia:    50,
    corrida:     70,
    yoga:        70,
    jiujitsu:    50,
    pilates:     50,  // mesma pontuação do jiu (Vivi)
    bicicleta:   50,
    alongamento:  0,  // pontos vêm do bloco stretch (depende da duração)
  },

  // Pontos por DURAÇÃO de alongamento (só conta se "alongamento" estiver
  // marcado nos exercícios). Sem duração marcada = 0 pontos.
  stretch: {
    "5":  15,
    "10": 30,
    "15": 45,
  },

  // Pontos pela QUANTIDADE de água marcada no dia.
  // Só uma das quatro opções é marcada por dia.
  water: {
    "0.5L":  5,
    "1L":   10,
    "1.5L": 15,
    "2L":   20,
  },

  // Pontos por REFEIÇÃO (almoço/janta).
  // limpo = positivo, sujo = negativo.
  meals: {
    lunch:  { limpo:  15, sujo: -15 },
    dinner: { limpo:  15, sujo: -15 },
  },

  // Pontos POR CIGARRO (multiplica pela quantidade marcada).
  // Marcar 4 cigarros com cigarettes = -15 → -60 pontos.
  cigarettes: -15,

  // Sobremesa: "nao" (dia sem açúcar refinado) = bônus. "sim" = neutro.
  dessert: {
    nao:  50,
    sim:   0,
  },

  // Refrigerante: "nao" (dia sem refri) = bônus. "sim" = penalidade.
  soda: {
    nao:  70,
    sim: -10,
  },

  // Outros hábitos (multi-select — cada um marcado independentemente).
  // Cada marcado no dia soma o valor abaixo.
  extras: {
    marmita:    80,   // marmita feita em casa
    vegetais:   40,   // comeu vegetais no almoço/janta
    fruta:      40,   // comeu fruta no café/lanche
    cafe:       10,   // café da manhã decente (não pulou)
    mercado:    30,   // compra de mercado feita com plano
    escada:     20,   // subiu escada em vez de elevador
    leitura:    10,   // leitura (não scroll) 15+ min
    conversa:   80,   // conversa em casal sem celular 30+ min
    skincare:   15,   // skincare manhã e/ou noite
    suplemento: 30,   // tomou suplemento
  },
};

// ─────────────────────────────────────────────────────────────────────
//  POINTS em runtime — começa como cópia profunda dos defaults.
//  applyPoints(override) faz merge sobrescrevendo só os campos do override.
//  A referência de POINTS NÃO muda — sempre é o mesmo objeto que outros
//  módulos importaram. Mutação no lugar.
// ─────────────────────────────────────────────────────────────────────
function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

export const POINTS = deepClone(DEFAULT_POINTS);

function applyAtPath(target, source) {
  for (const key of Object.keys(source || {})) {
    const v = source[key];
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      if (!target[key] || typeof target[key] !== "object") target[key] = {};
      applyAtPath(target[key], v);
    } else if (typeof v === "number") {
      target[key] = v;
    }
  }
}

export function applyPoints(override) {
  if (!override || typeof override !== "object") return;
  applyAtPath(POINTS, override);
}

export function resetPoints() {
  for (const k of Object.keys(POINTS)) delete POINTS[k];
  applyAtPath(POINTS, deepClone(DEFAULT_POINTS));
}

// Aplica customs do usuário (lista com { key, label, icon, points }).
// Pra cada item: atualiza EXTRAS_META (label/icon) e POINTS.extras (points).
export function applyExtrasCustom(customArr) {
  if (!Array.isArray(customArr)) return;
  for (const c of customArr) {
    if (!c || !c.key) continue;
    const idx = EXTRAS_META.findIndex(e => e.key === c.key);
    if (idx >= 0) {
      EXTRAS_META[idx] = {
        ...EXTRAS_META[idx],
        ...(c.label ? { label: c.label } : {}),
        ...(c.icon ? { icon: c.icon } : {}),
        custom: true,
      };
    } else {
      EXTRAS_META.push({
        key: c.key,
        label: c.label || c.key,
        icon: c.icon || "✨",
        custom: true,
      });
    }
    if (typeof c.points === "number") {
      POINTS.extras[c.key] = c.points;
    }
  }
}

// Restaura EXTRAS_META pros defaults (chamada antes de aplicar override)
export function resetExtrasMeta() {
  EXTRAS_META.length = 0;
  for (const e of DEFAULT_EXTRAS_META) {
    EXTRAS_META.push({ ...e });
  }
}


// ─────────────────────────────────────────────────────────────────────
//  2) PRÊMIOS / LOJINHA (defaults)
// ─────────────────────────────────────────────────────────────────────
//  Cada prêmio tem:
//    name        → nome que aparece no card
//    icon        → emoji
//    price       → custo em pontos
//    description → texto opcional, aparece em cinza
//
//  Lista padrão (do código). A página /config.html permite editar preços,
//  adicionar novos prêmios e remover customs. Customizações ficam em
//  config/points como rewards_shared / rewards_victoria.
// ─────────────────────────────────────────────────────────────────────
export const DEFAULT_REWARDS = [
  {
    name: "Date romântico",
    icon: "❤️",
    price: 1000,
    description: "Programa a dois caprichado",
  },
  {
    name: "Cinema",
    icon: "🎬",
    price: 1200,
    description: "Sessão + pipoca + bebida",
  },
  {
    name: "Aula experimental",
    icon: "🤸",
    price: 2000,
    description: "Escalada, dança, pilates, surf…",
  },
  {
    name: "Delivery (pizza ou pastel)",
    icon: "🍕",
    price: 2500,
    description: "Cabe pizza, pastel e afins",
  },
  {
    name: "Game Night com porcarias",
    icon: "🎮",
    price: 3000,
    description: "Noite de jogos + snacks proibidos",
  },
  {
    name: "Experiência",
    icon: "🎯",
    price: 4500,
    description: "Curso de cozinha saudável, yoga, tiro…",
  },
  {
    name: "Roupa de academia nova",
    icon: "👕",
    price: 5000,
    description: "Conjunto novo ou peça especial",
  },
  {
    name: "Massagem relaxante",
    icon: "💆",
    price: 6500,
    description: "Sessão individual",
  },
  {
    name: "Tênis novo de corrida",
    icon: "👟",
    price: 8000,
    description: "Ou equipamento maior de treino",
  },
  {
    name: "Final de semana de descanso",
    icon: "🏖️",
    price: 12000,
    description: "Pousada perto, sem agenda apertada",
  },
];


// ─────────────────────────────────────────────────────────────────────
//  3) RECOMPENSAS PESSOAIS DA VIVI (defaults)
// ─────────────────────────────────────────────────────────────────────
//  Itens que SÓ descontam da carteira pessoal da Vivi.
//  Mesma lógica: defaults aqui, customs em config/points (rewards_victoria).
//  Obs: as chaves internas (`victoria`, `personal-victoria`) ficam como
//  estão pra não invalidar dados antigos no Firestore.
// ─────────────────────────────────────────────────────────────────────
export const DEFAULT_REWARDS_VICTORIA = [
  {
    name: "Esmalte novo",
    icon: "💅",
    price: 300,
    description: "Cor nova que ela tava de olho",
  },
  {
    name: "Manicure",
    icon: "💖",
    price: 500,
    description: "Sessão completa",
  },
  {
    name: "Skincare especial",
    icon: "🧴",
    price: 800,
    description: "Algum produto bom que ela quer",
  },
  {
    name: "Livro novo",
    icon: "📖",
    price: 600,
    description: "Físico, daqueles bonitos",
  },
  {
    name: "Roupa nova",
    icon: "👗",
    price: 1500,
    description: "Algo legal que ela ver",
  },
  {
    name: "Bolsa / acessório",
    icon: "👜",
    price: 2500,
    description: "Item maior",
  },
];


// ─────────────────────────────────────────────────────────────────────
//  RUNTIME — REWARDS / REWARDS_VICTORIA (mutáveis pela UI de config)
// ─────────────────────────────────────────────────────────────────────
//  Começam como cópia dos defaults. A página /config.html permite editar
//  o preço dos defaults e adicionar/remover customs. As mudanças vão
//  pro Firestore em config/points como rewards_shared / rewards_victoria.
// ─────────────────────────────────────────────────────────────────────
export const REWARDS = JSON.parse(JSON.stringify(DEFAULT_REWARDS));
export const REWARDS_VICTORIA = JSON.parse(JSON.stringify(DEFAULT_REWARDS_VICTORIA));

function applyRewardsScope(runtime, defaults, savedList) {
  runtime.length = 0;
  const overrideByName = new Map();
  for (const item of (savedList || [])) {
    if (item && !item.custom) overrideByName.set(item.name, item);
  }
  for (const def of defaults) {
    const ov = overrideByName.get(def.name);
    runtime.push(ov ? { ...def, ...ov } : { ...def });
  }
  for (const item of (savedList || [])) {
    if (item?.custom) runtime.push({ ...item });
  }
}

// override é o objeto completo carregado do Firestore.
// Lê rewards_shared e rewards_victoria.
export function applyRewardsFromOverride(override) {
  applyRewardsScope(REWARDS, DEFAULT_REWARDS, override?.rewards_shared);
  applyRewardsScope(REWARDS_VICTORIA, DEFAULT_REWARDS_VICTORIA, override?.rewards_victoria);
}

export function resetRewards() {
  applyRewardsScope(REWARDS, DEFAULT_REWARDS, []);
  applyRewardsScope(REWARDS_VICTORIA, DEFAULT_REWARDS_VICTORIA, []);
}
