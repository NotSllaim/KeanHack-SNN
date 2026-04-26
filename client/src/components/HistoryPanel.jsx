import { ChevronDown, ChevronUp, Clock3 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";

function labelFor(type) {
  return {
    conversation: "Conversation",
    reading: "Reading",
    verbiage: "Verbiage"
  }[type] || type;
}

export function HistoryPanel() {
  const [activities, setActivities] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [error, setError] = useState("");

  const loadHistory = useCallback(() => {
    api("/history")
      .then((data) => {
        setActivities(data.activities);
        setError("");
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    window.addEventListener("lingo:history-updated", loadHistory);
    return () => window.removeEventListener("lingo:history-updated", loadHistory);
  }, [loadHistory]);

  return (
    <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Clock3 size={18} className="text-meadow" />
        <h2 className="text-base font-bold text-ink">Recent Practice</h2>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      {!error && activities.length === 0 && (
        <p className="text-sm leading-6 text-stone-600">Your completed activity history will appear here.</p>
      )}

      <div className="space-y-3">
        {activities.slice(0, 8).map((activity) => {
          const isExpanded = expandedId === activity._id;
          return (
            <article key={activity._id} className="rounded-md border border-stone-200 bg-white p-3 transition hover:border-meadow/70">
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : activity._id)}
                className="w-full text-left"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">{labelFor(activity.type)}</span>
                  <span className="flex items-center gap-2 text-xs text-stone-500">
                    {new Date(activity.createdAt).toLocaleDateString()}
                    {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm leading-6 text-stone-600">{briefDescription(activity)}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                  <ScorePill label="Confidence" value={activity.scores?.confidence || 0} kind="confidence" />
                  <ScorePill label="Clarity" value={activity.scores?.clarity || 0} kind="clarity" />
                </div>
              </button>

              {isExpanded && (
                <div className="mt-4 space-y-3 border-t border-stone-200 pt-4">
                  <DetailBlock title="What was said" text={activity.userResponse || "No transcript was saved for this activity."} />
                  <DetailBlock title="Why it was good" text={whyGood(activity)} />
                  <DetailBlock title="Improve next" text={improveNext(activity)} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <ScoreDetail label="Confidence" value={activity.scores?.confidence || 0} kind="confidence" />
                    <ScoreDetail label="Clarity" value={activity.scores?.clarity || 0} kind="clarity" />
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function briefDescription(activity) {
  const summary = activity.feedback?.summary;
  const response = activity.userResponse;

  if (summary && response) {
    return `${summary} You said: "${shorten(response, 96)}"`;
  }

  return summary || response || "Practice session completed.";
}

function whyGood(activity) {
  const strengths = activity.feedback?.strengths?.filter(Boolean) || [];
  if (strengths.length) {
    return strengths.join(" ");
  }

  const confidence = activity.scores?.confidence || 0;
  const clarity = activity.scores?.clarity || 0;
  if (confidence >= 75 && clarity >= 75) {
    return "This landed well because it sounded confident and was easy to follow.";
  }
  if (clarity >= confidence) {
    return "This was useful because the wording was understandable, giving the listener something clear to respond to.";
  }
  return activity.feedback?.summary || "This counts as useful practice because you completed the response and created material to improve from.";
}

function improveNext(activity) {
  const improvements = activity.feedback?.improvements?.filter(Boolean) || [];
  if (improvements.length) {
    return improvements.join(" ");
  }

  if ((activity.scores?.confidence || 0) < 70) {
    return "Aim for a steadier delivery and add one concrete detail before ending your answer.";
  }
  if ((activity.scores?.clarity || 0) < 70) {
    return "Tighten the wording and slow down slightly so the main point is easier to catch.";
  }
  return "Keep practicing this same skill and try to make the next response a little more specific.";
}

function DetailBlock({ title, text }) {
  return (
    <div className="rounded-md bg-[#f7f5ef] p-3">
      <p className="mb-1 text-xs font-bold uppercase text-stone-500">{title}</p>
      <p className="text-sm leading-6 text-stone-700">{text}</p>
    </div>
  );
}

function ScorePill({ label, value, kind }) {
  return (
    <span className={`rounded border px-2 py-1 ${scoreTone(value, kind)}`}>
      {label} {value}
    </span>
  );
}

function ScoreDetail({ label, value, kind }) {
  return (
    <div className={`min-w-0 rounded-md border p-3 ${scoreTone(value, kind)}`}>
      <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-1">
        <p className="min-w-0 text-xs font-bold uppercase">{label}</p>
        <p className="shrink-0 text-base font-bold leading-none">{value}/100</p>
      </div>
      <div className="h-2 rounded-full bg-white/70">
        <div className="h-2 rounded-full bg-current" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

function scoreTone(value, kind) {
  const confidenceTones = {
    high: "score-confidence-high",
    mid: "score-confidence-mid",
    low: "border-red-200 bg-red-50 text-red-700"
  };
  const clarityTones = {
    high: "border-sky-200 bg-sky-50 text-sky-700",
    mid: "border-violet-200 bg-violet-50 text-violet-700",
    low: "border-rose-200 bg-rose-50 text-rose-700"
  };
  const tones = kind === "clarity" ? clarityTones : confidenceTones;

  if (value >= 78) {
    return tones.high;
  }
  if (value >= 62) {
    return tones.mid;
  }
  return tones.low;
}

function shorten(text, maxLength) {
  if (!text || text.length <= maxLength) {
    return text || "";
  }

  return `${text.slice(0, maxLength).trim()}...`;
}

