import { parse, type HTMLElement } from "node-html-parser";
import {
  decodeTrackedDestination,
  encodeTrackedDestination,
  type TrackedAffiliateSiteConfig,
} from "./trackedAffiliateObfuscation";

export interface AffiliateLabel { readonly product: string; readonly merchant: string; readonly trackerOrigin?: string }
export interface VerifiedAffiliate extends AffiliateLabel { readonly token: string }
export interface DirectAffiliateEvidence extends AffiliateLabel { readonly href: string; readonly token?: string; readonly evidence: string }
export interface DeferredUnverifiedLink { readonly pagePathname: string; readonly href: string }
export interface TrackedAffiliateRegistry {
  readonly siteOrigin: string;
  readonly locale: string;
  readonly trackerOrigin: string;
  readonly verifiedGoLinks: Readonly<Record<string, AffiliateLabel>>;
  readonly verifiedVLinks: Readonly<Record<string, VerifiedAffiliate>>;
  /** Chemins locaux exacts déjà publiés, notamment les alias racine et les routes /g/ ou /go/. */
  readonly verifiedPathLinks?: Readonly<Record<string, VerifiedAffiliate>>;
  readonly directAffiliateLinks?: readonly DirectAffiliateEvidence[];
  /** Les liens reportés restent ordinaires uniquement sur le couple exact page + href documenté. */
  readonly deferredUnverifiedLinks?: readonly DeferredUnverifiedLink[];
  readonly localGoRouteIsAffiliate?: boolean;
  readonly ordinaryLocalPaths?: readonly string[];
}
export interface TrackedAffiliateTransformReport { readonly originalAffiliateCount: number; readonly transformedAffiliateCount: number; readonly placements: readonly string[] }
export interface TrackedAffiliateTransformResult { readonly html: string; readonly report: TrackedAffiliateTransformReport }
interface ResolvedAffiliate extends VerifiedAffiliate { readonly originalS5: string | null }
type TrackingParams = Partial<Record<"s1" | "s2" | "s3" | "s4" | "s5", string>>;

const FORBIDDEN_REL = new Set(["sponsored", "ugc"]);
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;
function normalizedOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error(`tracked affiliates: origine HTTP(S) requise (${value})`);
  return url.origin;
}
export function normalizedTrackedPathname(value: string): string {
  const leading = value.startsWith("/") ? value : `/${value}`;
  const trimmed = leading.replace(/\/+$/, "");
  if (/\.html?$/i.test(trimmed)) return trimmed;
  return leading === "/" ? leading : trimmed;
}
function exactRouteToken(pathname: string, route: "go" | "v"): string | null {
  const parts = pathname.split("/").filter(Boolean);
  return parts.length === 2 && parts[0] === route ? parts[1] ?? null : null;
}
function exactDirectHref(url: URL): string { url.hash = ""; return url.href; }
function verifiedExactPath(registry: TrackedAffiliateRegistry, pathname: string): VerifiedAffiliate | undefined {
  return registry.verifiedPathLinks?.[normalizedTrackedPathname(pathname)];
}
function hasStrictAffiliatePathPrefix(registry: TrackedAffiliateRegistry, pathname: string): boolean {
  const prefix = pathname.split("/").filter(Boolean)[0];
  if (prefix !== "g" && prefix !== "go") return false;
  const normalizedPrefix = `/${prefix}/`;
  return Object.keys(registry.verifiedPathLinks ?? {}).some((path) => normalizedTrackedPathname(path).startsWith(normalizedPrefix));
}
function isDeferredUnverifiedLink(registry: TrackedAffiliateRegistry, pagePathname: string, href: string): boolean {
  const page = normalizedTrackedPathname(pagePathname);
  return (registry.deferredUnverifiedLinks ?? []).some((entry) => entry.pagePathname === page && entry.href === href);
}

