export function LiveTranscriptPanel({ transcript, label = "Live transcript" }) {
  if (!transcript) {
    return null;
  }

  const words = transcript.trim().split(/\s+/).filter(Boolean);
  const fillers = findFillers(transcript);

  return (
    <section className="rounded-md border border-meadow bg-green-50 p-4">
      <p className="mb-2 text-xs font-bold uppercase text-meadow">{label}</p>
      <p className="min-h-14 text-lg font-semibold leading-7 text-ink">{transcript}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded bg-white px-2 py-1 text-stone-600">Words: {words.length}</span>
        <span className="rounded bg-white px-2 py-1 text-stone-600">Filler words: {fillers.length}</span>
        {fillers.slice(0, 5).map((word, index) => (
          <span key={`${word}-${index}`} className="rounded bg-orange-100 px-2 py-1 text-coral">
            {word}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-stone-500">
        Live text is provisional. The final transcript is refined after you stop recording.
      </p>
    </section>
  );
}

function findFillers(text) {
  return [...text.matchAll(/\b(uh|uhh|um|umm|uhm|like|you know|sort of|kind of)\b/gi)].map((match) => match[0]);
}
