export function ScoreCard({ title, icon: Icon, scores }) {
  return (
    <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        {Icon && <Icon size={18} className="text-meadow" />}
        <h2 className="text-base font-bold text-ink">{title}</h2>
      </div>
      <div className="space-y-4">
        {scores.map((score) => (
          <div key={score.label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-stone-700">{score.label}</span>
              <span className="font-bold text-ink">{score.value}</span>
            </div>
            <div className="h-2 rounded-full bg-stone-100">
              <div
                className="meter-fill h-2 rounded-full bg-meadow"
                style={{ width: `${Math.max(0, Math.min(100, score.value))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

