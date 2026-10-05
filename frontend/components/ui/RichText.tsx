"use client";

function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, index) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) {
      return (
        <strong key={index} className="font-medium">
          {bold[1]}
        </strong>
      );
    }
    const italic = part.match(/^\*([^*]+)\*$/);
    if (italic) {
      return (
        <em key={index} className="italic">
          {italic[1]}
        </em>
      );
    }
    const code = part.match(/^`([^`]+)`$/);
    if (code) {
      return (
        <code key={index} className="font-mono text-[0.92em]">
          {code[1]}
        </code>
      );
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      return (
        <a key={index} href={link[2]} className="text-steel underline-offset-2 hover:underline">
          {link[1]}
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

export function RichText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const content = text.trim();
  if (!content) return null;

  const looksStructured = /(?:^|\n)\s*(?:#{1,3}\s+|[-*]\s+|\d+\.\s+)/.test(content);
  if (!looksStructured && !content.includes("**")) {
    return <p className={className}>{content}</p>;
  }

  const blocks = content.split(/\n{2,}/);
  return (
    <div className={`space-y-3 ${className}`}>
      {blocks.map((block, index) => {
        const lines = block.split("\n");
        const heading = lines[0].match(/^(#{1,3})\s+(.*)$/);
        if (heading) {
          const Tag = heading[1].length === 1 ? "h3" : "h4";
          return (
            <div key={index}>
              <Tag className="font-display text-lg">{heading[2]}</Tag>
              {lines.slice(1).join("\n").trim() ? (
                <p className="mt-1 text-sm leading-6">{inline(lines.slice(1).join(" "))}</p>
              ) : null}
            </div>
          );
        }
        if (lines.every((line) => /^\s*[-*]\s+/.test(line) || !line.trim())) {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5 text-sm leading-6">
              {lines
                .filter(Boolean)
                .map((line, itemIndex) => (
                  <li key={itemIndex}>{inline(line.replace(/^\s*[-*]\s+/, ""))}</li>
                ))}
            </ul>
          );
        }
        return (
          <p key={index} className="text-sm leading-6">
            {inline(lines.join(" "))}
          </p>
        );
      })}
    </div>
  );
}
