import type { VercelRequest, VercelResponse } from "@vercel/node";

const PUB_ID = "pub_7ebd6adb-0115-4168-9360-360b138c8472";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, utm_source, utm_medium, utm_campaign } = req.body ?? {};

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "Valid email required" });
  }

  const apiKey = process.env.BEEHIIV_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server misconfigured" });
  }

  const response = await fetch(
    `https://api.beehiiv.com/v2/publications/${PUB_ID}/subscriptions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        send_welcome_email: true,
        utm_source: utm_source || "astro",
        utm_medium: utm_medium || "embed",
        utm_campaign: utm_campaign || "blog",
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    return res.status(response.status).json({ error: text });
  }

  const data = await response.json();
  return res.status(200).json({ ok: true, id: data.data?.id });
}
