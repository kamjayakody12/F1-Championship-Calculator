"use client";

import { useEffect, useState } from "react";
import {
  PUBLIC_SEASON_COOKIE_NAME,
  PUBLIC_SEASON_EVENT,
  PUBLIC_SEASON_STORAGE_KEY,
} from "@/lib/public-season";

function readSeasonIdFromCookie(): string {
  if (typeof document === "undefined") return "";

  const cookie = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${PUBLIC_SEASON_COOKIE_NAME}=`));

  if (!cookie) return "";

  const value = cookie.split("=").slice(1).join("=");
  return decodeURIComponent(value || "");
}

function readSeasonId(): string {
  if (typeof window === "undefined") return "";

  const fromStorage = window.localStorage.getItem(PUBLIC_SEASON_STORAGE_KEY);
  if (fromStorage) return fromStorage;

  return readSeasonIdFromCookie();
}

export function persistPublicSeasonId(seasonId: string) {
  if (typeof window === "undefined") return;

  const normalized = seasonId || "";
  if (normalized) {
    window.localStorage.setItem(PUBLIC_SEASON_STORAGE_KEY, normalized);
    document.cookie = `${PUBLIC_SEASON_COOKIE_NAME}=${encodeURIComponent(normalized)}; path=/; max-age=31536000; samesite=lax`;
  } else {
    window.localStorage.removeItem(PUBLIC_SEASON_STORAGE_KEY);
    document.cookie = `${PUBLIC_SEASON_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
  }

  window.dispatchEvent(new CustomEvent(PUBLIC_SEASON_EVENT, { detail: normalized }));
}

export function usePublicSeasonId() {
  const [seasonId, setSeasonId] = useState<string>("");

  useEffect(() => {
    setSeasonId(readSeasonId());

    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== PUBLIC_SEASON_STORAGE_KEY) return;
      setSeasonId(readSeasonId());
    };

    const onSeasonChange = () => {
      setSeasonId(readSeasonId());
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(PUBLIC_SEASON_EVENT, onSeasonChange as EventListener);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(PUBLIC_SEASON_EVENT, onSeasonChange as EventListener);
    };
  }, []);

  return seasonId;
}
