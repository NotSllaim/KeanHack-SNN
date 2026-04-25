import { RefreshCw, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api.js";
import { FeedbackPanel } from "./FeedbackPanel.jsx";
import { RecorderButton } from "./RecorderButton.jsx";

export function ReadingPractice() {
  const [passage, setPassage] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [scores, setScores] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadPassage() {
    const data = await api("/reading/passage");
    setPassage(data.passage);
    setTranscript("");
    setFeedback(null);
    setScores(null);
  }

  useEffect(() => {
    loadPassage().catch((err) => setError(err.message));
  }, []);

  async function handleAudio(blob) {
    setBusy(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("audio", blob, "reading.webm");
      const data = await api("/voice/transcribe", { method: "POST", body: formData });
      setTranscript(data.text);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function analyze() {
    if (!passage || !transcript.trim()) {
      return;
    }

    setBusy(true);
    setError("");
    try {
      const data = await api("/reading/analyze", {
        method: "POST",
        body: JSON.stringify({ passage: passage.text, transcript })
      });
      setFeedback(data.feedback);
      setScores(data.scores);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="rounded-md border border-stone-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-ink">{passage?.title || "Reading Practice"}</h2>
          <button onClick={loadPassage} className="inline-flex h-10 items-center gap-2 rounded-md border border-stone-200 px-3 text-sm font-semibold text-stone-700 hover:border-meadow">
            <RefreshCw size={16} />
            New
          </button>
        </div>
        <p className="text-lg leading-9 text-stone-800">{passage?.text}</p>
      </div>

      <div className="rounded-md border border-stone-200 bg-white p-5">
        <label className="block">
          <span className="text-sm font-semibold text-stone-700">Transcript</span>
          <textarea
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
            rows={5}
            className="mt-2 w-full rounded-md border border-stone-300 px-4 py-3 outline-none focus:border-meadow"
            placeholder="Record your reading or paste a transcript here"
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <RecorderButton onAudio={handleAudio} disabled={busy} />
          <button onClick={analyze} disabled={busy || !transcript.trim()} className="inline-flex h-11 items-center gap-2 rounded-md bg-ink px-4 font-semibold text-white disabled:opacity-60">
            <Send size={17} />
            Analyze
          </button>
        </div>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <FeedbackPanel feedback={feedback} scores={scores} />
    </section>
  );
}

