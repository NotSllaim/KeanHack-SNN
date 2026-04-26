import { ArrowLeft, ArrowRight, Mic, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { companionSurveyQuestions } from "../data/companionSurvey.js";
import { useAuth } from "../state/AuthContext.jsx";
import electricCreature from "../public/electric1.png";
import fireCreature from "../public/fire1.png";
import leafCreature from "../public/leaf1.png";
import waterCreature from "../public/water1.png";

const creatureAssets = {
  fire: fireCreature,
  water: waterCreature,
  leaf: leafCreature,
  lightning: electricCreature
};

const revealStyles = {
  fire: {
    accent: "#f25f3a",
    glow: "rgba(242, 95, 58, 0.28)",
    background: "linear-gradient(135deg, #fff2df 0%, #ffe3cc 42%, #f7f5ef 100%)"
  },
  water: {
    accent: "#2687a6",
    glow: "rgba(38, 135, 166, 0.26)",
    background: "linear-gradient(135deg, #eaf8fb 0%, #d8eef4 45%, #f7f5ef 100%)"
  },
  leaf: {
    accent: "#4e8c57",
    glow: "rgba(78, 140, 87, 0.26)",
    background: "linear-gradient(135deg, #eef8e8 0%, #dcefd4 45%, #f7f5ef 100%)"
  },
  lightning: {
    accent: "#d79b19",
    glow: "rgba(215, 155, 25, 0.28)",
    background: "linear-gradient(135deg, #fff8d8 0%, #e5f1ff 45%, #f7f5ef 100%)"
  }
};

function preloadImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = resolve;
    image.onerror = resolve;
    image.src = src;

    if (image.decode) {
      image.decode().then(resolve).catch(resolve);
    }
  });
}

