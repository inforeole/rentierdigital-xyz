// Types et constantes extraits de /Users/phil/dv/trackr/frontdoor/attribution.ts le 2026-11-02.
export const ATTRIBUTION_PARAM = "__trk_attr";
export const ATTRIBUTION_MAX_AGE_MS = 4 * 60 * 60 * 1000;

export interface InitialAttribution {
  v: 1;
  status: "collected";
  ts: number;
  entry: string;
  referrer?: string;
  source?: string;
  medium?: string;
  campaign?: string;
}