/** Ne résout que les preuves explicites. Les marchands et les routes génériques restent ordinaires. */
export function resolveConfirmedAffiliate(href: string, pagePathname: string, registry: TrackedAffiliateRegistry): ResolvedAffiliate | null {
  const siteOrigin = normalizedOrigin(registry.siteOrigin);
  const siteHostname = new URL(siteOrigin).hostname;
  const trackerOrigin = normalizedOrigin(registry.trackerOrigin);
  let candidate: URL;
  try { candidate = new URL(href, `${siteOrigin}${normalizedTrackedPathname(pagePathname)}`); } catch { return null; }
  if (candidate.origin === siteOrigin && registry.ordinaryLocalPaths?.includes(candidate.pathname.replace(/\/$/, ""))) return null;
  const direct = (registry.directAffiliateLinks ?? []).find((item) => {
    try { return exactDirectHref(new URL(item.href)) === exactDirectHref(new URL(candidate)); } catch { return false; }
  });
  if (direct) {
    if (!direct.token || !TOKEN_PATTERN.test(direct.token)) throw new Error(`tracked affiliates: affiliation confirmée sans jeton Trackr vérifié (${candidate.href}; preuve: ${direct.evidence})`);
    return { token: direct.token, product: direct.product, merchant: direct.merchant, trackerOrigin: direct.trackerOrigin, originalS5: candidate.searchParams.get("s5") };
  }
  if ((candidate.protocol === "https:" || candidate.protocol === "http:") && candidate.hostname === siteHostname) {
    const exactPath = verifiedExactPath(registry, candidate.pathname);
    if (exactPath) return { ...exactPath, originalS5: candidate.searchParams.get("s5") };
    if (/^\/(?:es|fr|en|de|it|pt|nl)\/v\/[^/]+\/?$/.test(candidate.pathname)) {
      if (isDeferredUnverifiedLink(registry, pagePathname, href)) return null;
      throw new Error("tracked affiliates: route affiliée localisée sans mapping vérifié");
    }
    const vSlug = exactRouteToken(candidate.pathname, "v");
    if (vSlug) {
      const mapped = registry.verifiedVLinks[vSlug];
      if (!mapped && isDeferredUnverifiedLink(registry, pagePathname, href)) return null;
      if (!mapped) throw new Error(`tracked affiliates: /v/${vSlug}/ est une route affiliée sans mapping Convex vérifié`);
      return { ...mapped, originalS5: candidate.searchParams.get("s5") };
    }
    const goToken = exactRouteToken(candidate.pathname, "go");
    const label = goToken ? registry.verifiedGoLinks[goToken] : undefined;
    if (goToken && !label && isDeferredUnverifiedLink(registry, pagePathname, href)) return null;
    if (goToken && !label && (registry.localGoRouteIsAffiliate || hasStrictAffiliatePathPrefix(registry, candidate.pathname))) throw new Error("tracked affiliates: route affiliée /go sans jeton vérifié");
    if (!goToken && hasStrictAffiliatePathPrefix(registry, candidate.pathname)) throw new Error("tracked affiliates: route affiliée explicite sans chemin vérifié");
    return goToken && label ? { token: goToken, ...label, originalS5: candidate.searchParams.get("s5") } : null;
  }
  if (candidate.origin === trackerOrigin || Object.values(registry.verifiedGoLinks).some(label => label.trackerOrigin === candidate.origin)) {
    const parts = candidate.pathname.split("/").filter(Boolean);
    const token = parts.length === 1 ? parts[0] : undefined;
    const label = token ? registry.verifiedGoLinks[token] : undefined;
    if (token && label && (label.trackerOrigin ?? trackerOrigin) === candidate.origin) return { token, ...label, originalS5: candidate.searchParams.get("s5") };
    throw new Error("tracked affiliates: URL Trackr sans jeton vérifié");
  }
  const amazonTagged = /(^|\.)amazon\.(?:fr|com|de|es|it|co\.uk|ca|com\.au|co\.jp)$/.test(candidate.hostname) && candidate.searchParams.has("tag");
  const affiliateNetwork = /(^|\.)(?:awin1\.com|anrdoezrs\.net|jdoqocy\.com|dpbolvw\.net|tkqlhce\.com)$/.test(candidate.hostname);
  if (amazonTagged || affiliateNetwork) {
    if (isDeferredUnverifiedLink(registry, pagePathname, href)) return null;
    throw new Error("tracked affiliates: destination affiliée directe sans mapping Trackr vérifié");
  }
  return null;
}

