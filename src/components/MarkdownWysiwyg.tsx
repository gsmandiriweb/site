import { useCallback, useRef, useState } from "react";
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
  // MDXEditor re-serializes its input once on mount (`- item` → `* item`,
  // leading blank lines dropped) and publishes that as a change. It is the
  // editor's normalization, not an edit: forwarding it marked every article as
  // having unsaved changes the moment it was opened, made the deprecation guard
  // and `beforeunload` fire on untouched posts, and made the publication panel
  // offer "Kirim revisi baru" instead of "Setujui & terbitkan".
  const settled = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const handleChange = useCallback((next: string) => {
    if (!settled.current) {
      settled.current = true;
      return;
    }
    onChangeRef.current(next);
  }, []);

  return (
    <div className="cms-wysiwyg">
      <MDXEditor
        markdown={initialMarkdown}
        onChange={handleChange}
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
