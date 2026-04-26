import { Bot, Radio, Send, Square, Volume2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, playAudio } from "../api.js";
import { useAuth } from "../state/AuthContext.jsx";
import { analyzeReadingAudio } from "../utils/audioAnalysis.js";
import { FeedbackPanel } from "./FeedbackPanel.jsx";
import { RecorderButton } from "./RecorderButton.jsx";

const fallbackOpening = "Pick a conversation partner and tell me what has been on your mind lately.";
const LIVE_TURN_SILENCE_MS = 2600;
const LIVE_TURN_MAX_MS = 60000;
const LIVE_TURN_NO_SPEECH_MS = 15000;

export function ConversationPractice() {
  const { user, updateUser } = useAuth();
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
  const [showConversationReport, setShowConversationReport] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const messagesRef = useRef(messages);
  const liveActiveRef = useRef(false);
  const liveFinalTranscriptRef = useRef("");
  const recognitionRef = useRef(null);
  const liveRecorderRef = useRef(null);
  const liveStreamRef = useRef(null);
  const liveChunksRef = useRef([]);
  const liveTurnAnalyticsRef = useRef([]);
  const liveSilenceTimerRef = useRef(null);
  const liveTurnLimitTimerRef = useRef(null);
  const selectedBot = bots.find((bot) => bot.id === botId);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    api("/conversation/bots").then((data) => setBots(data.bots)).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!selectedBot || liveActiveRef.current) {
      return;
    }

    setMessages([{ role: "assistant", content: selectedBot.opener || fallbackOpening }]);
    setFeedback(null);
    setScores(null);
    setConversationReport(null);
    setShowConversationReport(false);
  }, [botId, selectedBot]);

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
    setShowConversationReport(false);
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
      notifyHistoryUpdated();
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
    setShowConversationReport(false);
    setError("");
    setMessages(openingMessages);
    messagesRef.current = openingMessages;
    liveTurnAnalyticsRef.current = [];
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

  async function startTurnRecording() {
    if (!window.MediaRecorder) {
      throw new Error("MediaRecorder is not supported");
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    liveChunksRef.current = [];
    liveStreamRef.current = stream;
    liveRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        liveChunksRef.current.push(event.data);
      }
    };

    recorder.start();
    return recorder;
  }

  function stopTurnRecording(recorder) {
    return new Promise((resolve) => {
      const activeRecorder = recorder || liveRecorderRef.current;
      const stream = liveStreamRef.current;

      if (!activeRecorder || activeRecorder.state === "inactive") {
        stream?.getTracks().forEach((track) => track.stop());
        liveStreamRef.current = null;
        liveRecorderRef.current = null;
        liveChunksRef.current = [];
        resolve(null);
        return;
      }

      activeRecorder.onstop = () => {
        stream?.getTracks().forEach((track) => track.stop());
        liveStreamRef.current = null;
        liveRecorderRef.current = null;
        const blob = new Blob(liveChunksRef.current, { type: "audio/webm" });
        liveChunksRef.current = [];
        resolve(blob);
      };

      activeRecorder.stop();
    });
  }

  async function collectLiveAudioMetrics(blob, text) {
    try {
      return await analyzeReadingAudio(blob, text, user?.profile?.micCalibration);
    } catch (_err) {
      return null;
    }
  }

  function clearLiveTurnTimers() {
    window.clearTimeout(liveSilenceTimerRef.current);
    window.clearTimeout(liveTurnLimitTimerRef.current);
    liveSilenceTimerRef.current = null;
    liveTurnLimitTimerRef.current = null;
  }

  async function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition || !liveActiveRef.current) {
      return;
    }

    let recorder;
    try {
      recorder = await startTurnRecording();
    } catch (_err) {
      setError("Microphone permission is needed for live chat.");
      stopLiveChat({ showReport: false });
      return;
    }

    const recognition = new SpeechRecognition();
    let shouldSubmitTurn = false;
    let restartAttempts = 0;
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    setLivePhase("listening");
    setLiveTranscript("");
    setLiveFinalTranscript("");
    liveFinalTranscriptRef.current = "";

    function finishTurn() {
      if (!liveActiveRef.current || shouldSubmitTurn) {
        return;
      }

      shouldSubmitTurn = true;
      clearLiveTurnTimers();
      try {
        recognition.stop();
      } catch (_err) {
        recognition.onend?.();
      }
    }

    function scheduleTurnFinish(timeout = LIVE_TURN_SILENCE_MS) {
      window.clearTimeout(liveSilenceTimerRef.current);
      liveSilenceTimerRef.current = window.setTimeout(finishTurn, timeout);
    }

    scheduleTurnFinish(LIVE_TURN_NO_SPEECH_MS);
    liveTurnLimitTimerRef.current = window.setTimeout(finishTurn, LIVE_TURN_MAX_MS);

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

      const nextLiveFinal = finalText.trim()
        ? `${liveFinalTranscriptRef.current} ${finalText}`.trim()
        : liveFinalTranscriptRef.current;
      setLiveTranscript(`${nextLiveFinal} ${interimText}`.trim());
      if (finalText.trim()) {
        liveFinalTranscriptRef.current = nextLiveFinal;
        setLiveFinalTranscript(nextLiveFinal);
      }
      scheduleTurnFinish();
    };

    recognition.onerror = (event) => {
      if (event.error !== "no-speech") {
        setError(`Live transcription error: ${event.error}`);
      }
    };

    recognition.onend = async () => {
      if (!liveActiveRef.current) {
        clearLiveTurnTimers();
        recognitionRef.current = null;
        return;
      }

      if (!shouldSubmitTurn && restartAttempts < 3) {
        restartAttempts += 1;
        window.setTimeout(() => {
          if (!liveActiveRef.current || shouldSubmitTurn) {
            return;
          }

          try {
            recognition.start();
            recognitionRef.current = recognition;
          } catch (_err) {
            shouldSubmitTurn = true;
            recognition.onend?.();
          }
        }, 180);
        return;
      }

      clearLiveTurnTimers();
      const browserTranscript = liveFinalTranscriptRef.current.trim();
      recognitionRef.current = null;
      setLivePhase("transcribing");
      const blob = await stopTurnRecording(recorder);

      let finalMessage = browserTranscript;
      let audioMetrics = null;

      if (blob?.size > 0) {
        try {
          const formData = new FormData();
          formData.append("audio", blob, "live-response.webm");
          const transcript = await api("/voice/transcribe", { method: "POST", body: formData });
          finalMessage = transcript.text?.trim() || browserTranscript;
          audioMetrics = await collectLiveAudioMetrics(blob, finalMessage);
        } catch (err) {
          setError(`Final transcription failed, using live transcript: ${err.message}`);
          if (finalMessage) {
            audioMetrics = await collectLiveAudioMetrics(blob, finalMessage);
          }
        }
      }

      if (!finalMessage) {
        startListening();
        return;
      }

      liveTurnAnalyticsRef.current = [
        ...liveTurnAnalyticsRef.current,
        {
          text: finalMessage,
          browserTranscript,
          audioMetrics
        }
      ];
      setLiveTranscript(finalMessage);
      setLiveFinalTranscript(finalMessage);
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
    const report = showReport ? buildConversationReport(messagesRef.current, liveTurnAnalyticsRef.current) : null;
    liveActiveRef.current = false;
    setLiveActive(false);
    setLivePhase("idle");
    setLiveTranscript("");
    setLiveFinalTranscript("");
    clearLiveTurnTimers();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    stopTurnRecording(liveRecorderRef.current);
    if (report) {
      setConversationReport(report);
      setShowConversationReport(true);
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
              {liveActive ? `Status: ${formatLivePhase(livePhase)}` : "Hands-free speaking practice with refined final transcription."}
            </p>
          </div>
          {liveActive ? (
            <button
              type="button"
              onClick={() => stopLiveChat()}
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
                <p className="mt-2 text-xs leading-5 text-stone-500">
                  Live text is provisional. Your final message is refined with speech-to-text before the coach responds.
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
        {conversationReport && !showConversationReport && (
          <button
            type="button"
            onClick={() => setShowConversationReport(true)}
            className="report-feature-button w-full rounded-md px-4 py-3 text-left text-sm font-bold text-white shadow-sm"
          >
            <span className="relative z-10">View conversation report</span>
          </button>
        )}
        {conversationReport && showConversationReport && (
          <ConversationReportModal report={conversationReport} onClose={() => setShowConversationReport(false)} />
        )}
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
  return [...text.matchAll(/\b(uh|uhh|um|umm|uhm|like|you know|sort of|kind of)\b/gi)].map((match) => match[0]);
}

function notifyHistoryUpdated() {
  window.dispatchEvent(new Event("lingo:history-updated"));
}

function formatLivePhase(phase) {
  return {
    idle: "Idle",
    "ai-speaking": "AI speaking",
    listening: "Listening",
    transcribing: "Refining transcript",
    thinking: "Thinking"
  }[phase] || phase;
}

function buildConversationReport(messages, turnAnalytics = []) {
  const userTurns = messages.filter((message) => message.role === "user");
  if (!userTurns.length) {
    return null;
  }

  const notes = [];
  const fillerInstances = [];
  const strengths = [];
  const improvements = [];
  let positiveAdds = 0;
  let shortTurns = 0;
  let offTrackTurns = 0;
  let noPositiveTurns = 0;
  let askedQuestions = 0;
  let detailedTurns = 0;

  userTurns.forEach((turn, index) => {
    const text = turn.content || "";
    const words = text.trim().split(/\s+/).filter(Boolean);
    const fillers = findFillers(text);
    const previousAssistant = findPreviousAssistant(messages, turn);
    const offTrack = previousAssistant && !hasTopicOverlap(previousAssistant.content, text);
    const askedQuestion = /[?]|\b(what|how|why|when|where|who|which)\b/i.test(text);
    const addedDetail = words.length >= 14;
    const analytics = turnAnalytics[index] || {};
    const metrics = analytics.audioMetrics;

    fillers.forEach((word) => {
      fillerInstances.push({ word, turn: index + 1 });
    });

    if (askedQuestion) {
      askedQuestions += 1;
    }

    if (addedDetail) {
      detailedTurns += 1;
    }

    if (fillers.length) {
      notes.push(`Turn ${index + 1}: ${fillers.length} filler word${fillers.length === 1 ? "" : "s"} (${fillers.join(", ")}).`);
    }

    if (words.length < 8) {
      shortTurns += 1;
      notes.push(`Turn ${index + 1}: the response was very short, so it gave the other person less to build on.`);
    }

    if (offTrack) {
      offTrackTurns += 1;
      notes.push(`Turn ${index + 1}: this may have drifted from what the bot asked. Try answering the prompt first, then adding your own detail.`);
    }

    if (!askedQuestion && !addedDetail) {
      noPositiveTurns += 1;
      notes.push(`Turn ${index + 1}: you could add something positive by giving a detail, asking a follow-up, or naming how you felt.`);
    } else {
      positiveAdds += 1;
    }

    const paceWpm = getSpeakingPace(metrics);
    if (paceWpm > 185) {
      notes.push(`Turn ${index + 1}: speaking pace was fast at ${paceWpm} WPM. Slow slightly so your ideas land.`);
    } else if (metrics?.wordsPerMinute > 0 && metrics.wordsPerMinute < 90) {
      notes.push(`Turn ${index + 1}: pace was slow at ${metrics.wordsPerMinute} WPM. Try grouping thoughts into smoother phrases.`);
    }

    if (metrics?.pauseCount > 3 || metrics?.longestPauseSeconds > 1.5) {
      notes.push(`Turn ${index + 1}: pauses stood out (${metrics.pauseCount || 0} pauses, longest ${metrics.longestPauseSeconds || 0}s). Practice pausing intentionally instead of searching mid-sentence.`);
    }

    const volume = metrics?.normalizedAverageVolumePercent || metrics?.averageVolumePercent;
    const variation = metrics?.normalizedVolumeVariationPercent || metrics?.volumeVariationPercent;
    if (volume && volume < 28) {
      notes.push(`Turn ${index + 1}: volume was quiet at ${volume}/100. Project a little more through the end of the sentence.`);
    }
    if (variation && variation > 24) {
      notes.push(`Turn ${index + 1}: volume varied a lot (${variation}/100), which can make confidence feel uneven.`);
    }
  });

  const totalWords = userTurns.reduce((sum, turn) => sum + turn.content.trim().split(/\s+/).filter(Boolean).length, 0);
  const averageWords = Math.round(totalWords / userTurns.length);
  const metricTurns = turnAnalytics.map((turn) => turn.audioMetrics).filter(Boolean);
  const averageWpm = averageNumbers(metricTurns.map(getSpeakingPace).filter(Boolean));
  const averageVolume = averageNumbers(metricTurns.map((metrics) => metrics.normalizedAverageVolumePercent || metrics.averageVolumePercent).filter(Boolean));
  const totalPauses = metricTurns.reduce((sum, metrics) => sum + (metrics.pauseCount || 0), 0);
  const longestPause = Math.max(...metricTurns.map((metrics) => metrics.longestPauseSeconds || 0), 0);
  const fastTurns = metricTurns.filter((metrics) => getSpeakingPace(metrics) > 185).length;
  const slowTurns = metricTurns.filter((metrics) => metrics.wordsPerMinute > 0 && metrics.wordsPerMinute < 90).length;
  const pauseHeavyTurns = metricTurns.filter((metrics) => metrics.pauseCount > 3 || metrics.longestPauseSeconds > 1.5).length;
  const lowVolumeTurns = metricTurns.filter((metrics) => (metrics.normalizedAverageVolumePercent || metrics.averageVolumePercent || 0) < 28).length;
  const fillerRate = totalWords ? Math.round((fillerInstances.length / totalWords) * 100) : 0;
  const fillerPenalty = Math.min(30, fillerInstances.length * 5);
  const shortPenalty = shortTurns * 8;
  const contributionScore = Math.round((positiveAdds / userTurns.length) * 100);
  const deliveryPenalty = fastTurns * 8 + slowTurns * 5 + pauseHeavyTurns * 7 + lowVolumeTurns * 5;
  const score = Math.max(35, Math.min(100, contributionScore - fillerPenalty - shortPenalty - (offTrackTurns * 8) - deliveryPenalty + 12));

  if (averageWords >= 14) {
    strengths.push("You usually gave the coach enough detail to continue naturally.");
  }
  if (askedQuestions > 0) {
    strengths.push("You asked at least one follow-up, which makes conversations feel more mutual.");
  }
  if (fillerRate <= 3) {
    strengths.push("Your filler word rate stayed fairly controlled.");
  }
  if (averageWpm >= 100 && averageWpm <= 175) {
    strengths.push("Your average pace was in a comfortable conversational range.");
  }
  if (averageVolume >= 35) {
    strengths.push("Your speaking volume was generally strong enough to follow.");
  }

  if (fillerRate > 3) {
    improvements.push("Reduce filler words by pausing silently for half a beat before continuing.");
  }
  if (shortTurns > 0 || noPositiveTurns > 0) {
    improvements.push("Add one concrete detail or feeling before ending your turn.");
  }
  if (askedQuestions === 0) {
    improvements.push("Ask more follow-up questions so the other person feels included.");
  }
  if (fastTurns > 0) {
    improvements.push("Slow down on longer answers; aim for a clear phrase-by-phrase rhythm.");
  }
  if (pauseHeavyTurns > 0) {
    improvements.push("Plan the first few words of your answer before speaking to reduce searching pauses.");
  }
  if (lowVolumeTurns > 0) {
    improvements.push("Speak with a little more projection, especially at the end of sentences.");
  }

  return {
    score,
    totalTurns: userTurns.length,
    totalWords,
    averageWords,
    averageWpm,
    averageVolume,
    totalPauses,
    longestPause,
    fillerRate,
    fillerInstances,
    strengths: strengths.length ? strengths : ["You completed the conversation and gave the coach material to respond to."],
    improvements: improvements.length ? improvements : ["Keep practicing with the same steady rhythm and try adding one extra detail per turn."],
    notes: notes.length ? notes : ["You kept the conversation moving without obvious filler-heavy or very short turns."],
    positiveAdds
  };
}

function averageNumbers(values) {
  if (!values.length) {
    return 0;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function getSpeakingPace(metrics) {
  return metrics?.speakingWordsPerMinute || metrics?.wordsPerMinute || 0;
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

function ConversationReportModal({ report, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex min-h-screen items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-md">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-md border border-white/15 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-meadow">Live chat complete</p>
            <h2 className="text-lg font-bold text-ink">Your conversation analysis is ready</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close conversation report"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-stone-200 text-stone-600 transition hover:border-coral hover:text-coral"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">
          <ConversationReport report={report} />
        </div>
      </div>
    </div>,
    document.body
  );
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
          {report.totalTurns} turns - {report.totalWords} words
        </div>
      </div>

      <div className="mb-4 h-3 rounded-full bg-stone-100">
        <div className="h-3 rounded-full bg-meadow" style={{ width: `${report.score}%` }} />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-md border border-stone-200 bg-[#f7f5ef] p-3">
          <p className="text-xs font-bold uppercase text-stone-500">Filler count</p>
          <p className="mt-1 text-2xl font-bold text-ink">{report.fillerInstances.length}</p>
          <p className="mt-1 text-sm text-stone-600">
            {report.fillerInstances.length
              ? report.fillerInstances.map((item) => `${item.word} (turn ${item.turn})`).join(", ")
              : "No obvious filler words caught."}
          </p>
          <p className="mt-2 text-xs font-semibold text-stone-500">Rate: {report.fillerRate}/100 words</p>
        </div>
        <div className="rounded-md border border-stone-200 bg-[#f7f5ef] p-3">
          <p className="text-xs font-bold uppercase text-stone-500">Positive additions</p>
          <p className="mt-1 text-2xl font-bold text-ink">{report.positiveAdds}/{report.totalTurns}</p>
          <p className="mt-1 text-sm text-stone-600">Turns that added detail, asked a question, or gave the bot something useful to respond to.</p>
        </div>
        <div className="rounded-md border border-stone-200 bg-[#f7f5ef] p-3">
          <p className="text-xs font-bold uppercase text-stone-500">Average pace</p>
          <p className="mt-1 text-2xl font-bold text-ink">{report.averageWpm || "--"} WPM</p>
          <p className="mt-1 text-sm text-stone-600">Healthy conversation usually lands around 100-175 WPM.</p>
        </div>
        <div className="rounded-md border border-stone-200 bg-[#f7f5ef] p-3">
          <p className="text-xs font-bold uppercase text-stone-500">Pauses</p>
          <p className="mt-1 text-2xl font-bold text-ink">{report.totalPauses}</p>
          <p className="mt-1 text-sm text-stone-600">Longest pause: {report.longestPause || 0}s. Average volume: {report.averageVolume || "--"}/100.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-stone-200 bg-white p-3">
          <p className="mb-2 text-sm font-semibold text-meadow">What went well</p>
          <ul className="space-y-2 text-sm text-stone-700">
            {report.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-md border border-stone-200 bg-white p-3">
          <p className="mb-2 text-sm font-semibold text-coral">Improve next</p>
          <ul className="space-y-2 text-sm text-stone-700">
            {report.improvements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-sm font-semibold text-ink">Turn-by-turn notes</p>
        {report.notes.map((note, index) => (
          <p key={`${note}-${index}`} className="rounded-md border border-stone-200 px-3 py-2 text-sm text-stone-700">
            {note}
          </p>
        ))}
      </div>
    </section>
  );
}