export function CompanionSurveyScreen() {
  const { completeSurvey, finishOnboarding, logout } = useAuth();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [reveal, setReveal] = useState(null);
  const [micCheck, setMicCheck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const question = companionSurveyQuestions[step];
  const selectedAnswers = normalizeAnswers(answers[question.id]);
  const hasAnswer = selectedAnswers.length > 0;
  const isLastStep = step === companionSurveyQuestions.length - 1;
  const progress = Math.round(((step + 1) / companionSurveyQuestions.length) * 100);

  useEffect(() => {
    Object.values(creatureAssets).forEach((src) => {
      preloadImage(src);
    });
  }, []);

  function chooseAnswer(optionId) {
    const nextAnswersForQuestion = question.allowMultiple
      ? toggleAnswer(selectedAnswers, optionId)
      : [optionId];
    const nextAnswers = {
      ...answers,
      [question.id]: question.allowMultiple ? nextAnswersForQuestion : optionId
    };

    setAnswers(nextAnswers);
    setError("");
  }

  async function continueSurvey() {
    if (!hasAnswer) {
      return;
    }

    setError("");
    if (!isLastStep) {
      setStep(step + 1);
      return;
    }

    setBusy(true);
    try {
      const data = await completeSurvey(answers, { deferUserUpdate: true });
      const elementId = data.companionElement?.id;
      await preloadImage(creatureAssets[elementId] || leafCreature);
      setReveal({
        ...data.companionElement,
        user: data.user
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (reveal && micCheck) {
    return (
      <MicCheckScreen
        reveal={reveal}
        onComplete={(updatedUser) => finishOnboarding(updatedUser)}
        onSkip={() => finishOnboarding(reveal.user)}
      />
    );
  }

  if (reveal) {
    const style = revealStyles[reveal.id] || revealStyles.leaf;
    const creature = creatureAssets[reveal.id] || leafCreature;

    return (
      <main
        className="companion-reveal relative h-screen overflow-hidden px-5 py-4 text-ink md:px-10 md:py-6"
        style={{ background: style.background }}
      >
        <div className="confetti-layer" aria-hidden="true">
          {Array.from({ length: 34 }).map((_, index) => (
            <span
              key={index}
              className="confetti-piece"
              style={{
                left: `${(index * 29) % 100}%`,
                animationDelay: `${(index % 11) * 0.13}s`,
                backgroundColor: index % 3 === 0 ? style.accent : index % 3 === 1 ? "#ffffff" : "#172026"
              }}
            />
          ))}
        </div>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <div className="sunburst" style={{ "--burst-color": style.accent }} />
        </div>

        <section className="relative z-10 mx-auto flex h-full max-w-6xl flex-col items-center justify-center text-center">
          <p className="mb-2 text-sm font-bold uppercase tracking-normal" style={{ color: style.accent }}>
            Your companion has arrived
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-normal md:text-6xl">
            {reveal.name}
          </h1>

          <div className="relative my-4 flex h-[min(38vh,360px)] w-[min(38vh,360px)] items-center justify-center md:my-5 md:h-[min(42vh,400px)] md:w-[min(42vh,400px)]">
            <div
              className="absolute inset-10 rounded-full blur-3xl"
              style={{ backgroundColor: style.glow }}
              aria-hidden="true"
            />
            <img
              src={creature}
              alt={`${reveal.name} companion`}
              className="reveal-creature relative z-10 max-h-full max-w-full object-contain drop-shadow-2xl"
            />
            <Sparkles className="sparkle sparkle-one absolute text-white drop-shadow" size={34} />
            <Sparkles className="sparkle sparkle-two absolute drop-shadow" style={{ color: style.accent }} size={42} />
            <Sparkles className="sparkle sparkle-three absolute text-white drop-shadow" size={28} />
          </div>

          <p className="max-w-2xl text-base font-semibold leading-7 text-stone-700 md:text-xl md:leading-8">
            {reveal.description}
          </p>

          <button
            type="button"
            onClick={() => setMicCheck(true)}
            className="mt-5 inline-flex h-12 items-center justify-center rounded-md bg-ink px-7 text-base font-bold text-white shadow-soft hover:bg-meadow md:mt-6 md:h-14 md:px-8 md:text-lg"
          >
            Continue to mic check
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f5ef] px-5 py-6 text-ink md:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <div className="inline-flex items-center gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-ink text-white">
              <Sparkles size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold text-meadow">Companion Match</p>
              <p className="text-sm text-stone-500">Question {step + 1} of {companionSurveyQuestions.length}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-600 hover:border-coral hover:text-coral"
          >
            Log out
          </button>
        </header>

        <div className="mt-8 h-2 rounded-full bg-white">
          <div className="meter-fill h-2 rounded-full bg-meadow" style={{ width: `${progress}%` }} />
        </div>

        <section className="flex flex-1 flex-col justify-center py-8">
          <div className="mb-8 max-w-4xl">
            <p className="mb-3 text-sm font-bold uppercase text-coral">Find your element</p>
            <h1 className="text-4xl font-bold leading-tight tracking-normal text-ink md:text-6xl">
              {question.prompt}
            </h1>
            {question.allowMultiple && (
              <p className="mt-4 text-lg font-semibold text-stone-500">Select all that apply.</p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {question.options.map((option) => {
              const selected = selectedAnswers.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => chooseAnswer(option.id)}
                  disabled={busy}
                  className={`relative min-h-28 rounded-md border-2 p-5 text-left text-xl font-bold leading-snug shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 md:min-h-32 md:p-6 md:text-2xl ${
                    selected
                      ? "border-meadow bg-green-100 text-ink shadow-soft ring-4 ring-meadow/25"
                      : "border-stone-200 bg-white text-ink hover:border-meadow hover:bg-green-50"
                  }`}
                >
                  {selected && (
                    <span className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-meadow text-sm font-black text-white">
                      ✓
                    </span>
                  )}
                  <span className={selected ? "block pr-10" : "block"}>{option.label}</span>
                </button>
              );
            })}
          </div>

          {error && <p className="mt-5 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        </section>

        <footer className="flex items-center justify-between gap-4 border-t border-stone-200 py-4">
          <button
            type="button"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0 || busy}
            className="inline-flex h-11 items-center gap-2 rounded-md border border-stone-200 bg-white px-4 font-semibold text-stone-700 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <ArrowLeft size={18} />
            Back
          </button>
          <div className="text-sm font-semibold text-stone-500">
            {busy
              ? "Matching your companion..."
              : question.allowMultiple
                ? "Choose any that fit"
                : isLastStep
                  ? "Choose one to reveal your element"
                  : "Choose one to continue"}
          </div>
          <button
            type="button"
            onClick={continueSurvey}
            disabled={!hasAnswer || busy}
            className="inline-flex h-11 items-center gap-2 rounded-md border border-stone-200 bg-white px-4 font-semibold text-stone-700 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isLastStep ? "Reveal" : "Next"}
            <ArrowRight size={18} />
          </button>
        </footer>
      </div>
    </main>
  );
}

function MicCheckScreen({ reveal, onComplete, onSkip }) {
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const animationRef = useRef(null);
  const samplesRef = useRef([]);
  const [listening, setListening] = useState(false);
  const [volume, setVolume] = useState(0);
  const [normalized, setNormalized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => stopMic();
  }, []);

  async function startMic() {
    setError("");
    setNormalized(false);
    samplesRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);

      streamRef.current = stream;
      audioContextRef.current = audioContext;
      setListening(true);

      const data = new Float32Array(analyser.fftSize);
      const tick = () => {
        analyser.getFloatTimeDomainData(data);
        const rms = Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length);
        const nextVolume = Math.round(Math.min(100, Math.max(0, rms * 280)));
        setVolume(nextVolume);

        if (nextVolume > 2) {
          samplesRef.current = [...samplesRef.current.slice(-44), nextVolume];
        }

        animationRef.current = requestAnimationFrame(tick);
      };

      tick();
    } catch (_err) {
      setError("Microphone permission is needed for the mic check.");
    }
  }

  function stopMic() {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    audioContextRef.current?.close?.();
    audioContextRef.current = null;
    setListening(false);
  }

  async function normalizeMic() {
    const averageVolumePercent = average(samplesRef.current);
    if (!averageVolumePercent) {
      setError("Speak for a few seconds before normalizing.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const data = await api("/auth/mic-calibration", {
        method: "POST",
        body: JSON.stringify({
          averageVolumePercent,
          targetVolumePercent: 60
        })
      });
      setNormalized(true);
      stopMic();
      onComplete(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f5ef] px-5 py-8 text-ink">
      <section className="w-full max-w-xl rounded-md border border-stone-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-semibold text-meadow">One last setup step</p>
        <h1 className="mt-2 text-3xl font-bold">Mic check for {reveal.name}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-600">
          Speak normally for a few seconds. The bar shows your current volume, and Normalize saves this as your baseline for Reading and Verbiage feedback.
        </p>

        <div className="mt-7 flex flex-col items-center gap-4">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-skyglass text-meadow">
            <Mic size={38} />
          </div>
          <div className="h-5 w-full overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-meadow transition-all"
              style={{ width: `${volume}%` }}
            />
          </div>
          <p className="text-sm font-semibold text-stone-600">Volume: {volume}%</p>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={listening ? stopMic : startMic}
            disabled={saving}
            className="inline-flex h-11 items-center rounded-md border border-stone-200 bg-white px-4 font-semibold text-stone-700 hover:border-meadow disabled:opacity-60"
          >
            {listening ? "Stop mic" : "Start mic"}
          </button>
          <button
            type="button"
            onClick={normalizeMic}
            disabled={saving || !samplesRef.current.length}
            className="inline-flex h-11 items-center rounded-md bg-meadow px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : normalized ? "Normalized" : "Normalize"}
          </button>
          <button
            type="button"
            onClick={onSkip}
            disabled={saving}
            className="inline-flex h-11 items-center rounded-md px-4 font-semibold text-stone-500 hover:text-ink disabled:opacity-60"
          >
            Skip
          </button>
        </div>

        {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </section>
    </main>
  );
}

function average(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeAnswers(answer) {
  if (Array.isArray(answer)) {
    return answer;
  }

  return answer ? [answer] : [];
}

function toggleAnswer(selectedAnswers, optionId) {
  return selectedAnswers.includes(optionId)
    ? selectedAnswers.filter((answerId) => answerId !== optionId)
    : [...selectedAnswers, optionId];
}
