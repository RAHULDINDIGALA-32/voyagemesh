export type ApproxPlace = {
  region: string;
  country: string;
};

const TZ_PLACES: Record<string, ApproxPlace> = {
  "Africa/Johannesburg": { region: "South Africa", country: "South Africa" },
  "Africa/Lagos": { region: "Nigeria", country: "Nigeria" },
  "America/Chicago": { region: "the Midwest", country: "the United States" },
  "America/Denver": { region: "Colorado", country: "the United States" },
  "America/Los_Angeles": { region: "California", country: "the United States" },
  "America/New_York": { region: "New York", country: "the United States" },
  "America/Sao_Paulo": { region: "Brazil", country: "Brazil" },
  "America/Toronto": { region: "Ontario", country: "Canada" },
  "America/Vancouver": { region: "British Columbia", country: "Canada" },
  "Asia/Calcutta": { region: "India", country: "India" },
  "Asia/Dubai": { region: "the UAE", country: "the UAE" },
  "Asia/Hong_Kong": { region: "Hong Kong", country: "Hong Kong" },
  "Asia/Kolkata": { region: "India", country: "India" },
  "Asia/Seoul": { region: "South Korea", country: "South Korea" },
  "Asia/Shanghai": { region: "China", country: "China" },
  "Asia/Singapore": { region: "Singapore", country: "Singapore" },
  "Asia/Tokyo": { region: "Japan", country: "Japan" },
  "Australia/Melbourne": { region: "Victoria", country: "Australia" },
  "Australia/Sydney": { region: "New South Wales", country: "Australia" },
  "Europe/Amsterdam": { region: "the Netherlands", country: "the Netherlands" },
  "Europe/Berlin": { region: "Germany", country: "Germany" },
  "Europe/Lisbon": { region: "Portugal", country: "Portugal" },
  "Europe/London": { region: "the United Kingdom", country: "the United Kingdom" },
  "Europe/Madrid": { region: "Spain", country: "Spain" },
  "Europe/Paris": { region: "France", country: "France" },
  "Europe/Rome": { region: "Italy", country: "Italy" },
  "Pacific/Auckland": { region: "New Zealand", country: "New Zealand" },
};

export function placeFromTimeZone(timeZone?: string): ApproxPlace {
  const zone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  return TZ_PLACES[zone] ?? { region: "your map", country: "your map" };
}

export function formatPlace(place: ApproxPlace) {
  if (place.region && place.region !== place.country) {
    return `${place.region}, ${place.country}`;
  }
  return place.region || place.country;
}
