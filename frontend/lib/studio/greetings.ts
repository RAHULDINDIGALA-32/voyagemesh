export type DaySlot = "morning" | "afternoon" | "evening" | "moonlight";

export function daySlot(date = new Date()): DaySlot {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "moonlight";
}

type Greeting = {
  slots: DaySlot[];
  render: (firstName?: string) => string;
};

const GREETINGS: Greeting[] = [
  {
    slots: ["morning"],
    render: (name) =>
      name ? `Morning, ${name}. Where are we plotting?` : "Morning. Ready to plot a route?",
  },
  {
    slots: ["morning"],
    render: () => "Sunrise on the chart. Where next?",
  },
  {
    slots: ["afternoon"],
    render: (name) =>
      name ? `Afternoon, ${name}. A destination in mind?` : "Afternoon. Shall we chart something?",
  },
  {
    slots: ["afternoon"],
    render: () => "The day is open. Where shall we sail?",
  },
  {
    slots: ["evening"],
    render: () => "Evening, how are things?",
  },
  {
    slots: ["evening"],
    render: (name) =>
      name ? `Good evening, ${name}. Night trains or slow boats?` : "Dusk on the chart. Where to?",
  },
  {
    slots: ["moonlight"],
    render: () => "Moonlit chat?",
  },
  {
    slots: ["moonlight"],
    render: (name) =>
      name ? `Good moonlight, ${name}. A quiet voyage?` : "The night desk is open. Where shall we plot?",
  },
  {
    slots: ["morning", "afternoon"],
    render: (name) => (name ? `${name}, shall we fill the map?` : "Where shall we plot?"),
  },
  {
    slots: ["evening", "moonlight"],
    render: () => "Late hours. Perfect for a long itinerary.",
  },
];

function hashKey(value: string) {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

export function pickGreeting(displayName?: string | null, date = new Date()) {
  const slot = daySlot(date);
  const firstName = displayName?.trim().split(/\s+/)[0];
  const pool = GREETINGS.filter((item) => item.slots.includes(slot));
  const key = `${date.toISOString().slice(0, 10)}-${slot}`;
  const chosen = pool[hashKey(key) % pool.length];
  return chosen.render(firstName);
}
