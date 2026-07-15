import ParagraphBlock from "../blocks/Paragraph";
import HeadingBlock from "../blocks/Heading";
import QuoteBlock from "../blocks/Quote";
import DividerBlock from "../blocks/Divider";
import CodeBlock from "../blocks/Code";

import { BLOCK_TYPES } from "../engine/BlockTypes";

function BlockRenderer({ block }) {
  switch (block.type) {
    case BLOCK_TYPES.HEADING1:
      return (
        <HeadingBlock level={1}>
          {block.content}
        </HeadingBlock>
      );

    case BLOCK_TYPES.HEADING2:
      return (
        <HeadingBlock level={2}>
          {block.content}
        </HeadingBlock>
      );

    case BLOCK_TYPES.HEADING3:
      return (
        <HeadingBlock level={3}>
          {block.content}
        </HeadingBlock>
      );

    case BLOCK_TYPES.QUOTE:
      return (
        <QuoteBlock>
          {block.content}
        </QuoteBlock>
      );

    case BLOCK_TYPES.DIVIDER:
      return <DividerBlock />;

    case BLOCK_TYPES.CODE:
      return (
        <CodeBlock>
          {block.content}
        </CodeBlock>
      );

    default:
      return (
        <ParagraphBlock>
          {block.content}
        </ParagraphBlock>
      );
  }
}

export default BlockRenderer;