const STARTERS = [
  "Five days in Kyoto from Hyderabad, two travelers, mid-April, budget INR 180000.",
  "Long weekend in Lisbon from London, one traveler, walking-first, no car.",
  "Nine days in Japan from Mumbai covering Tokyo and Kanazawa, family of three.",
];

export function Composer({
  disabled,
  onSend,
}: {
  disabled?: boolean;
  onSend: (query: string) => void;
}) {
  return (
    <form
      className="border-t border-rule bg-paper p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const query = String(data.get("query") ?? "").trim();
        if (query.length < 5) return;
        onSend(query);
        form.reset();
      }}
    >
      <textarea
        name="query"
        required
        minLength={5}
        disabled={disabled}
        placeholder="Origin, destination, dates, travelers, budget"
        className="h-24 w-full resize-none rounded-[3px] border border-rule bg-paper-raised px-3 py-2 text-sm outline-none focus:border-steel"
      />
      <div className="mt-2 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
          Dispatch
        </p>
        <button
          type="submit"
          disabled={disabled}
          className="rounded-[3px] border border-brass px-3 py-1.5 text-xs tracking-wide text-brass disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </form>
  );
}

export function StarterQueries({ onPick }: { onPick: (query: string) => void }) {
  return (
    <div className="mt-10 grid gap-2">
      {STARTERS.map((query) => (
        <button
          key={query}
          type="button"
          onClick={() => onPick(query)}
          className="border border-rule px-3 py-3 text-left text-sm text-ink-soft hover:border-ink"
        >
          {query}
        </button>
      ))}
    </div>
  );
}
