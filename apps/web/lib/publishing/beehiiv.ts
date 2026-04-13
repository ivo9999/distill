import type { Publisher, PublishRequest, PublishResult } from "./types";

export class BeehiivPublisher implements Publisher {
  async publish(req: PublishRequest): Promise<PublishResult> {
    const response = await fetch(
      `https://api.beehiiv.com/v2/publications/${req.publicationId}/posts`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${req.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: req.subject,
          subtitle: "",
          status: "draft",
          content: req.markdown,
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Beehiiv API error ${response.status}: ${text}`);
    }

    const data = await response.json();
    return { publishedUrl: data.data?.web_url ?? "" };
  }
}
