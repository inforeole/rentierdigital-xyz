import { expect, test } from "bun:test";
import { parse } from "node-html-parser";
import { createRegistry, assertSourceAffiliates, CONFIG, DEFERRED, type RegistryResponse } from "./integration";
import { transformTrackedAffiliateHtml } from "./vendor/trackedAffiliate";
import { decodeTrackedDestination } from "./vendor/trackedAffiliateObfuscation";
const response: RegistryResponse = {version: 1, unverified: [{slug: "unverified", reason: "missing_source"}], verified: [
  {slug: "offer", name: "Offer", lang: "EN", url_redirection: "https://go.rentierdigital.xyz/rdtoken", token: "rdtoken", campaignId: 1, destinations: ["https://merchant.example/?ref=test"]},
  {slug: "second", name: "Second", lang: "EN", url_redirection: "https://go.gozrk.com/othertoken", token: "othertoken", campaignId: 2, destinations: ["https://second.example/?ref=test"]},
  {slug: "french", name: "French", lang: "FR", url_redirection: "https://go.rentierdigital.xyz/frtoken", token: "frtoken", campaignId: 3, destinations: ["https://merchant.fr/?ref=test"]},
]};
test("both verified tracker hosts retain attribution without exposing their URLs", async () => {
  const html = '<html lang="en"><head></head><body><a class="cta" href="/go/offer">Offer</a><a href="/go/second">Second</a><a href="/go/wizard">My product</a><a href="https://www.amazon.com/dp/OWNBOOK">My book</a></body></html>';
  assertSourceAffiliates(html, response);
  const result = await transformTrackedAffiliateHtml({html, pagePathname: "/blog/article/", registry: createRegistry(response), config: CONFIG, runtimeSource: "void 0"});
  const doc = parse(result.html);const buttons = doc.querySelectorAll(`[${CONFIG.controlAttribute}]`);
  expect(buttons).toHaveLength(2);
  expect(result.html).not.toContain("go.rentierdigital.xyz");expect(result.html).not.toContain("go.gozrk.com");
  expect(doc.querySelector('[href="/go/wizard"]')).not.toBeNull();
  expect(doc.querySelector('[href="https://www.amazon.com/dp/OWNBOOK"]')).not.toBeNull();
  expect(buttons[0]?.getAttribute("class")).toBe("cta");
  const urls = buttons.map(button => new URL(decodeTrackedDestination(button.getAttribute(CONFIG.controlAttribute)!, CONFIG)!));
  expect(urls.map(url => url.origin)).toEqual(["https://go.rentierdigital.xyz", "https://go.gozrk.com"]);
  for (const url of urls) {expect(url.searchParams.get("s1")).toBe("rentierdigital.xyz");expect(url.searchParams.get("s3")).toBe("en");expect(url.searchParams.get("s4")).toBe("/blog/article");}
});
test("unverified aliases and incompatible languages stop publication", () => {
  expect(() => assertSourceAffiliates('<a href="/go/unverified">Offer</a>', response)).toThrow("not verified");
  expect(() => assertSourceAffiliates('<html lang="en"><a href="/go/french">Offre</a></html>', response)).toThrow("language mismatch");
});

test("existing unverified placements are confined to their page and count", async () => {
  const entry = DEFERRED[0];
  const html = `<html lang="en"><head></head><body><a href="${entry.href}">Contabo</a></body></html>`;
  const options = {html, registry: createRegistry(response), config: CONFIG, runtimeSource: "void 0"};
  const result = await transformTrackedAffiliateHtml({...options, pagePathname: entry.pagePathname});
  expect(parse(result.html).querySelector("a")?.getAttribute("href")).toBe(entry.href);
  await expect(transformTrackedAffiliateHtml({...options, pagePathname: "/blog/new-page"})).rejects.toThrow();
  expect(() => assertSourceAffiliates(html.repeat(entry.count + 1), response, entry.pagePathname)).toThrow("count increased");
});
