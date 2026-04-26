export const companionSurveyQuestions = [
  {
    id: "struggle",
    prompt: "What do you struggle with?",
    allowMultiple: true,
    options: [
      { id: "small-talk", label: "Small talk" },
      { id: "about-yourself", label: "Talking about yourself" },
      { id: "listening", label: "Listening" },
      { id: "oversharing", label: "Oversharing" },
      { id: "ending", label: "Knowing when to end a conversation" }
    ]
  },
  {
    id: "awkward-situations",
    prompt: "What situations feel the most awkward for you?",
    allowMultiple: true,
    options: [
      { id: "new-people", label: "Meeting new people" },
      { id: "groups", label: "Group conversations" },
      { id: "one-on-one", label: "One-on-one conversations" },
      { id: "romantic", label: "Talking to someone you like" },
      { id: "professional", label: "Networking / professional conversations" }
    ]
  },
  {
    id: "worry",
    prompt: "What do you usually worry about during conversations?",
    allowMultiple: true,
    options: [
      { id: "running-out", label: "Running out of things to say" },
      { id: "boring", label: "Sounding boring" },
      { id: "weird", label: "Saying something weird" },
      { id: "judged", label: "Being judged" },
      { id: "amount", label: "Talking too much or too little" }
    ]
  },
  {
    id: "goal",
    prompt: "What would you most like to get better at?",
    allowMultiple: true,
    options: [
      { id: "confidence", label: "Being more confident" },
      { id: "funnier", label: "Being funnier" },
      { id: "keep-going", label: "Keeping conversations going" },
      { id: "friends", label: "Making friends" },
      { id: "dating", label: "Flirting / dating conversations" },
      { id: "clarity", label: "Speaking more clearly" }
    ]
  },
  {
    id: "silence",
    prompt: "When a conversation gets quiet, what usually happens?",
    options: [
      { id: "panic", label: "I panic" },
      { id: "random", label: "I ask random questions" },
      { id: "wait", label: "I wait for them to say something" },
      { id: "end", label: "I end the conversation" },
      { id: "fine", label: "I'm usually fine with silence" }
    ]
  },
  {
    id: "after-social",
    prompt: "How do you feel after most social interactions?",
    options: [
      { id: "energized", label: "Energized" },
      { id: "drained", label: "Drained" },
      { id: "overthinking", label: "Overthinking what I said" },
      { id: "proud", label: "Proud of myself" },
      { id: "unsure", label: "Unsure how it went" }
    ]
  },
  {
    id: "confidence",
    prompt: "What best describes your current social confidence?",
    options: [
      { id: "avoid", label: "I avoid conversations when I can" },
      { id: "nervous", label: "I can talk, but I get nervous" },
      { id: "once-starts", label: "I'm okay once the conversation starts" },
      { id: "pretty-confident", label: "I'm pretty confident" },
      { id: "improve", label: "I'm confident, but want to improve" }
    ]
  },
  {
    id: "self-description",
    prompt: "Pick the one that sounds most like you:",
    options: [
      { id: "start", label: "I never know how to start conversations." },
      { id: "comfortable", label: "I'm fine once I'm comfortable." },
      { id: "overthink", label: "I overthink everything I say." },
      { id: "talk-too-much", label: "I talk too much when I'm nervous." },
      { id: "interest", label: "I don't know how to keep people interested." }
    ]
  }
];
