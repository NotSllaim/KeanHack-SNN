import { RefreshCw, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../state/AuthContext.jsx";
import { analyzeReadingAudio } from "../utils/audioAnalysis.js";
import { FeedbackPanel } from "./FeedbackPanel.jsx";
import { LiveTranscriptPanel } from "./LiveTranscriptPanel.jsx";
import { RecorderButton } from "./RecorderButton.jsx";

export function VerbiageTraining() {
  const { user, updateUser } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [recording, setRecording] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [scores, setScores] = useState(null);
  const [audioMetrics, setAudioMetrics] = useState(null);
  const [xpNotice, setXpNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadPrompt() {
    const data = await api("/verbiage/prompt");
    setPrompt(data.prompt);
    setResponse("");
    setLiveTranscript("");
    setFeedback(null);
    setScores(null);
    setXpNotice(null);
    setAudioMetrics(null);
  }

  useEffect(() => {
    loadPrompt().catch((err) => setError(err.message));
  }, []);

  async function handleAudio(blob) {
    setBusy(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("audio", blob, "verbiage.webm");
      const data = await api("/voice/transcribe", { method: "POST", body: formData });
      setResponse(data.text);
      setLiveTranscript("");
      const metrics = await analyzeReadingAudio(blob, data.text, user.profile?.micCalibration);
      setAudioMetrics(metrics);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function analyze() {
    if (!prompt || !response.trim()) {
      return;
    }

    setBusy(true);
    setError("");
    try {
      const data = await api("/verbiage/analyze", {
        method: "POST",
        body: JSON.stringify({ prompt, response, audioMetrics })
      });
      setFeedback(data.feedback);
      setScores(data.scores);
      setXpNotice(data.xp || null);
      updateUser(data.user);
      notifyHistoryUpdated();
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
          <h2 className="text-xl font-bold text-ink">Verbiage Training</h2>
          <button onClick={loadPrompt} className="inline-flex h-10 items-center gap-2 rounded-md border border-stone-200 px-3 text-sm font-semibold text-stone-700 hover:border-meadow">
            <RefreshCw size={16} />
            New
          </button>
        </div>
        <p className="rounded-md bg-skyglass px-4 py-3 text-stone-800">{prompt}</p>
      </div>

      <div className="rounded-md border border-stone-200 bg-white p-5">
        <label className="block">
          <span className="text-sm font-semibold text-stone-700">Your response</span>
          <textarea
            value={response}
            onChange={(event) => setResponse(event.target.value)}
            rows={6}
            className="mt-2 w-full rounded-md border border-stone-300 px-4 py-3 outline-none focus:border-meadow"
            placeholder="Respond by typing or speaking"
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <RecorderButton
            onAudio={handleAudio}
            disabled={busy}
            onLiveTranscript={setLiveTranscript}
            onRecordingChange={setRecording}
          />
          <button onClick={analyze} disabled={busy || !response.trim()} className="inline-flex h-11 items-center gap-2 rounded-md bg-ink px-4 font-semibold text-white disabled:opacity-60">
            <Send size={17} />
            Analyze
          </button>
        </div>
      </div>

      <LiveTranscriptPanel
        transcript={liveTranscript}
        label={recording ? "Live response transcript" : "Latest live transcript"}
      />

      {feedback?.highlights?.length > 0 && (
        <section className="rounded-md border border-stone-200 bg-white p-5">
          <h3 className="mb-3 font-bold text-ink">Phrase notes</h3>
          <div className="space-y-3">
            {feedback.highlights.map((item, index) => (
              <div key={`${item.text}-${index}`} className="rounded-md border border-stone-200 p-3">
                <p className="font-semibold text-coral">"{item.text}"</p>
                <p className="mt-1 text-sm text-stone-700">{item.reason}</p>
                <p className="mt-2 text-sm font-medium text-meadow">{item.suggestion}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {xpNotice && (
        <div className="rounded-md border border-meadow bg-green-50 px-3 py-2 text-sm font-semibold text-meadow">
          +{xpNotice.awarded} XP{xpNotice.leveledUp ? " - companion leveled up" : ""}
        </div>
      )}
      <FeedbackPanel feedback={feedback} scores={scores} />
    </section>
  );
}

function notifyHistoryUpdated() {
  window.dispatchEvent(new Event("lingo:history-updated"));
}

