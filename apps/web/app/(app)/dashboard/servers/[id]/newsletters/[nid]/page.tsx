"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const platforms = [
  { id: "beehiiv", name: "Beehiiv" },
  { id: "convertkit", name: "ConvertKit" },
  { id: "ghost", name: "Ghost" },
];

export default function NewsletterEditorPage() {
  const params = useParams();
  const serverId = params.id as string;
  const newsletterId = params.nid as string;

  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [cost, setCost] = useState("$0.0000");
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: fetch newsletter from Go API using serverId and newsletterId
    setContent(
      "# Weekly Newsletter\n\nYour newsletter content will appear here after generation.\n\n## Highlights\n\n- Discussion topic 1\n- Discussion topic 2\n- Discussion topic 3\n"
    );
    setCost("$0.0234");
    setGeneratedAt(new Date().toISOString());
    setLoading(false);
  }, [serverId, newsletterId]);

  const handleSave = async () => {
    setSaving(true);
    // TODO: save draft to Go API
    setTimeout(() => setSaving(false), 500);
  };

  const handlePublish = async () => {
    if (!selectedPlatform) return;
    setPublishing(true);
    // TODO: publish via Go API
    setTimeout(() => setPublishing(false), 1000);
  };

  if (loading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Newsletter Editor</h2>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            {generatedAt && (
              <span>
                Generated: {new Date(generatedAt).toLocaleDateString()}
              </span>
            )}
            <span>Cost: {cost}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Draft"}
          </Button>
          <Dialog>
            <DialogTrigger render={<Button>Publish</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Publish Newsletter</DialogTitle>
                <DialogDescription>
                  Select a platform to publish your newsletter to.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                {platforms.map((platform) => (
                  <button
                    key={platform.id}
                    onClick={() => setSelectedPlatform(platform.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                      selectedPlatform === platform.id
                        ? "border-gray-950 bg-gray-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className="font-medium">{platform.name}</span>
                  </button>
                ))}
              </div>
              <DialogFooter>
                <Button
                  onClick={handlePublish}
                  disabled={!selectedPlatform || publishing}
                >
                  {publishing ? "Publishing..." : "Publish"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Editor / Preview split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[600px]">
        {/* Editor */}
        <div className="flex flex-col">
          <div className="text-sm font-medium text-gray-500 mb-2">
            Markdown
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 min-h-[560px] font-mono text-sm resize-none"
            placeholder="Write your newsletter in markdown..."
          />
        </div>

        {/* Preview */}
        <div className="flex flex-col">
          <div className="text-sm font-medium text-gray-500 mb-2">
            Preview
          </div>
          <div className="flex-1 border rounded-lg p-6 bg-white overflow-y-auto prose prose-sm max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
