"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, Save, Send, Eye, Pencil } from "lucide-react";

const platforms = [
  { id: "beehiiv", name: "Beehiiv", desc: "Email newsletter platform" },
  { id: "convertkit", name: "ConvertKit", desc: "Creator email marketing" },
  { id: "ghost", name: "Ghost", desc: "Publishing platform" },
];

export default function NewsletterEditorPage() {
  const params = useParams();
  const router = useRouter();
  const serverId = params.id as string;
  const newsletterId = params.nid as string;

  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);

  useEffect(() => {
    fetch(`/api/proxy/newsletters/${newsletterId}`)
      .then((r) => r.json())
      .then((data) => {
        setContent(data.edited_markdown || data.draft_markdown || "");
        setGeneratedAt(data.created_at);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch("/api/proxy/me")
      .then((r) => r.json())
      .then((u) => setIsSubscribed(u?.subscription_status === "active"))
      .catch(() => setIsSubscribed(false));
  }, [newsletterId]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    await fetch(`/api/proxy/newsletters/${newsletterId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ edited_markdown: content }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [newsletterId, content]);

  const handlePublish = async () => {
    if (!selectedPlatform) return;
    setPublishing(true);
    setPublishError(null);
    const res = await fetch(`/api/proxy/newsletters/${newsletterId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: selectedPlatform,
        subject: "Weekly Newsletter",
      }),
    });
    setPublishing(false);
    if (res.status === 402) {
      setPublishError("Subscribe to publish newsletters.");
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setPublishError(data.error || "Publish failed. Please try again.");
    }
  };

  const handleStartCheckout = async () => {
    const res = await fetch("/api/proxy/billing/checkout", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (data?.url) {
      window.location.href = data.url;
    }
  };

  // Ctrl/Cmd+S to save
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading editor...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              router.push(`/dashboard/servers/${serverId}/newsletters`)
            }
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-sm font-semibold leading-none">
              Newsletter Editor
            </h2>
            {generatedAt && (
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(generatedAt).toLocaleDateString("en-GB")}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile tab toggle */}
          <div className="flex md:hidden border rounded-lg overflow-hidden">
            <button
              onClick={() => setTab("edit")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === "edit"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
            <button
              onClick={() => setTab("preview")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === "preview"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Eye className="h-3 w-3" />
              Preview
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {saving ? "Saving..." : saved ? "Saved!" : "Save"}
          </Button>

          {isSubscribed === false ? (
            <Button size="sm" onClick={handleStartCheckout}>
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Subscribe to publish
            </Button>
          ) : (
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  Publish
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Publish Newsletter</DialogTitle>
                  <DialogDescription>
                    Choose where to publish this newsletter.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  {platforms.map((platform) => (
                    <button
                      key={platform.id}
                      onClick={() => setSelectedPlatform(platform.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                        selectedPlatform === platform.id
                          ? "border-foreground bg-muted"
                          : "border-border hover:border-foreground/30"
                      }`}
                    >
                      <span className="font-medium text-sm">
                        {platform.name}
                      </span>
                      <span className="block text-xs text-muted-foreground mt-0.5">
                        {platform.desc}
                      </span>
                    </button>
                  ))}
                </div>
                {publishError && (
                  <p className="text-sm text-negative">{publishError}</p>
                )}
                <DialogFooter>
                  <Button
                    onClick={handlePublish}
                    disabled={!selectedPlatform || publishing}
                    size="sm"
                  >
                    {publishing ? "Publishing..." : "Publish"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Editor / Preview split */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 min-h-0">
        {/* Editor pane */}
        <div
          className={`flex flex-col border-r ${tab === "preview" ? "hidden md:flex" : ""}`}
        >
          <div className="px-4 py-2 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:block">
            Markdown
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 w-full p-4 font-mono text-sm leading-relaxed resize-none bg-transparent outline-none placeholder:text-muted-foreground"
            placeholder="Write your newsletter in markdown..."
            spellCheck={false}
          />
        </div>

        {/* Preview pane */}
        <div
          className={`flex flex-col min-h-0 ${tab === "edit" ? "hidden md:flex" : ""}`}
        >
          <div className="px-4 py-2 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:block">
            Preview
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <article className="prose prose-sm prose-gray max-w-none prose-headings:font-semibold prose-h2:text-lg prose-h2:mt-8 prose-h2:mb-3 prose-p:leading-relaxed prose-p:text-muted-foreground prose-a:text-foreground prose-strong:text-foreground">
              <ReactMarkdown>{content}</ReactMarkdown>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}
