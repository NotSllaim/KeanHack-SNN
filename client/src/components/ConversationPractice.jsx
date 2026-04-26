import { Bot, Radio, Send, Square, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, playAudio } from "../api.js";
import { useAuth } from "../state/AuthContext.jsx";
import { FeedbackPanel } from "./FeedbackPanel.jsx";
import { RecorderButton } from "./RecorderButton.jsx";

const fallbackOpening = "Pick a conversation partner and tell me what has been on your mind lately.";

export function ConversationPractice() {
  const { updateUser } = useAuth();
  const [bots, setBots] = useState([]);
  const [botId, setBotId] = useState("sana");
  const [messages, setMessages] = useState([
    { role: "assistant", content: fallbackOpening }
  ]);
  const [input, setInput] = useState("");
  const [liveActive, setLiveActive] = useState(false);
  const [livePhase, setLivePhase] = useState("idle");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [liveFinalTranscript, setLiveFinalTranscript] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [scores, setScores] = useState(null);
  const [aiDebug, setAiDebug] = useState(null);
  const [xpNotice, setXpNotice] = useState(null);
  const [conversationReport, setConversationReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const messagesRef = useRef(messages);
  const liveActiveRef = useRef(false);
  const liveFinalTranscriptRef = useRef("");
  const recognitionRef = useRef(null);
  const selectedBot = bots.find((bot) => bot.id === botId);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    api("/conversation/bots").then((data) => setBots(data.bots)).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!selectedBot || liveActive) {
      return;
    }

    setMessages([{ role: "assistant", content: selectedBot.opener || fallbackOpening }]);
    setFeedback(null);
    setScores(null);
    setConversationReport(null);
  }, [botId, selectedBot, liveActive]);

  useEffect(() => {
    return () => stopLiveChat({ showReport: false });
  }, []);

  async function submitMessage(message, options = {}) {
    if (!message.trim()) {
      return;
    }

    const currentMessages = options.history || messagesRef.current;
    const nextMessages = [...currentMessages, { role: "user", content: message }];
    setMessages(nextMessages);
    messagesRef.current = nextMessages;
    setInput("");
    setAiDebug(null);
    setConversationReport(null);
    setBusy(true);
    setError("");

    try {
      const data = await api("/conversation/turn", {
        method: "POST",
        body: JSON.stringify({ botId, message, history: currentMessages, includeSpeech: Boolean(options.speak) })
      });

      const updatedMessages = [
        ...nextMessages,
        { role: "assistant", content: data.botReply, thoughtBubble: data.thoughtBubble }
      ];
      setMessages(updatedMessages);
      messagesRef.current = updatedMessages;
      setFeedback({ ...data.feedback, thoughtBubble: data.thoughtBubble });
      setScores(data.scores);
      setAiDebug(data.aiDebug || null);
      setXpNotice(data.xp || null);
      updateUser(data.user);
      if (options.speak) {
        setLivePhase("ai-speaking");
        await playAudio(data.speech);
      }

      if (options.continueLive && liveActiveRef.current) {
        startListening();
      }
    } catch (err) {
      setError(err.message);
      if (options.continueLive) {
        stopLiveChat({ showReport: false });
      }
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

  async function startLiveChat() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Live chat transcription is not supported in this browser. Chrome or Edge works best for this feature.");
      return;
    }

    const opening = selectedBot?.opener || fallbackOpening;
    const openingMessages = [{ role: "assistant", content: opening }];
    liveActiveRef.current = true;
    setLiveActive(true);
    setLiveTranscript("");
    setLiveFinalTranscript("");
    setFeedback(null);
    setScores(null);
    setAiDebug(null);
    setXpNotice(null);
    setConversationReport(null);
    setError("");
    setMessages(openingMessages);
    messagesRef.current = openingMessages;
    setBusy(true);

    try {
      setLivePhase("ai-speaking");
      const speech = await api("/voice/speak", {
        method: "POST",
        body: JSON.stringify({ text: opening, botId })
      });
      await playAudio(speech);
      if (liveActiveRef.current) {
        startListening();
      }
    } catch (err) {
      setError(err.message);
      stopLiveChat({ showReport: false });
    } finally {
      setBusy(false);
    }
  }

  function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition || !liveActiveRef.current) {
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    setLivePhase("listening");
    setLiveTranscript("");
    setLiveFinalTranscript("");
    liveFinalTranscriptRef.current = "";

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0].transcript;
        if (event.results[index].isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }

      setLiveTranscript(`${finalText} ${interimText}`.trim());
      if (finalText.trim()) {
        const nextFinalTranscript = `${liveFinalTranscriptRef.current} ${finalText}`.trim();
        liveFinalTranscriptRef.current = nextFinalTranscript;
        setLiveFinalTranscript(nextFinalTranscript);
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== "no-speech") {
        setError(`Live transcription error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      const finalMessage = liveFinalTranscriptRef.current.trim();
      recognitionRef.current = null;

      if (!liveActiveRef.current) {
        return;
      }

      if (!finalMessage) {
        startListening();
        return;
      }

      setLivePhase("thinking");
      submitMessage(finalMessage, {
        history: messagesRef.current,
        speak: true,
        continueLive: true
      });
    };

    recognition.start();
  }

  useEffect(() => {
    liveFinalTranscriptRef.current = liveFinalTranscript;
  }, [liveFinalTranscript]);

  function stopLiveChat({ showReport = true } = {}) {
    const report = showReport ? buildConversationReport(messagesRef.current) : null;
    liveActiveRef.current = false;
    setLiveActive(false);
    setLivePhase("idle");
    setLiveTranscript("");
    setLiveFinalTranscript("");
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (report) {
      setConversationReport(report);
    }
  }

  const liveText = liveTranscript || liveFinalTranscript;
  const liveFillers = findFillers(liveText);
  const liveWordCount = liveText.trim() ? liveText.trim().split(/\s+/).length : 0;

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
              onClick={() => {
                if (!liveActive) {
                  setBotId(bot.id);
                }
              }}
              disabled={liveActive}
              className={`w-full rounded-md border px-3 py-3 text-left transition ${
                botId === bot.id ? "border-meadow bg-green-50" : "border-stone-200 hover:border-meadow"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <span className="block font-semibold text-ink">{bot.name}</span>
              <span className="block text-sm text-stone-500">{bot.style}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-stone-200 bg-white p-4">
          <div>
            <p className="text-sm font-semibold text-meadow">Live chat</p>
            <p className="text-sm text-stone-600">
              {liveActive ? `Status: ${formatLivePhase(livePhase)}` : "Hands-free speaking practice with live transcription."}
            </p>
          </div>
          {liveActive ? (
            <button
              type="button"
              onClick={stopLiveChat}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-coral px-4 font-semibold text-white"
            >
              <Square size={17} />
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={startLiveChat}
              disabled={busy}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-meadow px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Radio size={17} />
              Enter live chat
            </button>
          )}
        </div>

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
          {liveActive ? (
            <div className="border-t border-stone-200 p-4">
              <div className="rounded-md border border-meadow bg-green-50 p-4">
                <p className="mb-2 text-xs font-bold uppercase text-meadow">Live transcript</p>
                <p className="min-h-16 text-lg font-semibold leading-7 text-ink">
                  {liveText || (livePhase === "listening" ? "Listening..." : "Waiting for the AI to finish speaking...")}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded bg-white px-2 py-1 text-stone-600">Words: {liveWordCount}</span>
                  <span className="rounded bg-white px-2 py-1 text-stone-600">Filler words: {liveFillers.length}</span>
                  {liveFillers.slice(0, 4).map((word, index) => (
                    <span key={`${word}-${index}`} className="rounded bg-orange-100 px-2 py-1 text-coral">
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
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
          )}
        </section>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {aiDebug?.source === "fallback" && (
          <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-stone-700">
            AI fallback used: {aiDebug.reason}. Check the server terminal for `[AI debug]` details.
          </div>
        )}
        {xpNotice && (
          <div className="rounded-md border border-meadow bg-green-50 px-3 py-2 text-sm font-semibold text-meadow">
            +{xpNotice.awarded} XP{xpNotice.leveledUp ? " - companion leveled up" : ""}
          </div>
        )}
        {conversationReport && <ConversationReport report={conversationReport} />}
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

function findFillers(text) {
  return [...text.matchAll(/\b(uh|um|uhm|like|you know|sort of|kind of)\b/gi)].map((match) => match[0]);
}

function formatLivePhase(phase) {
  return {
    idle: "Idle",
    "ai-speaking": "AI speaking",
    listening: "Listening",
    thinking: "Thinking"
  }[phase] || phase;
}

function buildConversationReport(messages) {
  const userTurns = messages.filter((message) => message.role === "user");
  if (!userTurns.length) {
    return null;
  }

  const notes = [];
  const fillerInstances = [];
  let positiveAdds = 0;

  userTurns.forEach((turn, index) => {
    const text = turn.content || "";
    const words = text.trim().split(/\s+/).filter(Boolean);
    const fillers = findFillers(text);
    const previousAssistant = findPreviousAssistant(messages, turn);
    const offTrack = previousAssistant && !hasTopicOverlap(previousAssistant.content, text);
    const askedQuestion = /[?]|\b(what|how|why|when|where|who|which)\b/i.test(text);
    const addedDetail = words.length >= 14;

    fillers.forEach((word) => {
      fillerInstances.push({ word, turn: index + 1 });
    });

    if (fillers.length) {
      notes.push(`Turn ${index + 1}: ${fillers.length} filler word${fillers.length === 1 ? "" : "s"} (${fillers.join(", ")}).`);
    }

    if (words.length < 8) {
      notes.push(`Turn ${index + 1}: the response was very short, so it gave the other person less to build on.`);
    }

    if (offTrack) {
      notes.push(`Turn ${index + 1}: this may have drifted from what the bot asked. Try answering the prompt first, then adding your own detail.`);
    }

    if (!askedQuestion && !addedDetail) {
      notes.push(`Turn ${index + 1}: you could add something positive by giving a detail, asking a follow-up, or naming how you felt.`);
    } else {
      positiveAdds += 1;
    }
  });

  const totalWords = userTurns.reduce((sum, turn) => sum + turn.content.trim().split(/\s+/).filter(Boolean).length, 0);
  const fillerPenalty = Math.min(30, fillerInstances.length * 5);
  const shortPenalty = userTurns.filter((turn) => turn.content.trim().split(/\s+/).filter(Boolean).length < 8).length * 8;
  const contributionScore = Math.round((positiveAdds / userTurns.length) * 100);
  const score = Math.max(40, Math.min(100, contributionScore - fillerPenalty - shortPenalty + 12));

  return {
    score,
    totalTurns: userTurns.length,
    totalWords,
    fillerInstances,
    notes: notes.length ? notes : ["You kept the conversation moving without obvious filler-heavy or very short turns."],
    positiveAdds
  };
}

function findPreviousAssistant(messages, userTurn) {
  const index = messages.indexOf(userTurn);
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (messages[cursor].role === "assistant") {
      return messages[cursor];
    }
  }
  return null;
}

function hasTopicOverlap(prompt = "", response = "") {
  const promptWords = significantWords(prompt);
  const responseWords = significantWords(response);

  if (!promptWords.length || !responseWords.length) {
    return true;
  }

  return responseWords.some((word) => promptWords.includes(word));
}

function significantWords(text) {
  const stopWords = new Set([
    "about", "after", "again", "could", "would", "there", "their", "thing", "things", "that", "this", "with",
    "what", "when", "where", "which", "your", "you", "the", "and", "for", "are", "was", "were", "how", "why"
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !stopWords.has(word));
}

function ConversationReport({ report }) {
  return (
    <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-meadow">Conversation report</p>
          <h3 className="text-xl font-bold text-ink">Final score: {report.score}/100</h3>
        </div>
        <div className="rounded-md bg-skyglass px-3 py-2 text-sm font-semibold text-ink">
          {report.totalTurns} turns · {report.totalWords} words
        </div>
      </div>

      <div className="mb-4 h-3 rounded-full bg-stone-100">
        <div className="h-3 rounded-full bg-meadow" style={{ width: `${report.score}%` }} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-stone-200 bg-[#f7f5ef] p-3">
          <p className="text-xs font-bold uppercase text-stone-500">Filler count</p>
          <p className="mt-1 text-2xl font-bold text-ink">{report.fillerInstances.length}</p>
          <p className="mt-1 text-sm text-stone-600">
            {report.fillerInstances.length
              ? report.fillerInstances.map((item) => `${item.word} (turn ${item.turn})`).join(", ")
              : "No obvious filler words caught."}
          </p>
        </div>
        <div className="rounded-md border border-stone-200 bg-[#f7f5ef] p-3">
          <p className="text-xs font-bold uppercase text-stone-500">Positive additions</p>
          <p className="mt-1 text-2xl font-bold text-ink">{report.positiveAdds}/{report.totalTurns}</p>
          <p className="mt-1 text-sm text-stone-600">Turns that added detail, asked a question, or gave the bot something useful to respond to.</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {report.notes.map((note, index) => (
          <p key={`${note}-${index}`} className="rounded-md border border-stone-200 px-3 py-2 text-sm text-stone-700">
            {note}
          </p>
        ))}
      </div>
    </section>
  );
}

