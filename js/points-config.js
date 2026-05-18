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

  // Pontos por TIPO de exercício feito.
  // Cada exercício marcado no dia soma o valor abaixo.
  // Ex.: marcar Academia + Corrida no mesmo dia = 10 + 10 = 20 pts.
  exercises: {
    academia:  10,
    corrida:   10,
    yoga:       8,
    jiujitsu:  12,
    bicicleta: 10,
  },

  // Pontos pela QUANTIDADE de água marcada no dia.
  // Só uma das três opções é marcada por dia.
  water: {
    "1L":    5,
    "1.5L":  8,
    "2L":   10,
  },

  // Pontos por REFEIÇÃO (almoço/janta).
  // limpo = positivo, sujo = negativo.
  meals: {
    lunch:  { limpo:  5, sujo: -5 },
    dinner: { limpo:  5, sujo: -5 },
  },

  // Pontos POR CIGARRO (multiplica pela quantidade marcada).
  // Marcar 0 cigarros = 0 pontos (nem soma nem perde).
  // Marcar 4 cigarros com cigarettes = -3  → -12 pontos.
  cigarettes: -3,
};


// ─────────────────────────────────────────────────────────────────────
//  2) PRÊMIOS / METAS
// ─────────────────────────────────────────────────────────────────────
//  Cada prêmio tem:
//    name        → nome que aparece no card
//    icon        → emoji (ou string vazia)
//    target      → pontos necessários
//    period      → "weekly"  (semana atual: segunda → hoje)
//                   "monthly" (mês atual: dia 1 → hoje)
//                   "all"     (acumulado desde o início)
//    description → texto opcional, aparece em cinza embaixo do nome
//
//  Os pontos somados são SEMPRE Vinicius + Victoria (combinados).
//  Pra desativar um prêmio temporariamente, basta comentar a linha
//  com `//` no início.
// ─────────────────────────────────────────────────────────────────────
export const REWARDS = [
  {
    name: "Pizza",
    icon: "🍕",
    target: 100,
    period: "weekly",
    description: "Sexta-feira da pizza",
  },
  {
    name: "Sushi",
    icon: "🍣",
    target: 200,
    period: "weekly",
    description: "Rodízio ou delivery bom",
  },
  {
    name: "Cinema",
    icon: "🎬",
    target: 400,
    period: "monthly",
    description: "Sessão + pipoca + bebida",
  },
  {
    name: "Jantar romântico",
    icon: "🍽️",
    target: 800,
    period: "monthly",
    description: "Restaurante caprichado",
  },
  {
    name: "Viagem de fim de semana",
    icon: "✈️",
    target: 3000,
    period: "all",
    description: "Acumula desde o início — vai pesando",
  },
];
