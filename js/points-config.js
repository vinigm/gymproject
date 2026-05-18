// =====================================================================
//  CONFIGURAÇÃO DA GAMIFICAÇÃO
// ---------------------------------------------------------------------
//  Edite os valores deste arquivo pra mudar pontuação ou prêmios.
//  Salve, dê push no repo e a página de pontuação atualiza sozinha.
//  Nenhum outro arquivo do projeto precisa ser tocado.
// =====================================================================


// ─────────────────────────────────────────────────────────────────────
//  1) PONTOS POR HÁBITO
// ─────────────────────────────────────────────────────────────────────
//  Cada chip clicado/marcado em um dia soma (ou subtrai) pontos.
//  Use números negativos pra penalizar.
// ─────────────────────────────────────────────────────────────────────
export const POINTS = {

  // Pontos por TIPO de exercício feito (cada exercício marcado soma).
  exercises: {
    academia:  50,
    corrida:   70,
    yoga:      70,
    jiujitsu:  50,
    bicicleta: 50,
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
//  2) PRÊMIOS / LOJINHA
// ─────────────────────────────────────────────────────────────────────
//  Cada prêmio tem:
//    name        → nome que aparece no card
//    icon        → emoji
//    price       → custo em pontos (NOTA: por enquanto a página mostra
//                  como meta acumulada. O modelo de carteira/loja com
//                  botão de comprar vai vir numa próxima atualização.)
//    description → texto opcional, aparece em cinza
//
//  Pra desativar um prêmio temporariamente, comenta a linha com `//`.
// ─────────────────────────────────────────────────────────────────────
export const REWARDS = [
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
//  3) RECOMPENSAS PESSOAIS DA VICTORIA
// ─────────────────────────────────────────────────────────────────────
//  Itens que SÓ descontam da carteira pessoal da Vic.
//  Os pontos ganhos por ela contam pro saldo pessoal E pro saldo conjunto
//  (futuro), mas quando ela compra algo aqui, só o saldo pessoal cai.
//  Edite essa lista com o que ela quiser comprar.
// ─────────────────────────────────────────────────────────────────────
export const REWARDS_VICTORIA = [
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
