import { Fragment } from "react";

const INLINE_PATTERN = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/;

function renderInline(text, keyBase) {
  const parts = String(text)
    .split(INLINE_PATTERN)
    .filter((part) => part !== "" && part !== undefined);

  return parts.map((part, index) => {
    const key = `${keyBase}-${index}`;

    if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={key} className="font-semibold text-gray-900">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={key}
          className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[12px] text-gray-800"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }

    return <Fragment key={key}>{part}</Fragment>;
  });
}

function parseBlocks(text) {
  const lines = String(text ?? "").replace(/\r\n/g, "\n").split("\n");

  const blocks = [];
  let paragraph = [];
  let list = null;
  let code = null;

  const closeParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ type: "p", lines: paragraph });
    paragraph = [];
  };

  const closeList = () => {
    if (!list) return;
    blocks.push(list);
    list = null;
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (code) {
        blocks.push({ type: "code", text: code.join("\n") });
        code = null;
      } else {
        closeParagraph();
        closeList();
        code = [];
      }
      return;
    }

    if (code) {
      code.push(line);
      return;
    }

    if (trimmed === "" || /^[-*_]{3,}$/.test(trimmed)) {
      closeParagraph();
      closeList();
      return;
    }

    const bullet = trimmed.match(/^[-*•]\s+(.*)$/);
    const numbered = trimmed.match(/^(\d+)[.)]\s+(.*)$/);
    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);

    if (heading) {
      closeParagraph();
      closeList();

      blocks.push({
        type: heading[1].length === 1 ? "h1" : "h2",
        text: heading[2],
      });

      return;
    }

    if (bullet || numbered) {
      closeParagraph();

      const type = numbered ? "ol" : "ul";
      const content = numbered ? numbered[2] : bullet[1];

      if (!list || list.type !== type) {
        closeList();
        list = { type, items: [] };
      }

      list.items.push(content);
      return;
    }

    paragraph.push(trimmed.replace(/^#{1,6}\s*/, ""));
  });

  if (code) {
    blocks.push({ type: "code", text: code.join("\n") });
  }

  closeParagraph();
  closeList();

  return blocks;
}

export default function MarkdownLite({ text }) {
  const blocks = parseBlocks(text);

  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        if (block.type === "ul" || block.type === "ol") {
          const List = block.type === "ol" ? "ol" : "ul";

          return (
            <List
              key={index}
              className={
                block.type === "ol"
                  ? "list-decimal space-y-1 pl-5"
                  : "list-disc space-y-1 pl-5"
              }
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  {renderInline(item, `${index}-${itemIndex}`)}
                </li>
              ))}
            </List>
          );
        }

        if (block.type === "h1" || block.type === "h2") {
          const Heading = block.type === "h1" ? "h3" : "h4";

          return (
            <Heading
              key={index}
              className={
                block.type === "h1"
                  ? "text-[15px] font-bold text-gray-900"
                  : "text-sm font-bold text-gray-900"
              }
            >
              {renderInline(block.text, `${index}-h`)}
            </Heading>
          );
        }

        if (block.type === "code") {
          return (
            <pre
              key={index}
              className="overflow-x-auto rounded-xl bg-gray-100 px-3 py-2 font-mono text-[12px] leading-5 text-gray-800"
            >
              {block.text}
            </pre>
          );
        }

        return (
          <p key={index} className="leading-6">
            {block.lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 && <br />}
                {renderInline(line, `${index}-${lineIndex}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
