"use client";

import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function CodeBlock({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const getText = (node: React.ReactNode): string =>
    typeof node === "string" ? node
      : Array.isArray(node) ? node.map(getText).join("")
      : node && typeof node === "object" && "props" in node ? getText((node as { props: { children?: React.ReactNode } }).props.children)
      : "";
  return (
    <div className="relative group">
      <button
        onClick={() => { navigator.clipboard.writeText(getText(children)); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="absolute right-2 top-2 rounded-md bg-white/10 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 focus:opacity-100">
        {copied ? "Copied" : "Copy"}
      </button>
      <pre>{children}</pre>
    </div>
  );
}

export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="prose-chat break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>,
        }}>
        {text}
      </ReactMarkdown>
    </div>
  );
});
