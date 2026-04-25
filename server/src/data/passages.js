export const passages = [
  {
    id: "lantern",
    title: "The Lantern Room",
    text: "The lantern room overlooked a restless harbor, where every mast seemed to write its own uncertain sentence against the evening sky. Amelia paused before speaking, letting the silence gather shape, then read the captain's letter with deliberate calm."
  },
  {
    id: "observatory",
    title: "The Observatory",
    text: "Inside the observatory, the astronomer described a constellation so faint that it required patience, steadiness, and a willingness to notice what hurried people often miss. Each syllable carried the weight of discovery."
  },
  {
    id: "civic-hall",
    title: "Civic Hall",
    text: "The speaker rose in the crowded civic hall, aware that conviction alone would not persuade the room. She needed rhythm, restraint, and language sturdy enough to hold both doubt and hope."
  }
];

export function randomPassage() {
  return passages[Math.floor(Math.random() * passages.length)];
}

