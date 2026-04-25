export const companionElements = {
  fire: {
    id: "fire",
    name: "Fire",
    description: "Bold, expressive, energetic, and ready to lead conversations."
  },
  water: {
    id: "water",
    name: "Water",
    description: "Thoughtful, empathetic, reflective, and emotionally aware."
  },
  leaf: {
    id: "leaf",
    name: "Leaf",
    description: "Gentle, patient, sincere, and growing into steadier confidence."
  },
  lightning: {
    id: "lightning",
    name: "Lightning",
    description: "Playful, curious, quick-thinking, and full of social spark."
  }
};

export const companionSurveyQuestions = [
  {
    id: "struggle",
    prompt: "What do you struggle with?",
    allowMultiple: true,
    options: [
      { id: "small-talk", label: "Small talk", scores: { lightning: 3, leaf: 1 } },
      { id: "about-yourself", label: "Talking about yourself", scores: { leaf: 3, water: 1 } },
      { id: "listening", label: "Listening", scores: { water: 3, fire: 1 } },
      { id: "oversharing", label: "Oversharing", scores: { fire: 3, lightning: 1 } },
      { id: "ending", label: "Knowing when to end a conversation", scores: { water: 2, leaf: 1, lightning: 1 } }
    ]
  },
  {
    id: "awkward-situations",
    prompt: "What situations feel the most awkward for you?",
    allowMultiple: true,
    options: [
      { id: "new-people", label: "Meeting new people", scores: { leaf: 3, lightning: 1 } },
      { id: "groups", label: "Group conversations", scores: { fire: 2, leaf: 1 } },
      { id: "one-on-one", label: "One-on-one conversations", scores: { water: 3 } },
      { id: "romantic", label: "Talking to someone you like", scores: { water: 2, leaf: 1 } },
      { id: "professional", label: "Networking / professional conversations", scores: { fire: 3, lightning: 1 } }
    ]
  },
  {
    id: "worry",
    prompt: "What do you usually worry about during conversations?",
    allowMultiple: true,
    options: [
      { id: "running-out", label: "Running out of things to say", scores: { leaf: 2, lightning: 2 } },
      { id: "boring", label: "Sounding boring", scores: { lightning: 3 } },
      { id: "weird", label: "Saying something weird", scores: { water: 2, leaf: 1 } },
      { id: "judged", label: "Being judged", scores: { water: 3, leaf: 1 } },
      { id: "amount", label: "Talking too much or too little", scores: { fire: 2, lightning: 1 } }
    ]
  },
  {
    id: "goal",
    prompt: "What would you most like to get better at?",
    allowMultiple: true,
    options: [
      { id: "confidence", label: "Being more confident", scores: { fire: 3 } },
      { id: "funnier", label: "Being funnier", scores: { lightning: 3 } },
      { id: "keep-going", label: "Keeping conversations going", scores: { lightning: 2, water: 1 } },
      { id: "friends", label: "Making friends", scores: { leaf: 2, water: 1 } },
      { id: "dating", label: "Flirting / dating conversations", scores: { fire: 2, lightning: 1 } },
      { id: "clarity", label: "Speaking more clearly", scores: { water: 3 } }
    ]
  },
  {
    id: "silence",
    prompt: "When a conversation gets quiet, what usually happens?",
    options: [
      { id: "panic", label: "I panic", scores: { leaf: 3 } },
      { id: "random", label: "I ask random questions", scores: { lightning: 3 } },
      { id: "wait", label: "I wait for them to say something", scores: { water: 2, leaf: 1 } },
      { id: "end", label: "I end the conversation", scores: { leaf: 2, fire: 1 } },
      { id: "fine", label: "I'm usually fine with silence", scores: { water: 3, fire: 1 } }
    ]
  },
  {
    id: "after-social",
    prompt: "How do you feel after most social interactions?",
    options: [
      { id: "energized", label: "Energized", scores: { fire: 3, lightning: 1 } },
      { id: "drained", label: "Drained", scores: { leaf: 2, water: 1 } },
      { id: "overthinking", label: "Overthinking what I said", scores: { water: 3 } },
      { id: "proud", label: "Proud of myself", scores: { fire: 2, water: 1 } },
      { id: "unsure", label: "Unsure how it went", scores: { leaf: 2, water: 1 } }
    ]
  },
  {
    id: "confidence",
    prompt: "What best describes your current social confidence?",
    options: [
      { id: "avoid", label: "I avoid conversations when I can", scores: { leaf: 3 } },
      { id: "nervous", label: "I can talk, but I get nervous", scores: { leaf: 2, water: 1 } },
      { id: "once-starts", label: "I'm okay once the conversation starts", scores: { water: 1, lightning: 1 } },
      { id: "pretty-confident", label: "I'm pretty confident", scores: { fire: 3 } },
      { id: "improve", label: "I'm confident, but want to improve", scores: { fire: 1, lightning: 2 } }
    ]
  },
  {
    id: "self-description",
    prompt: "Pick the one that sounds most like you:",
    options: [
      { id: "start", label: "I never know how to start conversations.", scores: { leaf: 3 } },
      { id: "comfortable", label: "I'm fine once I'm comfortable.", scores: { water: 2, leaf: 1 } },
      { id: "overthink", label: "I overthink everything I say.", scores: { water: 3 } },
      { id: "talk-too-much", label: "I talk too much when I'm nervous.", scores: { lightning: 3, fire: 1 } },
      { id: "interest", label: "I don't know how to keep people interested.", scores: { lightning: 3 } }
    ]
  }
];

export function assignCompanionElement(answers = {}) {
  const totals = { fire: 0, water: 0, leaf: 0, lightning: 0 };
  const questionCounts = { fire: 0, water: 0, leaf: 0, lightning: 0 };

  for (const question of companionSurveyQuestions) {
    const answerIds = normalizeAnswerIds(answers[question.id]);
    const selectedOptions = question.options.filter((item) => answerIds.includes(item.id));
    if (!selectedOptions.length) {
      continue;
    }

    const questionTotals = { fire: 0, water: 0, leaf: 0, lightning: 0 };
    for (const option of selectedOptions) {
      for (const [element, score] of Object.entries(option.scores)) {
        questionTotals[element] += score / selectedOptions.length;
      }
    }

    for (const element of Object.keys(totals)) {
      totals[element] += questionTotals[element];
      if (questionTotals[element] > 0) {
        questionCounts[element] += 1;
      }
    }
  }

  const balancedTotals = Object.fromEntries(
    Object.entries(totals).map(([element, score]) => {
      const varietyBoost = questionCounts[element] * 0.22;
      return [element, Number((score + varietyBoost).toFixed(3))];
    })
  );

  const elements = ["fire", "water", "leaf", "lightning"];
  const elementId = elements[stableTieBreaker(answers) % elements.length];

  return {
    ...companionElements[elementId],
    scores: balancedTotals
  };
}

export function hasCompleteSurvey(answers = {}) {
  return companionSurveyQuestions.every((question) => {
    const answerIds = normalizeAnswerIds(answers[question.id]);
    return answerIds.length > 0 && answerIds.every((answerId) => question.options.some((option) => option.id === answerId));
  });
}

function normalizeAnswerIds(answer) {
  if (Array.isArray(answer)) {
    return answer.filter(Boolean);
  }

  return answer ? [answer] : [];
}

function stableTieBreaker(answers) {
  const text = JSON.stringify(answers);
  let hash = 2166136261;
  for (const character of text) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