function assertPageLocale(pagePathname: string, locale: string): void {
  const language = locale.toLowerCase().split(/[-_]/)[0];
  const prefix = pagePathname.split("/").filter(Boolean)[0]?.toLowerCase();
  if (prefix && new Set(["de", "en", "es", "fr", "it", "nl", "pt"]).has(prefix) && prefix !== language) {
    throw new Error(`tracked affiliates: route multi-locale ${pagePathname} incompatible avec la locale ${locale}`);
  }
}

function classes(element: HTMLElement): string[] { return (element.getAttribute("class") ?? "").split(/\s+/).filter(Boolean); }
function placementKind(anchor: HTMLElement): string {
  let current: HTMLElement | null = anchor;
  while (current) {
    const values = classes(current);
    if (values.some((value) => value.endsWith("-cta--card"))) return "cta-card";
    if (values.some((value) => value.endsWith("-cta--band"))) return "cta-band";
    if (values.some((value) => value.endsWith("-cta--verdict"))) return "cta-verdict";
    if (values.includes("wp-block-button")) return "button";
    const parent: unknown = current.parentNode;
    current = parent !== null && typeof parent === "object" && "tagName" in parent ? parent as HTMLElement : null;
  }
  return anchor.querySelector("article, [class*='card']") ? "card" : "inline";
}
function localizedOfferLabel(locale: string): string {
  const language = locale.toLowerCase().split(/[-_]/)[0];
  return language === "de" ? "Angebot ansehen" : language === "en" ? "View the offer" : "Consulter l’offre";
}
function isDestinationLabel(value: string): boolean {
  const trimmed = value.trim();
  if (/^\/(?:g|go|v)\//i.test(trimmed)) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
function accessibleName(anchor: HTMLElement, affiliate: AffiliateLabel, locale: string): string {
  const language = locale.toLowerCase().split(/[-_]/)[0];
  const fallback = localizedOfferLabel(locale);
  const candidate = anchor.getAttribute("aria-label")?.trim() || anchor.textContent.replace(/\s+/g, " ").trim() || anchor.querySelector("img[alt]")?.getAttribute("alt")?.trim() || anchor.getAttribute("title")?.trim() || fallback;
  const current = isDestinationLabel(candidate) ? fallback : candidate;
  if (language === "de") return `${current}: ${affiliate.product}, angeboten von ${affiliate.merchant}`;
  if (language === "en") return `${current}: ${affiliate.product}, offered by ${affiliate.merchant}`;
  return `${current} : ${affiliate.product}, proposé par ${affiliate.merchant}`;
}
function forbiddenRelTokens(root: HTMLElement): string[] {
  const found = new Set<string>();
  for (const element of root.querySelectorAll("[rel]")) for (const token of (element.getAttribute("rel") ?? "").toLowerCase().split(/\s+/)) if (FORBIDDEN_REL.has(token)) found.add(token);
  return [...found].sort();
}
function verifiedTokens(registry: TrackedAffiliateRegistry): Set<string> {
  return new Set([...Object.keys(registry.verifiedGoLinks), ...Object.values(registry.verifiedVLinks).map((value) => value.token), ...Object.values(registry.verifiedPathLinks ?? {}).map((value) => value.token), ...(registry.directAffiliateLinks ?? []).flatMap((value) => value.token ? [value.token] : [])]);
}
function labelsForToken(registry: TrackedAffiliateRegistry, token: string): VerifiedAffiliate[] {
  const go = registry.verifiedGoLinks[token];
  const labels = [
    ...(go ? [{ token, ...go }] : []),
    ...Object.values(registry.verifiedVLinks).filter((value) => value.token === token),
    ...Object.values(registry.verifiedPathLinks ?? {}).filter((value) => value.token === token),
    ...(registry.directAffiliateLinks ?? []).flatMap((value) => value.token === token ? [{ token, product: value.product, merchant: value.merchant, trackerOrigin: value.trackerOrigin }] : []),
  ];
  const unique = new Map(labels.map((label) => [`${label.product}\n${label.merchant}`, label]));
  return [...unique.values()];
}

export async function assertTrackedAffiliateHtml(input: { html: string; pagePathname: string; registry: TrackedAffiliateRegistry; config: TrackedAffiliateSiteConfig; expectedAffiliateCount?: number }): Promise<void> {
  const root = parse(input.html, { comment: true });
  const forbidden = forbiddenRelTokens(root);
  if (forbidden.length) throw new Error(`tracked affiliates: rel interdit détecté (${forbidden.join(", ")})`);
  for (const anchor of root.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href");
    if (href && resolveConfirmedAffiliate(href, input.pagePathname, input.registry)) throw new Error(`tracked affiliates: href affilié résiduel (${href})`);
  }
  for (const iframe of root.querySelectorAll("iframe[src]")) {
    const raw = iframe.getAttribute("src");
    if (!raw) continue;
    let widget: URL;
    try { widget = new URL(raw, input.registry.siteOrigin); } catch { continue; }
    if (widget.hostname === "ws-eu.amazon-adsystem.com" && widget.pathname === "/widgets/q"
      && widget.searchParams.get("Operation") === "GetAdHtml"
      && widget.searchParams.get("ad_type") === "product_link"
      && widget.searchParams.get("tracking_id")) {
      throw new Error("tracked affiliates: widget Amazon affilié résiduel");
    }
  }
  const controls = root.querySelectorAll(`[${input.config.controlAttribute}]`);
  if (input.expectedAffiliateCount !== undefined && controls.length !== input.expectedAffiliateCount) throw new Error(`tracked affiliates: ${controls.length} contrôles rendus pour ${input.expectedAffiliateCount} liens affiliés initiaux`);
  const tokens = verifiedTokens(input.registry);
  const expectedPath = normalizedTrackedPathname(input.pagePathname);
  const placements = new Set<string>();
  for (const control of controls) {
    for (const attribute of ["href", "rel", "target"] as const) if (control.hasAttribute(attribute)) throw new Error(`tracked affiliates: ${attribute} interdit sur un contrôle suivi`);
    if (control.tagName !== "BUTTON" && (control.getAttribute("role") !== "button" || control.getAttribute("tabindex") !== "0")) throw new Error("tracked affiliates: contrôle non natif sans role=button et tabindex=0");
    const raw = control.getAttribute(input.config.controlAttribute) ?? "";
    const decoded = decodeTrackedDestination(raw, input.config);
    if (!decoded) throw new Error("tracked affiliates: payload réversible invalide");
    const link = new URL(decoded);
    const parts = link.pathname.split("/").filter(Boolean);
    const token = parts.length === 1 ? parts[0] : undefined;
    if (!token || !tokens.has(token) || !labelsForToken(input.registry, token).some(label => link.origin === normalizedOrigin(label.trackerOrigin ?? input.registry.trackerOrigin))) throw new Error("tracked affiliates: destination ou jeton non vérifié");
    const allowedParams = new Set(["s1", "s2", "s3", "s4", "s5"]);
    if ([...link.searchParams.keys()].some((key) => !allowedParams.has(key))) throw new Error("tracked affiliates: sous-identifiant inattendu dans le payload");
    const placement = link.searchParams.get("s2") ?? "";
    if (!placement || placements.has(placement)) throw new Error(`tracked affiliates: placement s2 absent ou dupliqué (${placement})`);
    placements.add(placement);
    if (link.searchParams.get("s1") !== new URL(input.registry.siteOrigin).hostname || link.searchParams.get("s3") !== input.registry.locale || link.searchParams.get("s4") !== expectedPath) throw new Error("tracked affiliates: sous-identifiants incomplets");
    const labels = labelsForToken(input.registry, token);
    const aria = control.getAttribute("aria-label") ?? "";
    if (!labels.some((label) => aria.includes(label.product) && aria.includes(label.merchant))) {
      const expected = labels.map((label) => `${label.product}; ${label.merchant}`).join(" ou ") || "produit et marchand inconnus";
      throw new Error(`tracked affiliates: aria-label doit nommer le produit et le marchand (${input.pagePathname}; ${expected}; ${aria || "aria absent"})`);
    }
  }
  if (controls.length > 0 && !root.querySelector(`[${input.config.runtimeAttribute}]`)) throw new Error("tracked affiliates: runtime absent d’une page affiliée");
}

function assertNoScriptedAffiliate(input: { html: string; pagePathname: string; registry: TrackedAffiliateRegistry }): void {
  for (const script of input.html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)) {
    for (const source of script[0].matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)) {
      const href = parse(source[0]).querySelector("a[href]")?.getAttribute("href");
      if (href && resolveConfirmedAffiliate(href, input.pagePathname, input.registry)) {
        throw new Error("tracked affiliates: CTA affilié inséré dans un script ; corriger son emplacement source");
      }
    }
  }
}

