import type { Publisher, PublishRequest, PublishResult } from "./types";
import crypto from "crypto";

export class GhostPublisher implements Publisher {
  async publish(req: PublishRequest): Promise<PublishResult> {
    const [id, secret] = req.apiKey.split(":");

    const header = Buffer.from(JSON.stringify({ alg: "HS256", kid: id, typ: "JWT" })).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(JSON.stringify({ iat: now, exp: now + 300, aud: "/admin/" })).toString("base64url");

    const signature = crypto
      .createHmac("sha256", Buffer.from(secret, "hex"))
      .update(`${header}.${payload}`)
      .digest("base64url");
    const token = `${header}.${payload}.${signature}`;

    const apiUrl = req.publicationId;
    const response = await fetch(`${apiUrl}/ghost/api/admin/posts/`, {
      method: "POST",
      headers: {
        Authorization: `Ghost ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        posts: [
          {
            title: req.subject,
            mobiledoc: JSON.stringify({
              version: "0.3.1",
              atoms: [],
              cards: [["markdown", { markdown: req.markdown }]],
              markups: [],
              sections: [[10, 0]],
            }),
            status: "draft",
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ghost API error ${response.status}: ${text}`);
    }

    const data = await response.json();
    return { publishedUrl: data.posts?.[0]?.url ?? "" };
  }
}
