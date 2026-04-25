import { SmilePlus } from "lucide-react";
import { ScoreCard } from "./ScoreCard.jsx";

export function FeedbackPanel({ feedback, scores }) {
  if (!feedback && !scores) {
    return null;
  }

  return (
    <section className="rounded-md border border-stone-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <SmilePlus size={18} className="text-coral" />
        <h3 className="font-bold text-ink">Feedback</h3>
      </div>
      {feedback?.summary && <p className="mb-4 text-sm leading-6 text-stone-700">{feedback.summary}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {feedback?.strengths?.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-meadow">Working well</p>
            <ul className="space-y-1 text-sm text-stone-700">
              {feedback.strengths.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        )}
        {feedback?.improvements?.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-coral">Try next</p>
            <ul className="space-y-1 text-sm text-stone-700">
              {feedback.improvements.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        )}
      </div>
      {scores && (
        <div className="mt-5">
          <ScoreCard
            title="Response score"
            scores={[
              { label: "Confidence", value: scores.confidence || 0 },
              { label: "Clarity", value: scores.clarity || 0 },
              { label: "Engagement", value: scores.engagement || 0 }
            ]}
          />
        </div>
      )}
    </section>
  );
}