export async function transformTrackedAffiliateHtml(input: { html: string; pagePathname: string; registry: TrackedAffiliateRegistry; config: TrackedAffiliateSiteConfig; runtimeSource: string }): Promise<TrackedAffiliateTransformResult> {
  const counters = new Map<string, number>();
  const placements: string[] = [];
  let count = 0;
  const transformAnchor = (anchor: HTMLElement, resolved: ResolvedAffiliate): void => {
    assertPageLocale(input.pagePathname, input.registry.locale);
    count++;
    const kind = placementKind(anchor);
    const ordinal = (counters.get(kind) ?? 0) + 1;
    counters.set(kind, ordinal);
    const placement = `${kind}-${ordinal}`;
    placements.push(placement);
    const params: TrackingParams = { s1: new URL(input.registry.siteOrigin).hostname, s2: placement, s3: input.registry.locale, s4: normalizedTrackedPathname(input.pagePathname) };
    if (resolved.originalS5) params.s5 = resolved.originalS5;
    const destination = new URL(`/${resolved.token}`, resolved.trackerOrigin ?? input.registry.trackerOrigin);
    for (const key of ["s1", "s2", "s3", "s4", "s5"] as const) {
      const value = params[key];
      if (value) destination.searchParams.set(key, value);
    }
    const payload = encodeTrackedDestination(destination.href, input.config);
    const originalHref = anchor.getAttribute("href") ?? "";
    if (anchor.textContent.replace(/\s+/g, " ").trim() === originalHref.trim()) anchor.set_content(localizedOfferLabel(input.registry.locale));
    if (anchor.getAttribute("title")?.trim() === originalHref.trim()) anchor.setAttribute("title", resolved.product);
    if (anchor.getAttribute("data-type") === "URL" && anchor.getAttribute("data-id") === anchor.getAttribute("href")) anchor.removeAttribute("data-id");
    for (const [name, value] of Object.entries(anchor.attributes)) {
      if (!/^data-(?:href|url|destination|link)$/i.test(name)) continue;
      if (value === anchor.getAttribute("href")) {
        anchor.setAttribute(name, payload);
        continue;
      }
      const transported = resolveConfirmedAffiliate(value, input.pagePathname, input.registry);
      if (transported?.token === resolved.token) anchor.setAttribute(name, payload);
    }
    anchor.removeAttribute("href"); anchor.removeAttribute("rel"); anchor.removeAttribute("target");
    anchor.setAttribute(input.config.controlAttribute, payload); anchor.setAttribute(input.config.placementAttribute, placement);
    anchor.setAttribute("role", "button"); anchor.setAttribute("tabindex", "0"); anchor.setAttribute("aria-label", accessibleName(anchor, resolved, input.registry.locale));
  };
  assertNoScriptedAffiliate(input);
  const root = parse(input.html, { comment: true });
  for (const anchor of root.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href");
    if (!href) continue;
    const resolved = resolveConfirmedAffiliate(href, input.pagePathname, input.registry);
    if (!resolved) continue;
    transformAnchor(anchor, resolved);
  }
  const redirectsImmediately = root.querySelectorAll("meta[http-equiv]").some(meta => meta.getAttribute("http-equiv")?.toLowerCase() === "refresh");
  if (count > 0 || (root.querySelector("head") !== null && !redirectsImmediately)) {
    const runtimeHost = root.querySelector("head") ?? root;
    runtimeHost.insertAdjacentHTML("beforeend", `<script ${input.config.runtimeAttribute}="v2">${input.runtimeSource}</script>`);
    if (count > 0) {
      const selector = `[${input.config.controlAttribute}]`;
      runtimeHost.insertAdjacentHTML("beforeend", `<style ${input.config.runtimeAttribute}="style">${selector}{cursor:pointer}${selector}:focus-visible{outline:2px solid currentColor;outline-offset:3px}</style>`);
    }
  }
  const html = root.toString();
  await assertTrackedAffiliateHtml({ html, pagePathname: input.pagePathname, registry: input.registry, config: input.config, expectedAffiliateCount: count });
  return { html, report: { originalAffiliateCount: count, transformedAffiliateCount: count, placements } };
}

