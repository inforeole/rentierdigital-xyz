import type { VercelRequest, VercelResponse } from "@vercel/node";

const PUB_ID = "pub_7ebd6adb-0115-4168-9360-360b138c8472";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UTM_RE = /^[a-zA-Z0-9_-]{1,64}$/;

// Lead-magnet automations: campaign → beehiiv automation ID
const CAMPAIGN_AUTOMATIONS: Record<string, string> = {
  "forgejo-kit": "aut_c925951e-5cf0-4aa1-a712-1f656e10e55c",
};

function sanitizeUtm(val: unknown, fallback: string): string {
  if (typeof val === "string" && UTM_RE.test(val)) return val;
  return fallback;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, utm_source, utm_medium, utm_campaign } = req.body ?? {};

  if (!email || typeof email !== "string" || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "Valid email required" });
  }

  const apiKey = process.env.BEEHIIV_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server misconfigured" });
  }

  const campaign = sanitizeUtm(utm_campaign, "blog");

  // Map lead-magnet campaigns to beehiiv tags so automations
  // trigger for both new AND existing subscribers.
  const CAMPAIGN_TAGS: Record<string, string> = {
    "forgejo-kit": "forgejo-kit",
  };
  const tags = CAMPAIGN_TAGS[campaign] ? [CAMPAIGN_TAGS[campaign]] : [];

  const response = await fetch(
    `https://api.beehiiv.com/v2/publications/${PUB_ID}/subscriptions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        send_welcome_email: true,
        double_opt_in: true,
        utm_source: sanitizeUtm(utm_source, "astro"),
        utm_medium: sanitizeUtm(utm_medium, "embed"),
        utm_campaign: campaign,
        ...(tags.length > 0 && { tags }),
      }),
    }
  );

  if (!response.ok) {
    return res.status(response.status).json({ error: "Subscription failed" });
  }

  const data = await response.json();
  const subscriberEmail = email.trim().toLowerCase();
  const status = data.data?.status;

  // For existing (already active) subscribers, enroll them into
  // the lead-magnet automation via the journeys API so they get
  // the kit email even though the "Signed up" trigger won't fire.
  const automationId = CAMPAIGN_AUTOMATIONS[campaign];
  if (automationId && status === "active") {
    fetch(
      `https://api.beehiiv.com/v2/publications/${PUB_ID}/automations/${automationId}/journeys`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: subscriberEmail }),
      }
    ).catch(() => {}); // fire-and-forget, don't block the response
  }

  return res.status(200).json({ ok: true, id: data.data?.id });
}
