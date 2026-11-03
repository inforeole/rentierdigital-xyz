export const TRACKED_AFFILIATE_VARIANTS = ["base64url", "xor-base64url", "reverse-base64url"] as const;

export type TrackedAffiliateVariant = (typeof TRACKED_AFFILIATE_VARIANTS)[number];

export interface TrackedAffiliateSiteConfig {
  readonly domain: string;
  readonly variant: TrackedAffiliateVariant;
  readonly xorKey: number;
  readonly payloadPrefix: string;
  readonly controlAttribute: string;
  readonly placementAttribute: string;
  readonly runtimeAttribute: string;
  readonly identifiers: {
    readonly selector: string;
    readonly decode: string;
    readonly activate: string;
    readonly click: string;
    readonly keydown: string;
    readonly attribution: string;
  };
}

const MAX_PAYLOAD_LENGTH = 4096;
const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

function normalizedDomain(value: string): string {
  const candidate = value.includes("://") ? new URL(value).hostname : value;
  const domain = candidate.trim().toLowerCase().replace(/\.$/, "");
  if (!/^[a-z0-9.-]+$/.test(domain) || !domain.includes(".")) {
    throw new Error(`tracked affiliates: domaine invalide (${value})`);
  }
  return domain;
}

/** FNV-1a 32 bits, stable sur tous les runtimes JS. */
export function trackedAffiliateDomainHash(value: string): number {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(normalizedDomain(value))) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export function createTrackedAffiliateSiteConfig(value: string): TrackedAffiliateSiteConfig {
  const domain = normalizedDomain(value);
  const hash = trackedAffiliateDomainHash(domain);
  const hex = hash.toString(16).padStart(8, "0");
  const suffix = hex.slice(0, 6);
  return {
    domain,
    variant: TRACKED_AFFILIATE_VARIANTS[hash % TRACKED_AFFILIATE_VARIANTS.length]!,
    xorKey: ((hash >>> 8) % 251) + 1,
    payloadPrefix: `${hex.slice(6)}.`,
    controlAttribute: `data-${hex.slice(0, 3)}-${hex.slice(3, 7)}`,
    placementAttribute: `data-${hex.slice(1, 5)}-${hex.slice(5)}`,
    runtimeAttribute: `data-${hex.slice(2, 6)}-ready`,
    identifiers: {
      selector: `q${suffix}`,
      decode: `d${suffix}`,
      activate: `a${suffix}`,
      click: `c${suffix}`,
      keydown: `k${suffix}`,
      attribution: `t${suffix}`,
    },
  };
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) return null;
  let binary: string;
  try {
    binary = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
  } catch {
    return null;
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return toBase64Url(bytes) === value ? bytes : null;
}

function transformedBytes(bytes: Uint8Array, config: TrackedAffiliateSiteConfig): Uint8Array {
  const output = Uint8Array.from(bytes);
  if (config.variant === "xor-base64url") {
    for (let index = 0; index < output.length; index++) output[index] = output[index]! ^ config.xorKey;
  } else if (config.variant === "reverse-base64url") {
    output.reverse();
  }
  return output;
}

function validDestination(value: string): string | null {
  let destination: URL;
  try {
    destination = new URL(value);
  } catch {
    return null;
  }
  return HTTP_PROTOCOLS.has(destination.protocol) && destination.username === "" && destination.password === ""
    ? destination.href
    : null;
}

export function encodeTrackedDestination(destination: string, config: TrackedAffiliateSiteConfig): string {
  const canonical = validDestination(destination);
  if (!canonical) throw new Error("tracked affiliates: destination HTTP(S) invalide");
  const payload = `${config.payloadPrefix}${toBase64Url(transformedBytes(new TextEncoder().encode(canonical), config))}`;
  if (payload.length > MAX_PAYLOAD_LENGTH) throw new Error("tracked affiliates: payload trop long");
  return payload;
}

export function decodeTrackedDestination(payload: string, config: TrackedAffiliateSiteConfig): string | null {
  if (payload.length > MAX_PAYLOAD_LENGTH || !payload.startsWith(config.payloadPrefix)) return null;
  const bytes = fromBase64Url(payload.slice(config.payloadPrefix.length));
  if (!bytes) return null;
  let decoded: string;
  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(transformedBytes(bytes, config));
  } catch {
    return null;
  }
  return validDestination(decoded);
}
