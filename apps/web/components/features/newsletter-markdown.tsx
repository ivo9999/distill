import ReactMarkdown from "react-markdown";

// NewsletterMarkdown renders newsletter draft markdown with the
// newsletter's typography — sans-serif headings, serif-friendly body
// spacing, styled links/lists/quotes. Shared by the editor's Preview
// tab and the Email-frame preview so both views render identically.
//
// The host element supplies the font-family / size / line-height
// context (the Email frame uses a serif body; the Preview tab inherits
// the app font) — this component only styles the block elements.
export function NewsletterMarkdown({ content }: { content: string }) {
  return (
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
        h3: (props) => (
          <h3
            {...props}
            style={{
              fontFamily:
                'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
              fontSize: "18px",
              fontWeight: 600,
              marginTop: "24px",
              marginBottom: "8px",
              lineHeight: 1.35,
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
        strong: (props) => <strong {...props} style={{ color: "#0f172a" }} />,
        ul: (props) => (
          <ul {...props} style={{ paddingLeft: "24px", margin: "0 0 16px 0" }} />
        ),
        li: (props) => <li {...props} style={{ margin: "0 0 4px 0" }} />,
        blockquote: (props) => (
          <blockquote
            {...props}
            style={{
              borderLeft: "3px solid #d1d5db",
              paddingLeft: "16px",
              margin: "0 0 16px 0",
              color: "#4b5563",
              fontStyle: "italic",
            }}
          />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
