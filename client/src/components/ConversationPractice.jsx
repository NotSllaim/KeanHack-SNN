import { Bot, Send, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api, playAudio } from "../api.js";
import { FeedbackPanel } from "./FeedbackPanel.jsx";
import { RecorderButton } from "./RecorderButton.jsx";

export function ConversationPractice() {
  const [bots, setBots] = useState([]);
  const [botId, setBotId] = useState("mira");
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Pick a conversation partner and tell me what has been on your mind lately." }
  ]);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [scores, setScores] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/conversation/bots").then((data) => setBots(data.bots)).catch((err) => setError(err.message));
  }, []);

  async function submitMessage(message) {
    if (!message.trim()) {
      return;
    }

    const nextMessages = [...messages, { role: "user", content: message }];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);
    setError("");

    try {
      const data = await api("/conversation/turn", {
        method: "POST",
        body: JSON.stringify({ botId, message, history: messages })
      });

      setMessages([
        ...nextMessages,
        { role: "assistant", content: data.botReply, thoughtBubble: data.thoughtBubble }
      ]);
      setFeedback({ ...data.feedback, thoughtBubble: data.thoughtBubble });
      setScores(data.scores);
      playAudio(data.speech);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAudio(blob) {
    setBusy(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("audio", blob, "response.webm");
      const data = await api("/voice/transcribe", { method: "POST", body: formData });
      setInput(data.text);
      await submitMessage(data.text);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[280px_1fr]">
      <div className="rounded-md border border-stone-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <Bot size={18} className="text-meadow" />
          <h2 className="font-bold text-ink">Conversation Partner</h2>
        </div>
        <div className="space-y-2">
          {bots.map((bot) => (
            <button
              key={bot.id}
              onClick={() => setBotId(bot.id)}
              className={`w-full rounded-md border px-3 py-3 text-left transition ${
                botId === bot.id ? "border-meadow bg-green-50" : "border-stone-200 hover:border-meadow"
              }`}
            >
              <span className="block font-semibold text-ink">{bot.name}</span>
              <span className="block text-sm text-stone-500">{bot.style}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-5">
        <section className="rounded-md border border-stone-200 bg-white">
          <div className="h-[520px] overflow-y-auto p-5">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={message.role === "user" ? "text-right" : "text-left"}>
                  <div
                    className={`inline-block max-w-[82%] rounded-md px-4 py-3 text-sm leading-6 ${
                      message.role === "user" ? "bg-ink text-white" : "bg-skyglass text-ink"
                    }`}
                  >
                    {message.content}
                  </div>
                  {message.thoughtBubble && (
                    <div className="mt-2 inline-block max-w-[72%] rounded-md border border-dashed border-coral bg-orange-50 px-3 py-2 text-xs text-stone-700">
                      {message.thoughtBubble}
                    </div>
                  )}
                </div>
              ))}
              {busy && <p className="text-sm text-stone-500">Thinking...</p>}
            </div>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitMessage(input);
            }}
            className="flex flex-col gap-3 border-t border-stone-200 p-4 md:flex-row"
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Type a response or speak into the mic"
              className="min-h-11 flex-1 rounded-md border border-stone-300 px-4 outline-none focus:border-meadow"
            />
            <div className="flex gap-2">
              <RecorderButton onAudio={handleAudio} disabled={busy} />
              <button
                disabled={busy}
                className="inline-flex h-11 items-center gap-2 rounded-md bg-ink px-4 font-semibold text-white disabled:opacity-60"
              >
                <Send size={17} />
                Send
              </button>
            </div>
          </form>
        </section>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {feedback?.thoughtBubble && (
          <div className="inline-flex items-center gap-2 rounded-md bg-orange-50 px-3 py-2 text-sm text-stone-700">
            <Volume2 size={16} className="text-coral" />
            Internal reaction: {feedback.thoughtBubble}
          </div>
        )}
        <FeedbackPanel feedback={feedback} scores={scores} />
      </div>
    </section>
  );
}