/** Le flux renvoie à l’article du site, où le lecteur peut activer le bouton opaque. */
export async function transformTrackedAffiliateFeedFragment(input: { html: string; pagePathname: string; registry: TrackedAffiliateRegistry }): Promise<{ html: string; count: number }> {
  assertNoScriptedAffiliate(input);
  let count = 0;
  let parsedHTML = input.html.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, (source) => {
    const root = parse(source, { comment: true });
    const anchor = root.querySelector("a[href]");
    if (!anchor) return source;
    const href = anchor.getAttribute("href");
    if (!href) return source;
    const resolved = resolveConfirmedAffiliate(href, input.pagePathname, input.registry);
    if (!resolved) return source;
    assertPageLocale(input.pagePathname, input.registry.locale);
    count++;
    const local = new URL(input.pagePathname, input.registry.siteOrigin);
    anchor.setAttribute("href", local.href);
    anchor.removeAttribute("rel"); anchor.removeAttribute("target");
    anchor.setAttribute("aria-label", accessibleName(anchor, resolved, input.registry.locale));
    return root.toString();
  });
  const markdownDestination = /(\]\(\s*)([^\s)]+)(\s*(?:"[^"]*"|'[^']*')?\s*\))/g;
  let output = "";
  let cursor = 0;
  for (const match of parsedHTML.matchAll(markdownDestination)) {
    const index = match.index;
    const href = match[2] ?? "";
    const resolved = resolveConfirmedAffiliate(href, input.pagePathname, input.registry);
    if (!resolved) continue;
    assertPageLocale(input.pagePathname, input.registry.locale);
    count++;
    const local = new URL(input.pagePathname, input.registry.siteOrigin);
    output += parsedHTML.slice(cursor, index) + `${match[1]}${local.href}${match[3]}`;
    cursor = index + match[0].length;
  }
  return { html: output + parsedHTML.slice(cursor), count };
}
