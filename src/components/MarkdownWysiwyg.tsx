import { useState } from "react";
import {
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  CreateLink,
  headingsPlugin,
  imagePlugin,
  InsertImage,
  linkDialogPlugin,
  listsPlugin,
  ListsToggle,
  MDXEditor,
  markdownShortcutPlugin,
  quotePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  UndoRedo,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";

type MarkdownWysiwygProps = {
  markdown: string;
  onChange: (markdown: string) => void;
};

export default function MarkdownWysiwyg({ markdown, onChange }: MarkdownWysiwygProps) {
  const [initialMarkdown] = useState(markdown);

  return (
    <div className="cms-wysiwyg">
      <MDXEditor
        markdown={initialMarkdown}
        onChange={onChange}
        aria-label="Article body"
        contentEditableClassName="cms-wysiwyg__content"
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          linkDialogPlugin(),
          imagePlugin(),
          markdownShortcutPlugin(),
          toolbarPlugin({
            toolbarContents: () => (
              <>
                <UndoRedo />
                <BlockTypeSelect />
                <BoldItalicUnderlineToggles />
                <ListsToggle />
                <CreateLink />
                <InsertImage />
              </>
            ),
          }),
        ]}
      />
    </div>
  );
}
