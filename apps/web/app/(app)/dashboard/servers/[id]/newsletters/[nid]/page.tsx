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
import { ArrowLeft, Save, Send, Eye, Pencil, Mail, ExternalLink, ChevronDown, ChevronRight, MessageSquare, Wand2, Scissors, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

type RegenerateDirective = "tighter" | "funnier" | "more_detail" | "rewrite_from_messages";

interface SubjectLineOption {
  text: string;
  rationale: string;
  style: "topical" | "curiosity" | "punchy";
}

const SUBJECT_STYLE_LABELS: Record<SubjectLineOption["style"], string> = {
  topical: "Topical",
  curiosity: "Curiosity",
  punchy: "Punchy",
};

const DIRECTIVE_LABELS: Record<RegenerateDirective, { label: string; hint: string }> = {
  tighter: { label: "Make it tighter", hint: "~30% shorter, same content" },
  funnier: { label: "Add a touch of humor", hint: "One dry, observational line" },
  more_detail: { label: "More detail", hint: "Pull more from the source thread" },
  rewrite_from_messages: { label: "Rewrite from source", hint: "Start over from the Discord thread" },
};

interface SourceMessage {
  id: string;
  authorName: string;
  content: string;
  timestamp: string;
  channelName?: string;
  discordChannelId?: string;
}

interface SourceSection {
  storyId: string;
  type: string;
  title: string;
  whyItMatters: string;
  messages: SourceMessage[];
}

// Build a Discord deep-link to a specific message. Discord exposes
// this scheme publicly: https://discord.com/channels/<g>/<c>/<m>.
// Clicking it lands the user inside the Discord client (or the web
// app) at the exact thread context — the single most powerful trust
// signal we can give: "click and verify what we summarized."
function discordPermalink(guildId: string, channelId: string | undefined, messageId: string): string | null {
  if (!guildId || !channelId) return null;
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

// Short, human-friendly relative time for source message stamps.
// Used in the "view sources" list — exact dates aren't useful when
// the user is just confirming "yes, this thread happened."
function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// findSectionRange locates the bounds of a section identified by its
// story marker. Returns null if missing. The end of a section is the
// next marker, the closing italic line, or end-of-string.
function findSectionRange(
  markdown: string,
  storyId: string,
): { start: number; end: number } | null {
  const escapedId = storyId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const markerRe = new RegExp(`<!--\\s*story:${escapedId}\\s*-->`);
  const m = markerRe.exec(markdown);
  if (!m) return null;
  const start = m.index;
  const tail = markdown.slice(start + m[0].length);
  const nextMarker = /<!--\s*story:[A-Za-z0-9_-]+\s*-->/.exec(tail);
  const closingLine = /(?:^|\n)\*What to watch next week:/m.exec(tail);
  let endOffset = tail.length;
  if (nextMarker && nextMarker.index < endOffset) endOffset = nextMarker.index;
  if (closingLine && closingLine.index < endOffset) endOffset = closingLine.index;
  return { start, end: start + m[0].length + endOffset };
}

// replaceSection swaps a section body identified by storyId with new
// markdown. We re-emit the marker so the source-map continues to
// resolve correctly even if the model accidentally dropped it.
function replaceSection(
  markdown: string,
  storyId: string,
  newBody: string,
): string {
  const range = findSectionRange(markdown, storyId);
  if (!range) return markdown;
  const before = markdown.slice(0, range.start);
  const after = markdown.slice(range.end);
  const marker = `<!-- story:${storyId} -->`;
  const trimmedBody = newBody.trim();
  return `${before}${marker}\n${trimmedBody}\n\n${after.replace(/^\n+/, "\n")}`;
}

// removeSection strips a section + its marker from the markdown.
function removeSection(markdown: string, storyId: string): string {
  const range = findSectionRange(markdown, storyId);
  if (!range) return markdown;
  const before = markdown.slice(0, range.start).replace(/\n+$/, "\n\n");
  const after = markdown.slice(range.end).replace(/^\n+/, "");
  return `${before}${after}`;
}

// EmailFramePreview renders the markdown as it'll appear in a typical
// inbox: a 600px-wide white card with serif body, blue links, modest
// line height, and a fake From/Subject header that anchors the visual
// metaphor. The styles are inlined (style attribute) rather than
// using Tailwind utility classes so the frame is visually stable
// regardless of dark mode — inboxes don't honor the dashboard theme.
function EmailFramePreview({ content, fromName }: { content: string; fromName: string }) {
  // Derive a subject line from the first heading or the first
  // sentence of the hook — same heuristic the user would write
  // manually when they pick a subject. The publish flow lets them
  // override; this is just the preview default.
  const subject = derivePreviewSubject(content);
  return (
    <div className="mx-auto max-w-[680px] space-y-3">
      <div className="rounded-md bg-ink-lightest/60 px-4 py-3 text-xs text-ink-dark">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            <span className="font-medium text-ink">From:</span> {fromName}
          </span>
          <span>
            <span className="font-medium text-ink">To:</span> you@example.com
          </span>
        </div>
        <div className="mt-1">
          <span className="font-medium text-ink">Subject:</span>{" "}
          <span className="text-ink">{subject}</span>
        </div>
      </div>

      <div
        style={{
          background: "#ffffff",
          color: "#1a1a1a",
          padding: "32px 40px",
          borderRadius: "8px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)",
          border: "1px solid #e5e7eb",
        }}
      >
        <article
          className="email-preview-body"
          style={{
            fontFamily:
              'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
            fontSize: "16px",
            lineHeight: "1.6",
          }}
        >
          <ReactMarkdown
            components={{
              h2: (props) => (
                <h2
                  {...props}
                  style={{
                    fontFamily:
                      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
                    fontSize: "22px",
                    fontWeight: 600,
                    marginTop: "32px",
                    marginBottom: "12px",
                    lineHeight: 1.3,
                  }}
                />
              ),
              p: (props) => (
                <p {...props} style={{ margin: "0 0 16px 0", color: "#1a1a1a" }} />
              ),
              a: (props) => (
                <a
                  {...props}
                  style={{ color: "#1d4ed8", textDecoration: "underline" }}
                />
              ),
              em: (props) => (
                <em {...props} style={{ color: "#4b5563", fontStyle: "italic" }} />
              ),
              strong: (props) => (
                <strong {...props} style={{ color: "#0f172a" }} />
              ),
              ul: (props) => (
                <ul
                  {...props}
                  style={{ paddingLeft: "24px", margin: "0 0 16px 0" }}
                />
              ),
              li: (props) => (
                <li {...props} style={{ margin: "0 0 4px 0" }} />
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </article>
      </div>

      <p className="text-center text-[11px] text-ink-dark">
        Preview only — real subject + footer are set when you publish.
      </p>
    </div>
  );
}

// derivePreviewSubject pulls a reasonable subject candidate from the
// draft for the email-preview header. Tries the first ## heading
// first ("Members debate Discord rate limits"), then the first
// sentence of the hook, then a fallback. This is preview-only — the
// publish flow has its own subject input.
function derivePreviewSubject(content: string): string {
  const heading = /^##\s+(.+?)\s*$/m.exec(content);
  if (heading) return heading[1].slice(0, 80);
  const firstLine = content
    .split(/\n+/)
    .map((s) => s.trim())
    .find((s) => s.length > 0);
  if (firstLine) {
    const sentence = /^(.{8,120}?[.!?])(?:\s|$)/.exec(firstLine);
    return (sentence ? sentence[1] : firstLine).slice(0, 80);
  }
  return "Your weekly newsletter";
}

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
  const [tab, setTab] = useState<"edit" | "preview" | "email">("edit");
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [sources, setSources] = useState<SourceSection[]>([]);
  const [guildId, setGuildId] = useState<string>("");
  const [serverName, setServerName] = useState<string>("");
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [subject, setSubject] = useState<string>("Weekly Newsletter");
  const [subjectOptions, setSubjectOptions] = useState<SubjectLineOption[]>([]);
  const [subjectLoading, setSubjectLoading] = useState(false);
  const [subjectError, setSubjectError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/proxy/newsletters/${newsletterId}`)
      .then((r) => r.json())
      .then((data) => {
        setContent(data.edited_markdown || data.draft_markdown || "");
        setGeneratedAt(data.created_at);
        if (Array.isArray(data.sources)) {
          setSources(data.sources as SourceSection[]);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch("/api/proxy/me")
      .then((r) => r.json())
      .then((u) => setIsSubscribed(u?.subscription_status === "active"))
      .catch(() => setIsSubscribed(false));

    // Need the guild ID for Discord permalinks in the source list,
    // and the server name for the email-preview "from" header.
    fetch(`/api/proxy/servers/${serverId}`)
      .then((r) => r.json())
      .then((s) => {
        setGuildId(s?.discord_guild_id || "");
        setServerName(s?.name || "");
      })
      .catch(() => {});
  }, [newsletterId, serverId]);

  const toggleSource = (id: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Pull the current text of one section out of `content` so the
  // backend rewrites what the operator actually sees, not what was
  // persisted at draft-load time. We slice using findSectionRange so
  // the markers and surrounding whitespace are normalized the same
  // way the replace path will reinsert them.
  const sliceSection = (storyId: string): string | null => {
    const range = findSectionRange(content, storyId);
    if (!range) return null;
    return content.slice(range.start, range.end).trim();
  };

  const handleRegenerate = async (
    storyId: string,
    directive: RegenerateDirective,
  ) => {
    const currentSection = sliceSection(storyId);
    if (!currentSection) {
      setRegenerateError(
        "Couldn't find that section in the draft anymore — did you edit the marker?",
      );
      return;
    }
    setRegeneratingId(storyId);
    setRegenerateError(null);
    try {
      const res = await fetch(
        `/api/proxy/newsletters/${newsletterId}/regenerate-section`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storyId, currentSection, directive }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.markdown !== "string") {
        setRegenerateError(data?.error || "Rewrite failed. Try again.");
        return;
      }
      setContent((prev) => replaceSection(prev, storyId, data.markdown));
    } catch {
      setRegenerateError("Couldn't reach the rewrite service. Try again.");
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleCutSection = (storyId: string) => {
    setContent((prev) => removeSection(prev, storyId));
    setSources((prev) => prev.filter((s) => s.storyId !== storyId));
  };

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

  const handleSuggestSubjects = async () => {
    setSubjectLoading(true);
    setSubjectError(null);
    try {
      const res = await fetch(
        `/api/proxy/newsletters/${newsletterId}/subject-lines`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentMarkdown: content }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data.options)) {
        setSubjectError(data?.error || "Couldn't generate subject lines.");
        return;
      }
      setSubjectOptions(data.options as SubjectLineOption[]);
    } catch {
      setSubjectError("Couldn't reach the subject-line service.");
    } finally {
      setSubjectLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedPlatform) return;
    setPublishing(true);
    setPublishError(null);
    const res = await fetch(`/api/proxy/newsletters/${newsletterId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: selectedPlatform,
        subject: subject.trim() || "Weekly Newsletter",
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
    <div className="-mx-4 -my-6 md:-my-8 flex flex-col min-h-[calc(100vh-3.5rem)] border-y border-ink-lighter">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-ink-lighter px-4 py-3 shrink-0">
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
          {/* Pane toggle. On desktop, "Edit" + "Preview" can run
              side-by-side so the toggle only flips the preview pane
              between markdown-render and email-render. On mobile,
              the toggle picks one of three exclusive panes. */}
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setTab("edit")}
              className={`flex md:hidden items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
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
              title="Markdown preview"
            >
              <Eye className="h-3 w-3" />
              Preview
            </button>
            <button
              onClick={() => setTab("email")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === "email"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="See this as an email"
            >
              <Mail className="h-3 w-3" />
              Email
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
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Publish newsletter</DialogTitle>
                  <DialogDescription>
                    Pick a subject line and a destination.
                  </DialogDescription>
                </DialogHeader>

                {/* Subject + AI suggestions. This is the friction
                    point that stalls Sunday-night publishing — the
                    user has to invent a subject in the moment, with
                    none of the context they had while drafting. The
                    AI suggester turns this into a 3-option pick. */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-ink">Subject</label>
                    <button
                      type="button"
                      onClick={handleSuggestSubjects}
                      disabled={subjectLoading || !content.trim()}
                      className="inline-flex items-center gap-1 text-xs text-link hover:underline disabled:opacity-50"
                    >
                      {subjectLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Wand2 className="h-3 w-3" />
                      )}
                      Suggest 3 options
                    </button>
                  </div>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    maxLength={100}
                    className="w-full rounded-md border border-ink-lighter bg-background px-3 py-2 text-sm focus:outline-none focus:border-ink-medium"
                    placeholder="Your inbox subject line"
                  />
                  {subjectError && (
                    <p className="text-xs text-negative">{subjectError}</p>
                  )}
                  {subjectOptions.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {subjectOptions.map((o) => (
                        <button
                          key={o.text}
                          type="button"
                          onClick={() => setSubject(o.text)}
                          className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                            subject === o.text
                              ? "border-foreground bg-muted"
                              : "border-ink-lighter hover:border-ink-medium"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium">{o.text}</span>
                            <span className="shrink-0 rounded-pill bg-ink-lighter px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-dark">
                              {SUBJECT_STYLE_LABELS[o.style]}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-ink-dark">
                            {o.rationale}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2 border-t border-ink-lighter pt-3">
                  <label className="text-xs font-medium text-ink">
                    Destination
                  </label>
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
                    disabled={!selectedPlatform || publishing || !subject.trim()}
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

      {/* Editor / Preview split. In email mode, the preview pane goes
          full-width so the 600px email frame has room to breathe; the
          markdown editor is one tab-flip away. */}
      <div
        className={`flex-1 grid grid-cols-1 min-h-0 ${
          tab === "email" ? "" : "md:grid-cols-2"
        }`}
      >
        {/* Editor pane — hidden in email mode entirely; hidden on
            mobile when the user is in preview mode. */}
        <div
          className={`flex flex-col border-r ${
            tab === "email" ? "hidden" : tab === "preview" ? "hidden md:flex" : ""
          }`}
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
            {tab === "email" ? "Email preview" : "Preview"}
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {tab === "email" ? (
              // Email-shape preview: 600px frame, white card, fake
              // From/Subject header. This is the "I can send this on
              // Sunday" moment — the same content as the markdown
              // preview, but rendered as it'll look in the inbox.
              <EmailFramePreview
                content={content.replace(/<!--\s*story:[^>]*-->\s*/g, "")}
                fromName={serverName || "Your community"}
              />
            ) : (
              <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-h2:text-lg prose-h2:mt-8 prose-h2:mb-3 prose-p:leading-relaxed prose-p:text-muted-foreground prose-a:text-foreground prose-strong:text-foreground">
                {/*
                  Strip the story-id markers before rendering.
                  React-markdown handles HTML comments natively
                  (they're parsed as raw blocks) but they'd render as
                  visible text, so easier to just strip.
                */}
                <ReactMarkdown>
                  {content.replace(/<!--\s*story:[^>]*-->\s*/g, "")}
                </ReactMarkdown>
              </article>
            )}

            {sources.length > 0 && tab !== "email" && (
              <section className="border-t pt-6">
                <header className="mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-ink-dark" />
                  <h3 className="text-sm font-semibold">Source messages</h3>
                  <span className="text-xs text-ink-dark">
                    — every section, traced back to the Discord threads it came from. Use Rewrite to nudge the AI on one section without losing the others.
                  </span>
                </header>
                {regenerateError && (
                  <div className="mb-3 rounded-md border border-negative/30 bg-negative/10 px-3 py-2 text-xs text-negative">
                    {regenerateError}
                  </div>
                )}
                <ul className="space-y-2">
                  {sources.map((s) => {
                    const open = expandedSources.has(s.storyId);
                    return (
                      <li
                        key={s.storyId}
                        className="rounded-md border border-ink-lighter bg-ink-lightest/40"
                      >
                        <div className="flex items-start gap-2 px-3 py-2">
                          <button
                            type="button"
                            onClick={() => toggleSource(s.storyId)}
                            className="flex min-w-0 flex-1 items-start gap-2 text-left hover:opacity-80"
                          >
                            {open ? (
                              <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-dark" />
                            ) : (
                              <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-dark" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium">
                                  {s.title}
                                </span>
                                <span className="shrink-0 rounded-pill bg-ink-lighter px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-dark">
                                  {s.type}
                                </span>
                              </div>
                              <p className="mt-0.5 text-xs text-ink-dark">
                                {s.whyItMatters}
                              </p>
                            </div>
                            <span className="shrink-0 text-xs text-ink-dark">
                              {s.messages.length}{" "}
                              {s.messages.length === 1 ? "message" : "messages"}
                            </span>
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                disabled={regeneratingId !== null}
                                className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-ink-lighter px-2 text-xs text-ink-dark hover:bg-background disabled:opacity-50"
                                title="Rewrite this section"
                              >
                                {regeneratingId === s.storyId ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Wand2 className="h-3 w-3" />
                                )}
                                Rewrite
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64">
                              <DropdownMenuLabel className="text-[11px] text-ink-dark">
                                AI rewrite
                              </DropdownMenuLabel>
                              {(Object.keys(DIRECTIVE_LABELS) as RegenerateDirective[]).map(
                                (d) => (
                                  <DropdownMenuItem
                                    key={d}
                                    onClick={() => handleRegenerate(s.storyId, d)}
                                    className="flex flex-col items-start gap-0.5"
                                  >
                                    <span className="text-sm">
                                      {DIRECTIVE_LABELS[d].label}
                                    </span>
                                    <span className="text-[11px] text-ink-dark">
                                      {DIRECTIVE_LABELS[d].hint}
                                    </span>
                                  </DropdownMenuItem>
                                ),
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleCutSection(s.storyId)}
                                className="flex items-center gap-2 text-negative"
                              >
                                <Scissors className="h-3 w-3" />
                                Cut this section
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {open && (
                          <ul className="space-y-1 border-t border-ink-lighter px-3 py-2">
                            {s.messages.map((m) => {
                              const url = discordPermalink(
                                guildId,
                                m.discordChannelId,
                                m.id,
                              );
                              return (
                                <li
                                  key={m.id}
                                  className="rounded bg-background/60 p-2 text-xs"
                                >
                                  <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-dark">
                                    <span className="font-medium text-ink">
                                      {m.authorName}
                                    </span>
                                    {m.channelName && (
                                      <span className="text-ink-dark">
                                        #{m.channelName}
                                      </span>
                                    )}
                                    <span className="text-ink-dark">
                                      {relTime(m.timestamp)}
                                    </span>
                                    {url && (
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-auto inline-flex items-center gap-1 text-ink-dark hover:text-link"
                                      >
                                        View in Discord
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    )}
                                  </div>
                                  <p className="whitespace-pre-wrap break-words text-ink-dark">
                                    {m.content}
                                  </p>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
