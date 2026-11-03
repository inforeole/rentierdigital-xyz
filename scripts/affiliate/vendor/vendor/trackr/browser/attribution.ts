// Copié de /Users/phil/dv/trackr/browser/attribution.ts le 2026-11-02.
import {
  ATTRIBUTION_MAX_AGE_MS,
  ATTRIBUTION_PARAM,
  type InitialAttribution,
} from "../frontdoor/attribution";

const STORAGE_KEY = "trackr.initial-attribution.v1";
const MARKETING_VALUE = /^[A-Za-z0-9][A-Za-z0-9._ -]{0,99}$/;

export interface TrackrAttributionOptions {
  trackerURLs: string[];
  decorateLinks?: boolean;
  now?: () => number;
}

export interface TrackrAttribution {
  readonly attribution: InitialAttribution | null;
  decorateURL(input: string | URL): string;
  stop(): void;
}

function validStored(value: unknown, origin: string, now: number): InitialAttribution | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;
  if (p.v !== 1 || p.status !== "collected" || typeof p.ts !== "number" || !Number.isSafeInteger(p.ts) || p.ts <= 0 || now - p.ts > ATTRIBUTION_MAX_AGE_MS || p.ts - now > 5 * 60 * 1000 || p.entry !== origin) return null;
  if (p.referrer !== undefined && (typeof p.referrer !== "string" || p.referrer === origin)) return null;
  for (const key of ["source", "medium", "campaign"] as const) {
    const field = p[key];
    if (field !== undefined && (typeof field !== "string" || !MARKETING_VALUE.test(field))) return null;
  }
  return p as unknown as InitialAttribution;
}

function capture(now: number): InitialAttribution | null {
  const query = new URLSearchParams(location.search);
  const marketing = (name: string): string | undefined => {
    const value = query.get(name)?.trim();
    return value && MARKETING_VALUE.test(value) ? value : undefined;
  };
  let referrer: string | undefined;
  try {
    if (document.referrer) {
      const origin = new URL(document.referrer).origin;
      // Un référent interne sans capture conservée ne prouve pas l’arrivée initiale.
      if (origin === location.origin) return null;
      if ((origin.startsWith("https://") || origin.startsWith("http://")) && origin !== location.origin) referrer = origin;
    }
  } catch { /* un référent illisible est simplement absent */ }
  return {
    v: 1, status: "collected", ts: now, entry: location.origin,
    ...(referrer ? { referrer } : {}),
    ...(marketing("utm_source") ? { source: marketing("utm_source") } : {}),
    ...(marketing("utm_medium") ? { medium: marketing("utm_medium") } : {}),
    ...(marketing("utm_campaign") ? { campaign: marketing("utm_campaign") } : {}),
  };
}

function encode(value: InitialAttribution): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function initTrackrAttribution(options: TrackrAttributionOptions): TrackrAttribution {
  if (!Array.isArray(options.trackerURLs) || options.trackerURLs.length === 0) throw new Error("trackerURLs doit contenir au moins une URL");
  const now = (options.now ?? Date.now)();
  let stored: InitialAttribution | null = null;
  let rawStored: string | null = null;
  try { rawStored = sessionStorage.getItem(STORAGE_KEY); } catch { /* stockage indisponible */ }
  if (rawStored !== null) {
    try { stored = validStored(JSON.parse(rawStored), location.origin, now); } catch { /* valeur invalide */ }
  }
  const attribution = rawStored === null ? capture(now) : stored;
  if (rawStored === null || !stored) {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attribution)); } catch { /* le clic de la page courante reste décoré */ }
  }
  const allowed = options.trackerURLs.map((raw) => new URL(raw, location.href));
  const decorateURL = (input: string | URL): string => {
    const url = new URL(input.toString(), location.href);
    const match = allowed.some((base) => url.origin === base.origin && url.pathname.startsWith(base.pathname));
    if (!match || !attribution) return url.href;
    url.searchParams.set(ATTRIBUTION_PARAM, encode(attribution));
    return url.href;
  };
  const onClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest("a[href]");
    if (!(anchor instanceof HTMLAnchorElement)) return;
    const decorated = decorateURL(anchor.href);
    if (decorated !== anchor.href) anchor.href = decorated;
  };
  const linkEvents = ["click", "auxclick", "contextmenu"] as const;
  if (options.decorateLinks !== false) {
    for (const event of linkEvents) document.addEventListener(event, onClick, true);
  }
  return {
    attribution, decorateURL,
    stop: () => {
      for (const event of linkEvents) document.removeEventListener(event, onClick, true);
    },
  };
}
