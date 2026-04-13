import type { Publisher, PublishRequest, PublishResult } from "./types";

export class ConvertKitPublisher implements Publisher {
  async publish(req: PublishRequest): Promise<PublishResult> {
    const response = await fetch(
      "https://api.convertkit.com/v4/broadcasts",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${req.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject: req.subject,
          content: req.markdown,
          public: false,
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ConvertKit API error ${response.status}: ${text}`);
    }

    const data = await response.json();
    return { publishedUrl: data.broadcast?.public_url ?? "" };
  }
}
