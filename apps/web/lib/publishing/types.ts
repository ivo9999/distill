export interface PublishRequest {
  markdown: string;
  subject: string;
  publicationId?: string;
  apiKey: string;
}

export interface PublishResult {
  publishedUrl: string;
}

export interface Publisher {
  publish(req: PublishRequest): Promise<PublishResult>;
}
