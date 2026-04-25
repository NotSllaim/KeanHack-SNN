export const bots = [
  {
    id: "mira",
    name: "Mira",
    style: "Warm listener",
    description: "Encouraging, patient, and curious."
  },
  {
    id: "jax",
    name: "Jax",
    style: "Playful challenger",
    description: "Light, witty, and direct about missed chances."
  },
  {
    id: "sana",
    name: "Sana",
    style: "Thoughtful mentor",
    description: "Reflective, precise, and good at deeper questions."
  },
  {
    id: "theo",
    name: "Theo",
    style: "Interview coach",
    description: "Clear, practical, and focused on confident framing."
  }
];

export function findBot(botId) {
  return bots.find((bot) => bot.id === botId) || bots[0];
}
