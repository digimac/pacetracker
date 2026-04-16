import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Bold, Italic, List, ListOrdered, Link as LinkIcon,
  Image as ImageIcon, AlignLeft, AlignCenter, AlignRight,
  Minus, Undo, Redo, Upload, Loader2,
} from "lucide-react";

const CLOUD_NAME    = "dlqmcinfq";
const UPLOAD_PRESET = "sweetmomentum";

interface RichBodyEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export function RichBodyEditor({
  value,
  onChange,
  placeholder = "Write your page content here...",
  minHeight = 200,
}: RichBodyEditorProps) {
  const { toast } = useToast();
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMounted = useRef(true);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Image.configure({
        inline: true,
        allowBase64: false,
        HTMLAttributes: {
          class: "inline-image",
          style: "max-width:100%;height:auto;border-radius:8px;margin:4px 0;",
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-primary underline" },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      if (isMounted.current) onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm prose-invert max-w-none focus:outline-none px-3 py-2",
        style: `min-height:${minHeight}px`,
      },
    },
  });

  // Sync external value changes (e.g. loading saved data)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current && value !== undefined) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // ── Upload image to Cloudinary ─────────────────────────────────────────────
  async function handleImageUpload(file: File) {
    if (!editor) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please choose an image under 10 MB.", variant: "destructive" });
      return;
    }
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", UPLOAD_PRESET);
      formData.append("folder", "sweet-momentum");
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: "POST", body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      editor.chain().focus().setImage({ src: data.secure_url, alt: file.name.replace(/\.[^.]+$/, "") }).run();
      toast({ title: "Image inserted" });
    } catch {
      toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ── Insert image from URL ──────────────────────────────────────────────────
  function insertImageUrl() {
    if (!editor || !linkUrl.trim()) return;
    if (editor.isActive("link")) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: linkUrl.trim() }).run();
    } else {
      editor.chain().focus().setImage({ src: linkUrl.trim() }).run();
    }
    setLinkUrl("");
    setShowLinkInput(false);
  }

  function applyLink() {
    if (!editor || !linkUrl.trim()) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: linkUrl.trim() }).run();
    setLinkUrl("");
    setShowLinkInput(false);
  }

  if (!editor) return null;

  // Toolbar button helper
  const ToolBtn = ({
    onClick, active, disabled, title, children,
  }: { onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode }) => (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`p-1.5 rounded transition-colors ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"} disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-background focus-within:ring-1 focus-within:ring-ring">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/30">

        {/* History */}
        <ToolBtn title="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
          <Undo className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn title="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
          <Redo className="w-3.5 h-3.5" />
        </ToolBtn>

        <span className="w-px h-4 bg-border mx-1" />

        {/* Format */}
        <ToolBtn title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="w-3.5 h-3.5" />
        </ToolBtn>

        <span className="w-px h-4 bg-border mx-1" />

        {/* Headings */}
        <button
          type="button"
          title="Heading 2"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-1.5 py-1 text-xs font-bold rounded transition-colors ${editor.isActive("heading", { level: 2 }) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
        >H2</button>
        <button
          type="button"
          title="Heading 3"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`px-1.5 py-1 text-xs font-bold rounded transition-colors ${editor.isActive("heading", { level: 3 }) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
        >H3</button>

        <span className="w-px h-4 bg-border mx-1" />

        {/* Lists */}
        <ToolBtn title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolBtn>

        <span className="w-px h-4 bg-border mx-1" />

        {/* Alignment */}
        <ToolBtn title="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
          <AlignLeft className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn title="Align center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
          <AlignCenter className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn title="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
          <AlignRight className="w-3.5 h-3.5" />
        </ToolBtn>

        <span className="w-px h-4 bg-border mx-1" />

        {/* Divider */}
        <ToolBtn title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus className="w-3.5 h-3.5" />
        </ToolBtn>

        {/* Link */}
        <ToolBtn
          title="Insert link"
          active={editor.isActive("link")}
          onClick={() => {
            if (editor.isActive("link")) {
              editor.chain().focus().unsetLink().run();
            } else {
              setShowLinkInput(true);
            }
          }}
        >
          <LinkIcon className="w-3.5 h-3.5" />
        </ToolBtn>

        <span className="w-px h-4 bg-border mx-1" />

        {/* Image — upload */}
        <ToolBtn
          title="Upload image"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingImage}
        >
          {uploadingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
        </ToolBtn>

        {/* Image — from URL */}
        <ToolBtn
          title="Insert image from URL"
          onClick={() => { setShowLinkInput(true); setLinkUrl(""); }}
        >
          <ImageIcon className="w-3.5 h-3.5" />
        </ToolBtn>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }}
        />
      </div>

      {/* URL / Link input bar */}
      {showLinkInput && (
        <div className="flex gap-2 items-center px-3 py-2 border-b border-border bg-muted/20">
          <Input
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { editor.isActive("link") ? applyLink() : insertImageUrl(); } if (e.key === "Escape") { setShowLinkInput(false); setLinkUrl(""); } }}
            placeholder={editor.isActive("link") ? "https://example.com" : "https://image-url.com or Cloudinary URL"}
            className="text-sm h-7 flex-1"
            autoFocus
          />
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => { editor.isActive("link") ? applyLink() : insertImageUrl(); }}
          >
            {editor.isActive("link") ? "Apply Link" : "Insert Image"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs px-2"
            onClick={() => { setShowLinkInput(false); setLinkUrl(""); }}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Editor area */}
      <EditorContent editor={editor} />

      {/* Char count hint */}
      <div className="px-3 py-1 border-t border-border bg-muted/10 text-right">
        <span className="text-[10px] text-muted-foreground/50">
          Rich text · images upload to Cloudinary
        </span>
      </div>
    </div>
  );
}
