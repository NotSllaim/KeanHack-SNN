import mongoose from "mongoose";

// Fallback passages in case MongoDB is unavailable
const fallbackPassages = [
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

export const passages = fallbackPassages;

export async function randomPassage() {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      console.warn("MongoDB not connected, using fallback passages");
      return fallbackPassages[Math.floor(Math.random() * fallbackPassages.length)];
    }

    // Get a random document from the ReadingTraining collection
    const collection = db.collection("ReadingTraining");
    const count = await collection.countDocuments();

    if (count === 0) {
      console.warn("No documents in ReadingTraining collection, using fallback passages");
      return fallbackPassages[Math.floor(Math.random() * fallbackPassages.length)];
    }

    // Pick a random index
    const randomIndex = Math.floor(Math.random() * count);
    const documents = await collection.find().skip(randomIndex).limit(1).toArray();

    if (documents.length === 0) {
      return fallbackPassages[Math.floor(Math.random() * fallbackPassages.length)];
    }

    const doc = documents[0];

    // Map MongoDB document to expected passage format
    // Adjust the field names based on your actual MongoDB schema
    return {
      id: doc._id?.toString() || "random",
      title: doc.title || "Reading Practice",
      text: doc.text || doc.passage || doc.content || ""
    };
  } catch (error) {
    console.error("Error fetching from MongoDB:", error);
    return fallbackPassages[Math.floor(Math.random() * fallbackPassages.length)];
  }
}

