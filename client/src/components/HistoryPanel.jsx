import { Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
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
  const [error, setError] = useState("");

  useEffect(() => {
    api("/history")
      .then((data) => setActivities(data.activities))
      .catch((err) => setError(err.message));
  }, []);

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
        {activities.slice(0, 8).map((activity) => (
          <article key={activity._id} className="rounded-md border border-stone-200 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-ink">{labelFor(activity.type)}</span>
              <span className="text-xs text-stone-500">
                {new Date(activity.createdAt).toLocaleDateString()}
              </span>
            </div>
            <p className="line-clamp-2 text-sm text-stone-600">{activity.feedback?.summary || activity.userResponse}</p>
            <div className="mt-3 flex gap-2 text-xs font-semibold">
              <span className="rounded bg-green-50 px-2 py-1 text-meadow">Confidence {activity.scores?.confidence || 0}</span>
              <span className="rounded bg-blue-50 px-2 py-1 text-sky-700">Clarity {activity.scores?.clarity || 0}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

