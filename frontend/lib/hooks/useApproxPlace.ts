"use client";

import { useEffect, useState } from "react";
import { placeFromTimeZone, type ApproxPlace } from "@/lib/studio/place";

type GeoPayload = {
  region?: string;
  country_name?: string;
};

export function useApproxPlace() {
  const [place, setPlace] = useState<ApproxPlace>(() => placeFromTimeZone());

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 2500);

    fetch("https://ipapi.co/json/", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: GeoPayload) => {
        const country = data.country_name?.trim();
        const region = data.region?.trim();
        if (!country && !region) return;
        setPlace({
          country: country || region || "your map",
          region: region || country || "your map",
        });
      })
      .catch(() => {
        setPlace(placeFromTimeZone());
      })
      .finally(() => window.clearTimeout(timer));

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);

  return place;
}
