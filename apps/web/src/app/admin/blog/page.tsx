"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  BookOpen,
  Plus,
  Save,
  Check,
  Trash2,
  Eye,
  RefreshCw,
  X,
  FileText,
  Edit,
  Tag,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Bold,
  Italic,
  Strikethrough,
  Heading,
  List,
  ListOrdered,
  Quote,
  Code,
  Terminal,
  Link2,
  Table,
  Minus,
  Image as ImageIcon,
  Search,
  Copy,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  HelpCircle,
  ArrowUp,
  ArrowDown,
  Globe,
  Share2,
  CornerDownRight,
  Star,
  User,
} from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { MediaPickerModal } from "@/components/MediaPickerModal";
import { api } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/utils";
import { MediaAsset, BlogRedirect, BlogAuthor, BlogTag } from "@/types";
import { getSiteUrl } from "@/lib/seo";

/**
 * Reusable Admin Markdown Editor with Formatting Toolbar and Responsive Live Preview.
 */
interface MarkdownEditorFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  onOpenMediaPicker?: (insertCallback: (snippet: string) => void) => void;
}

function MarkdownEditorField({
  value,
  onChange,
  placeholder = "Write your article using Markdown...",
  minHeight = "min-h-[360px]",
  onOpenMediaPicker,
}: MarkdownEditorFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [mobileTab, setMobileTab] = useState<"write" | "preview">("write");

  const insertTextAtCursor = (textToInsert: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      onChange(value + "\n" + textToInsert);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const updated = value.substring(0, start) + textToInsert + value.substring(end);
    onChange(updated);
    setTimeout(() => {
      textarea.focus();
      const newPos = start + textToInsert.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const applyAction = (action: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.substring(start, end);

    let replacement = "";
    let newCursorPos = start;

    switch (action) {
      case "bold":
        replacement = `**${selected || "bold text"}**`;
        newCursorPos = start + (selected ? replacement.length : 2);
        break;
      case "italic":
        replacement = `*${selected || "italic text"}*`;
        newCursorPos = start + (selected ? replacement.length : 1);
        break;
      case "strikethrough":
        replacement = `~~${selected || "strikethrough text"}~~`;
        newCursorPos = start + (selected ? replacement.length : 2);
        break;
      case "h2":
        replacement = `\n## ${selected || "Heading"}\n`;
        newCursorPos = start + replacement.length;
        break;
      case "h3":
        replacement = `\n### ${selected || "Subheading"}\n`;
        newCursorPos = start + replacement.length;
        break;
      case "ul":
        if (selected.includes("\n")) {
          replacement = selected
            .split("\n")
            .map((line) => (line.startsWith("- ") ? line : `- ${line}`))
            .join("\n");
        } else {
          replacement = `- ${selected || "List item"}`;
        }
        newCursorPos = start + replacement.length;
        break;
      case "ol":
        if (selected.includes("\n")) {
          replacement = selected
            .split("\n")
            .map((line, i) => `${i + 1}. ${line.replace(/^\d+\.\s*/, "")}`)
            .join("\n");
        } else {
          replacement = `1. ${selected || "Numbered item"}`;
        }
        newCursorPos = start + replacement.length;
        break;
      case "quote":
        if (selected.includes("\n")) {
          replacement = selected
            .split("\n")
            .map((line) => (line.startsWith("> ") ? line : `> ${line}`))
            .join("\n");
        } else {
          replacement = `> ${selected || "Security blockquote note"}`;
        }
        newCursorPos = start + replacement.length;
        break;
      case "inline-code":
        replacement = `\`${selected || "inline code"}\``;
        newCursorPos = start + (selected ? replacement.length : 1);
        break;
      case "code-block":
        replacement = `\n\`\`\`bash\n${selected || "curl -I https://example.com"}\n\`\`\`\n`;
        newCursorPos = start + replacement.length;
        break;
      case "link":
        replacement = `[${selected || "link description"}](https://example.com)`;
        newCursorPos = start + (selected ? replacement.length - 1 : 1);
        break;
      case "table":
        replacement = `\n| Security Check | Recommended Status |\n| --- | --- |\n| HTTPS Redirect | Enabled |\n| HSTS Preload | Configured |\n`;
        newCursorPos = start + replacement.length;
        break;
      case "hr":
        replacement = `\n---\n`;
        newCursorPos = start + replacement.length;
        break;
      default:
        return;
    }

    const updated = value.substring(0, start) + replacement + value.substring(end);
    onChange(updated);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  return (
    <div className="space-y-2">
      {/* Formatting Toolbar & Mobile Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-900 border border-slate-800 rounded-xl">
        {/* Toolbar Buttons */}
        <div className="flex flex-wrap items-center gap-1 text-slate-300">
          <button
            type="button"
            onClick={() => applyAction("h2")}
            title="Heading 2 (##)"
            aria-label="Add heading 2"
            className="p-1.5 hover:bg-slate-800 rounded-lg hover:text-white transition-colors"
          >
            <Heading className="w-3.5 h-3.5" />
          </button>
          <div className="h-4 w-px bg-slate-800 mx-0.5" />
          <button
            type="button"
            onClick={() => applyAction("bold")}
            title="Bold (**text**)"
            aria-label="Bold text"
            className="p-1.5 hover:bg-slate-800 rounded-lg hover:text-white transition-colors"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyAction("italic")}
            title="Italic (*text*)"
            aria-label="Italic text"
            className="p-1.5 hover:bg-slate-800 rounded-lg hover:text-white transition-colors"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyAction("strikethrough")}
            title="Strikethrough (~~text~~)"
            aria-label="Strikethrough text"
            className="p-1.5 hover:bg-slate-800 rounded-lg hover:text-white transition-colors"
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </button>
          <div className="h-4 w-px bg-slate-800 mx-0.5" />
          <button
            type="button"
            onClick={() => applyAction("ul")}
            title="Bullet List (- item)"
            aria-label="Add bullet list"
            className="p-1.5 hover:bg-slate-800 rounded-lg hover:text-white transition-colors"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyAction("ol")}
            title="Numbered List (1. item)"
            aria-label="Add numbered list"
            className="p-1.5 hover:bg-slate-800 rounded-lg hover:text-white transition-colors"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyAction("quote")}
            title="Blockquote (> quote)"
            aria-label="Add blockquote"
            className="p-1.5 hover:bg-slate-800 rounded-lg hover:text-white transition-colors"
          >
            <Quote className="w-3.5 h-3.5" />
          </button>
          <div className="h-4 w-px bg-slate-800 mx-0.5" />
          <button
            type="button"
            onClick={() => applyAction("inline-code")}
            title="Inline Code (`code`)"
            aria-label="Add inline code"
            className="p-1.5 hover:bg-slate-800 rounded-lg hover:text-white transition-colors"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyAction("code-block")}
            title="Fenced Code Block (```lang)"
            aria-label="Add code block"
            className="p-1.5 hover:bg-slate-800 rounded-lg hover:text-white transition-colors"
          >
            <Terminal className="w-3.5 h-3.5 text-sky-400" />
          </button>
          <button
            type="button"
            onClick={() => applyAction("link")}
            title="Hyperlink ([text](url))"
            aria-label="Add link"
            className="p-1.5 hover:bg-slate-800 rounded-lg hover:text-white transition-colors"
          >
            <Link2 className="w-3.5 h-3.5" />
          </button>
          {onOpenMediaPicker && (
            <button
              type="button"
              onClick={() => onOpenMediaPicker(insertTextAtCursor)}
              title="Insert Image from Media Library"
              aria-label="Insert image"
              className="p-1.5 hover:bg-slate-800 rounded-lg hover:text-white transition-colors text-sky-400"
            >
              <ImageIcon className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => applyAction("table")}
            title="GFM Table (| Column |)"
            aria-label="Add table"
            className="p-1.5 hover:bg-slate-800 rounded-lg hover:text-white transition-colors"
          >
            <Table className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyAction("hr")}
            title="Horizontal Rule (---)"
            aria-label="Add horizontal rule"
            className="p-1.5 hover:bg-slate-800 rounded-lg hover:text-white transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mobile View Toggle (Hidden on lg+ screens where split view is active) */}
        <div className="flex lg:hidden items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setMobileTab("write")}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              mobileTab === "write"
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Write
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("preview")}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              mobileTab === "preview"
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Preview
          </button>
        </div>
      </div>

      {/* Split Layout Container */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Editor Pane (Always visible on desktop, tab-gated on mobile) */}
        <div className={`space-y-1 ${mobileTab === "write" ? "block" : "hidden lg:block"}`}>
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 px-1">
            <span>Markdown Source</span>
            <span className="text-slate-500 font-mono">{value.length} characters</span>
          </div>
          <textarea
            ref={textareaRef}
            rows={14}
            required
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full p-4 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-xs leading-relaxed focus:outline-none focus:border-sky-500 transition-colors resize-y ${minHeight}`}
          />
        </div>

        {/* Live Preview Pane (Always visible on desktop, tab-gated on mobile) */}
        <div className={`space-y-1 ${mobileTab === "preview" ? "block" : "hidden lg:block"}`}>
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 px-1">
            <span className="flex items-center gap-1.5 text-sky-400">
              <Eye className="w-3.5 h-3.5" /> Live Preview
            </span>
            <span className="text-slate-500 text-[10px]">Real-time rendering</span>
          </div>
          <div
            className={`w-full p-4 bg-slate-900/60 border border-slate-800 rounded-xl overflow-y-auto ${minHeight} max-h-[550px]`}
          >
            {value.trim() ? (
              <MarkdownRenderer content={value} theme="dark" />
            ) : (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-slate-500 text-xs italic text-center p-6 space-y-2">
                <BookOpen className="w-8 h-8 text-slate-700 stroke-[1.5]" />
                <p>Start writing Markdown on the left to see live rendered preview here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminBlogCMSPage() {
  const [activeTab, setActiveTab] = useState<"posts" | "categories" | "tags" | "media" | "redirects">("posts");
  const [posts, setPosts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Authors State (Phase E5)
  const [authors, setAuthors] = useState<BlogAuthor[]>([]);

  // Tags State (Phase E5)
  const [allTags, setAllTags] = useState<BlogTag[]>([]);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [tagName, setTagName] = useState("");
  const [tagSlug, setTagSlug] = useState("");
  const [tagDescription, setTagDescription] = useState("");
  const [submittingTag, setSubmittingTag] = useState(false);
  const [editingTag, setEditingTag] = useState<BlogTag | null>(null);
  const [editTagName, setEditTagName] = useState("");
  const [editTagSlug, setEditTagSlug] = useState("");
  const [editTagDescription, setEditTagDescription] = useState("");
  const [submittingEditTag, setSubmittingEditTag] = useState(false);

  // Redirects State (Phase E4)
  const [redirects, setRedirects] = useState<BlogRedirect[]>([]);
  const [redirectsLoading, setRedirectsLoading] = useState(false);

  // Media State (Phase E3)
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [mediaTotal, setMediaTotal] = useState(0);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaSearch, setMediaSearch] = useState("");
  const [mediaOffset, setMediaOffset] = useState(0);
  const [mediaLimit] = useState(16);
  const [selectedAssetDetail, setSelectedAssetDetail] = useState<MediaAsset | null>(null);
  const [detailAlt, setDetailAlt] = useState("");
  const [detailCaption, setDetailCaption] = useState("");
  const [savingDetail, setSavingDetail] = useState(false);
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Media Picker Modal State
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<
    "markdown_create" | "markdown_edit" | "featured_create" | "featured_edit" | "og_create" | "og_edit"
  >("markdown_create");
  const [pickerTitle, setPickerTitle] = useState("Select Image");
  const [pickerActionLabel, setPickerActionLabel] = useState("Insert Image");
  const insertSnippetCallbackRef = useRef<((snippet: string) => void) | null>(null);

  // Status notifications
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // New Post State
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postSlug, setPostSlug] = useState("");
  const [postExcerpt, setPostExcerpt] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postCategoryId, setPostCategoryId] = useState<string>("");
  const [postAuthorId, setPostAuthorId] = useState<string>("");
  const [postTagIds, setPostTagIds] = useState<string[]>([]);
  const [postIsFeatured, setPostIsFeatured] = useState<boolean>(false);
  const [postNewTagInput, setPostNewTagInput] = useState("");
  const [postStatus, setPostStatus] = useState<string>("draft");
  const [postFeaturedImage, setPostFeaturedImage] = useState("");
  const [postFeaturedMediaId, setPostFeaturedMediaId] = useState<string>("");
  const [postFeaturedMedia, setPostFeaturedMedia] = useState<MediaAsset | null>(null);
  const [postSeoTitle, setPostSeoTitle] = useState("");
  const [postMetaDescription, setPostMetaDescription] = useState("");
  const [postCanonicalUrl, setPostCanonicalUrl] = useState("");
  const [postOgImage, setPostOgImage] = useState("");
  const [postFaqs, setPostFaqs] = useState<{ question: string; answer: string }[]>([]);
  const [postSeoPreviewTab, setPostSeoPreviewTab] = useState<"search" | "social">("search");
  const [submittingPost, setSubmittingPost] = useState(false);

  // Edit Post State
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editExcerpt, setEditExcerpt] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategoryId, setEditCategoryId] = useState<string>("");
  const [editAuthorId, setEditAuthorId] = useState<string>("");
  const [editTagIds, setEditTagIds] = useState<string[]>([]);
  const [editIsFeatured, setEditIsFeatured] = useState<boolean>(false);
  const [editNewTagInput, setEditNewTagInput] = useState("");
  const [editStatus, setEditStatus] = useState<string>("draft");
  const [editFeaturedImage, setEditFeaturedImage] = useState("");
  const [editFeaturedMediaId, setEditFeaturedMediaId] = useState<string>("");
  const [editFeaturedMedia, setEditFeaturedMedia] = useState<MediaAsset | null>(null);
  const [editSeoTitle, setEditSeoTitle] = useState("");
  const [editMetaDescription, setEditMetaDescription] = useState("");
  const [editCanonicalUrl, setEditCanonicalUrl] = useState("");
  const [editOgImage, setEditOgImage] = useState("");
  const [editFaqs, setEditFaqs] = useState<{ question: string; answer: string }[]>([]);
  const [editSeoPreviewTab, setEditSeoPreviewTab] = useState<"search" | "social">("search");
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Category State
  const [isCreatingCat, setIsCreatingCat] = useState(false);
  const [catName, setCatName] = useState("");
  const [catSlug, setCatSlug] = useState("");
  const [catDescription, setCatDescription] = useState("");
  const [submittingCat, setSubmittingCat] = useState(false);

  const [editingCat, setEditingCat] = useState<any | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatSlug, setEditCatSlug] = useState("");
  const [editCatDescription, setEditCatDescription] = useState("");
  const [submittingEditCat, setSubmittingEditCat] = useState(false);

  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const loadMedia = async (offset = mediaOffset, query = mediaSearch) => {
    try {
      setMediaLoading(true);
      const res = await api.getAdminBlogMedia({
        search: query.trim() || undefined,
        limit: mediaLimit,
        offset,
      });
      setMediaAssets(res.items || []);
      setMediaTotal(res.total || 0);
      setMediaOffset(offset);
    } catch (err: any) {
      console.error("Failed to load media assets:", err);
    } finally {
      setMediaLoading(false);
    }
  };

  const loadRedirects = async () => {
    try {
      setRedirectsLoading(true);
      const data = await api.getAdminBlogRedirects();
      setRedirects(data || []);
    } catch (err: any) {
      console.error("Failed to load redirects:", err);
    } finally {
      setRedirectsLoading(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const [postsData, catsData, mediaData, redirectsData, authorsData, tagsData] = await Promise.all([
        api.getAdminBlogPosts(),
        api.getAdminBlogCategories(),
        api.getAdminBlogMedia({ limit: mediaLimit, offset: 0 }).catch(() => ({ items: [], total: 0 })),
        api.getAdminBlogRedirects().catch(() => []),
        api.getAdminBlogAuthors().catch(() => []),
        api.getAdminBlogTags().catch(() => []),
      ]);
      setPosts(postsData || []);
      setCategories(catsData || []);
      setMediaAssets(mediaData.items || []);
      setMediaTotal(mediaData.total || 0);
      setRedirects(redirectsData || []);
      setAuthors(authorsData || []);
      setAllTags(tagsData || []);
    } catch (err: any) {
      console.error("Failed to load CMS data:", err);
      setErrorMessage(err.message || "Failed to load blog CMS data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  // Media Picker handlers
  const handleOpenPickerForMarkdown = (
    mode: "create" | "edit",
    insertCallback: (snippet: string) => void
  ) => {
    insertSnippetCallbackRef.current = insertCallback;
    setPickerMode(mode === "create" ? "markdown_create" : "markdown_edit");
    setPickerTitle("Insert Article Image");
    setPickerActionLabel("Insert into Markdown");
    setPickerOpen(true);
  };

  const handleOpenPickerForFeatured = (mode: "create" | "edit") => {
    setPickerMode(mode === "create" ? "featured_create" : "featured_edit");
    setPickerTitle("Select Featured Image");
    setPickerActionLabel("Set as Featured Image");
    setPickerOpen(true);
  };

  const handleOpenPickerForOg = (mode: "create" | "edit") => {
    setPickerMode(mode === "create" ? "og_create" : "og_edit");
    setPickerTitle("Select OpenGraph / Social Share Image");
    setPickerActionLabel("Set as Social Share Image");
    setPickerOpen(true);
  };

  const handleMediaPickerSelect = (
    asset: MediaAsset,
    customAlt?: string,
    customCaption?: string
  ) => {
    if (pickerMode === "markdown_create" || pickerMode === "markdown_edit") {
      const alt = customAlt || asset.alt_text || asset.original_filename;
      const snippet = customCaption
        ? `\n![${alt}](${asset.public_url} "${customCaption}")\n`
        : `\n![${alt}](${asset.public_url})\n`;
      insertSnippetCallbackRef.current?.(snippet);
    } else if (pickerMode === "featured_create") {
      setPostFeaturedMediaId(asset.id);
      setPostFeaturedMedia(asset);
      setPostFeaturedImage(asset.public_url);
    } else if (pickerMode === "featured_edit") {
      setEditFeaturedMediaId(asset.id);
      setEditFeaturedMedia(asset);
      setEditFeaturedImage(asset.public_url);
    } else if (pickerMode === "og_create") {
      setPostOgImage(asset.public_url);
    } else if (pickerMode === "og_edit") {
      setEditOgImage(asset.public_url);
    }
  };

  // FAQ Handlers (Phase E4)
  const handleAddFaq = (mode: "create" | "edit") => {
    if (mode === "create") {
      setPostFaqs((prev) => [...prev, { question: "", answer: "" }]);
    } else {
      setEditFaqs((prev) => [...prev, { question: "", answer: "" }]);
    }
  };

  const handleRemoveFaq = (mode: "create" | "edit", index: number) => {
    if (mode === "create") {
      setPostFaqs((prev) => prev.filter((_, i) => i !== index));
    } else {
      setEditFaqs((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleFaqChange = (
    mode: "create" | "edit",
    index: number,
    field: "question" | "answer",
    value: string
  ) => {
    if (mode === "create") {
      setPostFaqs((prev) =>
        prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
      );
    } else {
      setEditFaqs((prev) =>
        prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
      );
    }
  };

  const handleMoveFaq = (mode: "create" | "edit", index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const setter = mode === "create" ? setPostFaqs : setEditFaqs;
    setter((prev) => {
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      return updated;
    });
  };

  // Media Asset Management Handlers
  const handleDeleteMediaAsset = async (asset: MediaAsset) => {
    if (
      !window.confirm(
        `Permanently delete media asset "${asset.original_filename}"? This action cannot be undone.`
      )
    ) {
      return;
    }
    setDeletingMediaId(asset.id);
    setErrorMessage(null);
    try {
      await api.deleteAdminBlogMedia(asset.id);
      showSuccess(`Media asset "${asset.original_filename}" deleted successfully.`);
      if (selectedAssetDetail?.id === asset.id) {
        setSelectedAssetDetail(null);
      }
      loadMedia(mediaOffset, mediaSearch);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to delete media asset.");
    } finally {
      setDeletingMediaId(null);
    }
  };

  const handleOpenMediaDetail = (asset: MediaAsset) => {
    setSelectedAssetDetail(asset);
    setDetailAlt(asset.alt_text || "");
    setDetailCaption(asset.caption || "");
  };

  const handleSaveMediaDetail = async () => {
    if (!selectedAssetDetail) return;
    setSavingDetail(true);
    setErrorMessage(null);
    try {
      const updated = await api.updateAdminBlogMedia(selectedAssetDetail.id, {
        alt_text: detailAlt.trim() || undefined,
        caption: detailCaption.trim() || undefined,
      });
      setSelectedAssetDetail(updated);
      setMediaAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      showSuccess("Media asset metadata saved.");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update media asset metadata.");
    } finally {
      setSavingDetail(false);
    }
  };

  const handleCopyMarkdown = (asset: MediaAsset) => {
    const md = `![${asset.alt_text || asset.original_filename}](${asset.public_url})`;
    navigator.clipboard.writeText(md);
    setCopiedId(asset.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyUrl = (asset: MediaAsset) => {
    const fullUrl = resolveMediaUrl(asset.public_url);
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(`url-${asset.id}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Create Post
  const handleCreatePost = async (e: React.FormEvent, overrideStatus?: string) => {
    e.preventDefault();
    if (!postTitle.trim() || !postSlug.trim()) {
      setErrorMessage("Title and URL Slug are required.");
      return;
    }
    setSubmittingPost(true);
    setErrorMessage(null);
    try {
      const finalStatus = overrideStatus || postStatus;
      await api.createAdminBlogPost({
        title: postTitle.trim(),
        slug: slugify(postSlug),
        excerpt: postExcerpt.trim(),
        content: postContent,
        category_id: postCategoryId ? postCategoryId : null,
        author_id: postAuthorId ? postAuthorId : null,
        tag_ids: postTagIds,
        is_featured: postIsFeatured,
        status: finalStatus,
        featured_image: postFeaturedImage.trim() || null,
        featured_media_id: postFeaturedMediaId || null,
        seo_title: postSeoTitle.trim() || null,
        meta_description: postMetaDescription.trim() || null,
        canonical_url: postCanonicalUrl.trim() || null,
        og_image: postOgImage.trim() || null,
        faqs: postFaqs
          .filter((f) => f.question.trim() && f.answer.trim())
          .map((f, i) => ({ question: f.question.trim(), answer: f.answer.trim(), display_order: i + 1 })),
      });

      setIsCreatingPost(false);
      setPostTitle("");
      setPostSlug("");
      setPostExcerpt("");
      setPostContent("");
      setPostCategoryId("");
      setPostAuthorId("");
      setPostTagIds([]);
      setPostIsFeatured(false);
      setPostNewTagInput("");
      setPostStatus("draft");
      setPostFeaturedImage("");
      setPostFeaturedMediaId("");
      setPostFeaturedMedia(null);
      setPostSeoTitle("");
      setPostMetaDescription("");
      setPostCanonicalUrl("");
      setPostOgImage("");
      setPostFaqs([]);

      showSuccess(`Article successfully saved as ${finalStatus}!`);
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create blog post.");
    } finally {
      setSubmittingPost(false);
    }
  };

  // Open Edit Post
  const handleOpenEditPost = (post: any) => {
    setEditingPost(post);
    setEditTitle(post.title || "");
    setEditSlug(post.slug || "");
    setEditExcerpt(post.excerpt || "");
    setEditContent(post.content || "");
    setEditCategoryId(post.category_id || "");
    setEditAuthorId(post.author_id || (post.author?.id || ""));
    setEditTagIds(post.tags ? post.tags.map((t: any) => t.id) : []);
    setEditIsFeatured(Boolean(post.is_featured));
    setEditNewTagInput("");
    setEditStatus(post.status || "draft");
    setEditFeaturedImage(post.featured_image || "");
    setEditFeaturedMediaId(post.featured_media_id || "");
    setEditFeaturedMedia(post.featured_media || null);
    setEditSeoTitle(post.seo_title || "");
    setEditMetaDescription(post.meta_description || "");
    setEditCanonicalUrl(post.canonical_url || "");
    setEditOgImage(post.og_image || "");
    setEditFaqs(
      (post.faqs || []).map((f: any) => ({
        question: f.question || "",
        answer: f.answer || "",
      }))
    );
    setErrorMessage(null);
  };

  // Save Edit Post
  const handleSaveEditPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPost) return;
    if (!editTitle.trim() || !editSlug.trim()) {
      setErrorMessage("Title and URL Slug are required.");
      return;
    }
    setSubmittingEdit(true);
    setErrorMessage(null);
    try {
      await api.updateAdminBlogPost(editingPost.id, {
        title: editTitle.trim(),
        slug: slugify(editSlug),
        excerpt: editExcerpt.trim(),
        content: editContent,
        category_id: editCategoryId ? editCategoryId : null,
        author_id: editAuthorId ? editAuthorId : null,
        tag_ids: editTagIds,
        is_featured: editIsFeatured,
        status: editStatus,
        featured_image: editFeaturedImage.trim() || null,
        featured_media_id: editFeaturedMediaId || null,
        seo_title: editSeoTitle.trim() || null,
        meta_description: editMetaDescription.trim() || null,
        canonical_url: editCanonicalUrl.trim() || null,
        og_image: editOgImage.trim() || null,
        faqs: editFaqs
          .filter((f) => f.question.trim() && f.answer.trim())
          .map((f, i) => ({ question: f.question.trim(), answer: f.answer.trim(), display_order: i + 1 })),
      });

      setEditingPost(null);
      showSuccess("Article updated successfully!");
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update article.");
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Toggle Publish / Unpublish Status
  const handleToggleStatus = async (post: any) => {
    const nextStatus = post.status === "published" ? "draft" : "published";
    setErrorMessage(null);
    try {
      await api.updateAdminBlogPost(post.id, { status: nextStatus });
      showSuccess(
        nextStatus === "published"
          ? `Article "${post.title}" is now published.`
          : `Article "${post.title}" moved to draft.`
      );
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to change post status.");
    }
  };

  // Delete Post
  const handleDeletePost = async (postId: string, title: string) => {
    if (!window.confirm(`Permanently delete article "${title}"? This action cannot be undone.`)) return;
    setErrorMessage(null);
    try {
      await api.deleteAdminBlogPost(postId);
      showSuccess("Article deleted successfully.");
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to delete article.");
    }
  };

  // Create Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) {
      setErrorMessage("Category name is required.");
      return;
    }
    setSubmittingCat(true);
    setErrorMessage(null);
    try {
      await api.createAdminBlogCategory({
        name: catName.trim(),
        slug: slugify(catSlug || catName),
        description: catDescription.trim() || undefined,
      });
      setIsCreatingCat(false);
      setCatName("");
      setCatSlug("");
      setCatDescription("");
      showSuccess("Category created successfully!");
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create category.");
    } finally {
      setSubmittingCat(false);
    }
  };

  // Open Edit Category
  const handleOpenEditCat = (cat: any) => {
    setEditingCat(cat);
    setEditCatName(cat.name || "");
    setEditCatSlug(cat.slug || "");
    setEditCatDescription(cat.description || "");
    setErrorMessage(null);
  };

  // Save Edit Category
  const handleSaveEditCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCat) return;
    setSubmittingEditCat(true);
    setErrorMessage(null);
    try {
      await api.updateAdminBlogCategory(editingCat.id, {
        name: editCatName.trim(),
        slug: slugify(editCatSlug || editCatName),
        description: editCatDescription.trim() || undefined,
      });
      setEditingCat(null);
      showSuccess("Category updated successfully!");
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update category.");
    } finally {
      setSubmittingEditCat(false);
    }
  };

  // Delete Category
  const handleDeleteCategory = async (catId: string, name: string) => {
    if (!window.confirm(`Delete category "${name}"?`)) return;
    setErrorMessage(null);
    try {
      await api.deleteAdminBlogCategory(catId);
      showSuccess("Category deleted successfully.");
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to delete category.");
    }
  };

  // Quick Add Tag (from Post editor)
  const handleQuickAddTag = async (mode: "create" | "edit") => {
    const input = mode === "create" ? postNewTagInput.trim() : editNewTagInput.trim();
    if (!input) return;
    try {
      const targetSlug = slugify(input);
      let tag = allTags.find(
        (t) => t.slug === targetSlug || t.name.toLowerCase() === input.toLowerCase()
      );
      if (!tag) {
        const created: BlogTag = await api.createAdminBlogTag({ name: input, slug: targetSlug });
        setAllTags((prev) => [...prev, created]);
        tag = created;
      }
      const tagId = tag.id;
      if (mode === "create") {
        if (!postTagIds.includes(tagId)) {
          setPostTagIds((prev) => [...prev, tagId]);
        }
        setPostNewTagInput("");
      } else {
        if (!editTagIds.includes(tagId)) {
          setEditTagIds((prev) => [...prev, tagId]);
        }
        setEditNewTagInput("");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to add tag.");
    }
  };

  // Create Tag
  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim()) {
      setErrorMessage("Tag name is required.");
      return;
    }
    setSubmittingTag(true);
    setErrorMessage(null);
    try {
      await api.createAdminBlogTag({
        name: tagName.trim(),
        slug: slugify(tagSlug || tagName),
        description: tagDescription.trim() || undefined,
      });
      setIsCreatingTag(false);
      setTagName("");
      setTagSlug("");
      setTagDescription("");
      showSuccess("Tag created successfully!");
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create tag.");
    } finally {
      setSubmittingTag(false);
    }
  };

  // Open Edit Tag
  const handleOpenEditTag = (tag: BlogTag) => {
    setEditingTag(tag);
    setEditTagName(tag.name || "");
    setEditTagSlug(tag.slug || "");
    setEditTagDescription(tag.description || "");
    setErrorMessage(null);
  };

  // Save Edit Tag
  const handleSaveEditTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTag) return;
    setSubmittingEditTag(true);
    setErrorMessage(null);
    try {
      await api.updateAdminBlogTag(editingTag.id, {
        name: editTagName.trim(),
        slug: slugify(editTagSlug || editTagName),
        description: editTagDescription.trim() || undefined,
      });
      setEditingTag(null);
      showSuccess("Tag updated successfully!");
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update tag.");
    } finally {
      setSubmittingEditTag(false);
    }
  };

  // Delete Tag
  const handleDeleteTag = async (tagId: string, name: string) => {
    if (!window.confirm(`Delete tag "${name}"? This will detach the tag from all posts without deleting posts.`)) return;
    setErrorMessage(null);
    try {
      await api.deleteAdminBlogTag(tagId);
      showSuccess("Tag deleted successfully.");
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to delete tag.");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header & Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Security Blog CMS</h1>
            <p className="text-xs text-slate-400 mt-1">
              Create, edit, publish, and manage educational Markdown articles, categories, and tags.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
              title="Refresh CMS data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
            {activeTab === "posts" ? (
              <button
                onClick={() => {
                  setIsCreatingPost(!isCreatingPost);
                  setEditingPost(null);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
              >
                {isCreatingPost ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{isCreatingPost ? "Cancel" : "New Article"}</span>
              </button>
            ) : activeTab === "categories" ? (
              <button
                onClick={() => {
                  setIsCreatingCat(!isCreatingCat);
                  setEditingCat(null);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
              >
                {isCreatingCat ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{isCreatingCat ? "Cancel" : "New Category"}</span>
              </button>
            ) : activeTab === "tags" ? (
              <button
                onClick={() => {
                  setIsCreatingTag(!isCreatingTag);
                  setEditingTag(null);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
              >
                {isCreatingTag ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{isCreatingTag ? "Cancel" : "New Tag"}</span>
              </button>
            ) : activeTab === "media" ? (
              <button
                onClick={() => {
                  setPickerMode("markdown_create");
                  setPickerTitle("Upload New Media");
                  setPickerActionLabel("Done");
                  setPickerOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Upload Media</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800 gap-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("posts")}
            className={`pb-3 transition-colors flex items-center gap-2 ${
              activeTab === "posts"
                ? "border-b-2 border-sky-500 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Articles</span>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300">
              {posts.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("categories")}
            className={`pb-3 transition-colors flex items-center gap-2 ${
              activeTab === "categories"
                ? "border-b-2 border-sky-500 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Categories</span>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300">
              {categories.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("tags")}
            className={`pb-3 transition-colors flex items-center gap-2 ${
              activeTab === "tags"
                ? "border-b-2 border-sky-500 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Tags</span>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300">
              {allTags.length}
            </span>
          </button>
          <button
            onClick={() => {
              setActiveTab("media");
              loadMedia(0, mediaSearch);
            }}
            className={`pb-3 transition-colors flex items-center gap-2 ${
              activeTab === "media"
                ? "border-b-2 border-sky-500 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Media Library</span>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300">
              {mediaTotal}
            </span>
          </button>
          <button
            onClick={() => {
              setActiveTab("redirects");
              loadRedirects();
            }}
            className={`pb-3 transition-colors flex items-center gap-2 ${
              activeTab === "redirects"
                ? "border-b-2 border-sky-500 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ExternalLink className="w-4 h-4" />
            <span>Redirects</span>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300">
              {redirects.length}
            </span>
          </button>
        </div>

        {/* Global Feedback Banners */}
        {errorMessage && (
          <div className="p-3.5 bg-red-950/70 border border-red-800/80 rounded-xl text-red-300 text-xs flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 bg-emerald-950/70 border border-emerald-800/80 rounded-xl text-emerald-300 text-xs flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* ARTICLES TAB */}
        {/* ======================================================== */}
        {activeTab === "posts" && (
          <>
            {/* Create Post Form */}
            {isCreatingPost && (
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4 w-full text-xs shadow-2xl">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-sky-400" /> Create Security Article (Markdown)
                </h3>
                <form onSubmit={(e) => handleCreatePost(e)} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Title *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Understanding Modern Security Headers"
                        value={postTitle}
                        onChange={(e) => {
                          setPostTitle(e.target.value);
                          if (!postSlug || postSlug === slugify(postTitle)) {
                            setPostSlug(slugify(e.target.value));
                          }
                        }}
                        className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">URL Slug *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. understanding-modern-security-headers"
                        value={postSlug}
                        onChange={(e) => setPostSlug(slugify(e.target.value))}
                        className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Category</label>
                      <select
                        value={postCategoryId}
                        onChange={(e) => setPostCategoryId(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                      >
                        <option value="">No Category</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Author</label>
                      <select
                        value={postAuthorId}
                        onChange={(e) => setPostAuthorId(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                      >
                        <option value="">Default (SiteSecura Team)</option>
                        {authors.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Initial Status</label>
                      <select
                        value={postStatus}
                        onChange={(e) => setPostStatus(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                      >
                        <option value="draft">Draft (Safe Default, Private)</option>
                        <option value="published">Published (Public Immediately)</option>
                      </select>
                    </div>
                  </div>

                  {/* Featured Article & Tags */}
                  <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="postIsFeatured"
                        checked={postIsFeatured}
                        onChange={(e) => setPostIsFeatured(e.target.checked)}
                        className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-sky-600 focus:ring-sky-500 cursor-pointer"
                      />
                      <label htmlFor="postIsFeatured" className="text-xs text-slate-300 font-semibold cursor-pointer flex items-center gap-1.5">
                        <Star className={`w-3.5 h-3.5 ${postIsFeatured ? "text-amber-400 fill-amber-400" : "text-slate-500"}`} />
                        <span>Feature this article (Pin to prominent blog header)</span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1.5 font-semibold">Tags</label>
                      {allTags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {allTags.map((tag) => {
                            const isSelected = postTagIds.includes(tag.id);
                            return (
                              <button
                                key={tag.id}
                                type="button"
                                onClick={() => {
                                  setPostTagIds((prev) =>
                                    isSelected ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]
                                  );
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                                  isSelected
                                    ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                                    : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
                                }`}
                              >
                                {isSelected ? "✓ " : "+ "}
                                {tag.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Add new tag..."
                          value={postNewTagInput}
                          onChange={(e) => setPostNewTagInput(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              await handleQuickAddTag("create");
                            }
                          }}
                          className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 max-w-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleQuickAddTag("create")}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
                        >
                          Add Tag
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Excerpt *</label>
                    <textarea
                      rows={2}
                      required
                      placeholder="Brief 1-2 sentence overview for listing cards and meta description..."
                      value={postExcerpt}
                      onChange={(e) => setPostExcerpt(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                    />
                  </div>

                  {/* Markdown Editor with Toolbar & Live Preview */}
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">
                      Article Content (Markdown) *
                    </label>
                    <MarkdownEditorField
                      value={postContent}
                      onChange={setPostContent}
                      placeholder="Write your article in Markdown. Use the toolbar above or syntax directly..."
                      onOpenMediaPicker={(insertCb) => handleOpenPickerForMarkdown("create", insertCb)}
                    />
                  </div>

                  {/* Media & SEO fields */}
                  <div className="pt-2 border-t border-slate-800/80 space-y-4">
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">
                        Featured Image
                      </label>
                      {postFeaturedMedia || postFeaturedImage ? (
                        <div className="flex items-center gap-4 p-3 bg-slate-900 border border-slate-800 rounded-xl">
                          <img
                            src={resolveMediaUrl(postFeaturedMedia?.public_url || postFeaturedImage)}
                            alt={postFeaturedMedia?.alt_text || "Featured image preview"}
                            className="w-20 h-14 rounded-lg object-cover border border-slate-700 bg-slate-950 shrink-0"
                          />
                          <div className="flex-1 min-w-0 text-xs">
                            <p className="text-white font-medium truncate">
                              {postFeaturedMedia?.original_filename || "Custom URL"}
                            </p>
                            <p className="text-slate-400 text-[11px] truncate">
                              {postFeaturedMedia?.width && postFeaturedMedia?.height
                                ? `${postFeaturedMedia.width}×${postFeaturedMedia.height} px • `
                                : ""}
                              {postFeaturedMedia?.file_size
                                ? `${(postFeaturedMedia.file_size / 1024).toFixed(1)} KB • `
                                : ""}
                              {postFeaturedMedia?.alt_text
                                ? `Alt: "${postFeaturedMedia.alt_text}"`
                                : "No alt text"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenPickerForFeatured("create")}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
                            >
                              Change
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPostFeaturedImage("");
                                setPostFeaturedMediaId("");
                                setPostFeaturedMedia(null);
                              }}
                              className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/50 rounded-lg transition-colors"
                              title="Remove Featured Image"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleOpenPickerForFeatured("create")}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 hover:text-white text-xs font-semibold transition-colors"
                          >
                            <ImageIcon className="w-4 h-4 text-sky-400" />
                            <span>Select or Upload Featured Image</span>
                          </button>
                          <span className="text-[11px] text-slate-500 text-center sm:text-left">
                            or direct URL:
                          </span>
                          <input
                            type="url"
                            placeholder="https://example.com/image.png"
                            value={postFeaturedImage}
                            onChange={(e) => setPostFeaturedImage(e.target.value)}
                            className="flex-1 px-3.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-500"
                          />
                        </div>
                      )}
                    </div>

                    {/* Phase E4: SEO Engine & Structured Data Fields */}
                    <div className="pt-4 border-t border-slate-800/80 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-sky-400" />
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                            SEO Metadata & Social Sharing
                          </h4>
                        </div>
                        <span className="text-[10px] text-slate-500">
                          Google Search, OpenGraph &amp; Twitter Cards
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-slate-400 font-semibold">
                              Custom SEO Title
                            </label>
                            <span
                              className={`text-[10px] font-mono ${
                                (postSeoTitle || postTitle).length > 60
                                  ? "text-amber-400"
                                  : "text-slate-500"
                              }`}
                            >
                              {(postSeoTitle || postTitle).length}/60 chars
                            </span>
                          </div>
                          <input
                            type="text"
                            placeholder={postTitle || "Defaults to article title"}
                            value={postSeoTitle}
                            onChange={(e) => setPostSeoTitle(e.target.value)}
                            className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-sky-500"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">
                            Recommended 50–60 characters for desktop &amp; mobile search SERPs.
                          </p>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-slate-400 font-semibold">
                              Meta Description
                            </label>
                            <span
                              className={`text-[10px] font-mono ${
                                (postMetaDescription || postExcerpt).length > 160
                                  ? "text-amber-400"
                                  : "text-slate-500"
                              }`}
                            >
                              {(postMetaDescription || postExcerpt).length}/160 chars
                            </span>
                          </div>
                          <input
                            type="text"
                            placeholder={postExcerpt || "Defaults to article excerpt"}
                            value={postMetaDescription}
                            onChange={(e) => setPostMetaDescription(e.target.value)}
                            className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-sky-500"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">
                            Recommended 120–160 characters summary snippet.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-slate-400 mb-1 font-semibold">
                            Canonical URL (Optional)
                          </label>
                          <input
                            type="url"
                            placeholder={`${getSiteUrl()}/blog/${postSlug || "article-slug"}`}
                            value={postCanonicalUrl}
                            onChange={(e) => setPostCanonicalUrl(e.target.value)}
                            className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-sky-500"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">
                            Leave blank to default to this article&apos;s standard permalink. Specify only if cross-posted from an original source.
                          </p>
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1 font-semibold">
                            OpenGraph / Social Card Image
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="url"
                              placeholder={postFeaturedImage || "https://example.com/og-image.png"}
                              value={postOgImage}
                              onChange={(e) => setPostOgImage(e.target.value)}
                              className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs font-mono placeholder-slate-500 focus:outline-none focus:border-sky-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleOpenPickerForOg("create")}
                              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors shrink-0"
                            >
                              Choose Media
                            </button>
                            {postOgImage && (
                              <button
                                type="button"
                                onClick={() => setPostOgImage("")}
                                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-950/50 rounded-xl transition-colors shrink-0"
                                title="Clear Custom OG Image"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1">
                            Defaults automatically to the Featured Image if omitted. (Recommended: 1200×630px).
                          </p>
                        </div>
                      </div>

                      {/* Article FAQ Section (FAQPage JSON-LD) */}
                      <div className="pt-4 border-t border-slate-800/60 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <HelpCircle className="w-4 h-4 text-sky-400" />
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                              Article FAQs (Structured Data &amp; Rich Snippets)
                            </h4>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddFaq("create")}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-950/60 hover:bg-sky-900/60 border border-sky-800/60 text-sky-300 rounded-lg text-[11px] font-semibold transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add FAQ Question</span>
                          </button>
                        </div>

                        {postFaqs.length === 0 ? (
                          <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl text-center text-slate-500 text-xs italic">
                            No FAQs added. Click &quot;Add FAQ Question&quot; to define questions and answers for visible accordion display and Google FAQ schema.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {postFaqs.map((faq, idx) => (
                              <div
                                key={idx}
                                className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2.5 relative group"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-sky-400">
                                    Question #{idx + 1}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      disabled={idx === 0}
                                      onClick={() => handleMoveFaq("create", idx, "up")}
                                      className="p-1 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-slate-800"
                                      title="Move up"
                                    >
                                      <ArrowUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={idx === postFaqs.length - 1}
                                      onClick={() => handleMoveFaq("create", idx, "down")}
                                      className="p-1 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-slate-800"
                                      title="Move down"
                                    >
                                      <ArrowDown className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveFaq("create", idx)}
                                      className="p-1 text-red-400 hover:text-red-300 rounded hover:bg-red-950/40"
                                      title="Remove FAQ"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                                <input
                                  type="text"
                                  placeholder="e.g. What is Content Security Policy (CSP)?"
                                  value={faq.question}
                                  onChange={(e) =>
                                    handleFaqChange("create", idx, "question", e.target.value)
                                  }
                                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-sky-500"
                                />
                                <textarea
                                  rows={2}
                                  placeholder="Clear, authoritative answer explaining the security concept..."
                                  value={faq.answer}
                                  onChange={(e) =>
                                    handleFaqChange("create", idx, "answer", e.target.value)
                                  }
                                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-sky-500"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Live SEO & Social Snippet Preview */}
                      <div className="pt-4 border-t border-slate-800/60 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                            Live SERP &amp; Social Card Preview
                          </h4>
                          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                            <button
                              type="button"
                              onClick={() => setPostSeoPreviewTab("search")}
                              className={`px-2.5 py-1 rounded-md transition-colors ${
                                postSeoPreviewTab === "search"
                                  ? "bg-slate-800 text-white font-semibold"
                                  : "text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              Google Search
                            </button>
                            <button
                              type="button"
                              onClick={() => setPostSeoPreviewTab("social")}
                              className={`px-2.5 py-1 rounded-md transition-colors ${
                                postSeoPreviewTab === "social"
                                  ? "bg-slate-800 text-white font-semibold"
                                  : "text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              Social Card
                            </button>
                          </div>
                        </div>

                        {postSeoPreviewTab === "search" ? (
                          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1.5 font-sans">
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                              <span className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center text-[9px] font-bold text-sky-400">
                                S
                              </span>
                              <span>sitesecura.com</span>
                              <span>›</span>
                              <span>blog</span>
                              <span>›</span>
                              <span className="font-mono text-slate-300 truncate max-w-xs">
                                {postSlug || "article-slug"}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-sky-400 hover:underline cursor-pointer truncate">
                              {postSeoTitle || postTitle || "Security Article Title"} | SiteSecura Blog
                            </p>
                            <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                              {postMetaDescription ||
                                postExcerpt ||
                                "Learn essential website security strategies, automated vulnerability testing, and best practices on the SiteSecura Blog."}
                            </p>
                          </div>
                        ) : (
                          <div className="max-w-md bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                            <div className="relative aspect-[1200/630] bg-slate-950 flex items-center justify-center overflow-hidden">
                              {postOgImage || postFeaturedMedia?.public_url || postFeaturedImage ? (
                                <img
                                  src={resolveMediaUrl(
                                    postOgImage || postFeaturedMedia?.public_url || postFeaturedImage
                                  )}
                                  alt="Social Preview"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="text-slate-600 text-xs flex flex-col items-center gap-1">
                                  <ImageIcon className="w-8 h-8 stroke-[1.5]" />
                                  <span>No image set (fallback badge used)</span>
                                </div>
                              )}
                            </div>
                            <div className="p-3 bg-slate-950/70 border-t border-slate-800/80 space-y-1">
                              <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
                                sitesecura.com
                              </span>
                              <p className="text-xs font-semibold text-white truncate">
                                {postSeoTitle || postTitle || "Security Article Title"}
                              </p>
                              <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                                {postMetaDescription ||
                                  postExcerpt ||
                                  "Comprehensive website vulnerability assessment, scanning, and monitoring from SiteSecura."}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => setIsCreatingPost(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={submittingPost}
                      onClick={(e) => handleCreatePost(e, "draft")}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl disabled:opacity-50"
                    >
                      Save as Draft
                    </button>
                    <button
                      type="button"
                      disabled={submittingPost}
                      onClick={(e) => handleCreatePost(e, "published")}
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl disabled:opacity-50"
                    >
                      {submittingPost ? "Saving..." : "Publish Article"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Edit Post Modal */}
            {editingPost && (
              <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4 max-w-6xl w-full text-xs shadow-2xl my-8">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Edit className="w-4 h-4 text-sky-400" /> Edit Article (Markdown)
                    </h3>
                    <button
                      onClick={() => setEditingPost(null)}
                      className="p-1 text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveEditPost} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">Title *</label>
                        <input
                          type="text"
                          required
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">URL Slug *</label>
                        <input
                          type="text"
                          required
                          value={editSlug}
                          onChange={(e) => setEditSlug(slugify(e.target.value))}
                          className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">Category</label>
                        <select
                          value={editCategoryId}
                          onChange={(e) => setEditCategoryId(e.target.value)}
                          className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                        >
                          <option value="">No Category</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">Author</label>
                        <select
                          value={editAuthorId}
                          onChange={(e) => setEditAuthorId(e.target.value)}
                          className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                        >
                          <option value="">Default (SiteSecura Team)</option>
                          {authors.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">Publish Status</label>
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                          className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                        >
                          <option value="draft">Draft (Not publicly visible)</option>
                          <option value="published">Published (Public)</option>
                          <option value="scheduled">Scheduled</option>
                          <option value="archived">Archived</option>
                        </select>
                      </div>
                    </div>

                    {/* Featured Article & Tags */}
                    <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="editIsFeatured"
                          checked={editIsFeatured}
                          onChange={(e) => setEditIsFeatured(e.target.checked)}
                          className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-sky-600 focus:ring-sky-500 cursor-pointer"
                        />
                        <label htmlFor="editIsFeatured" className="text-xs text-slate-300 font-semibold cursor-pointer flex items-center gap-1.5">
                          <Star className={`w-3.5 h-3.5 ${editIsFeatured ? "text-amber-400 fill-amber-400" : "text-slate-500"}`} />
                          <span>Feature this article (Pin to prominent blog header)</span>
                        </label>
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1.5 font-semibold">Tags</label>
                        {allTags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {allTags.map((tag) => {
                              const isSelected = editTagIds.includes(tag.id);
                              return (
                                <button
                                  key={tag.id}
                                  type="button"
                                  onClick={() => {
                                    setEditTagIds((prev) =>
                                      isSelected ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]
                                    );
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                                    isSelected
                                      ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                                      : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
                                  }`}
                                >
                                  {isSelected ? "✓ " : "+ "}
                                  {tag.name}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Add new tag..."
                            value={editNewTagInput}
                            onChange={(e) => setEditNewTagInput(e.target.value)}
                            onKeyDown={async (e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                await handleQuickAddTag("edit");
                              }
                            }}
                            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 max-w-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleQuickAddTag("edit")}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
                          >
                            Add Tag
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Excerpt *</label>
                      <textarea
                        rows={2}
                        required
                        value={editExcerpt}
                        onChange={(e) => setEditExcerpt(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                      />
                    </div>

                    {/* Markdown Editor with Toolbar & Live Preview */}
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">
                        Article Content (Markdown) *
                      </label>
                      <MarkdownEditorField
                        value={editContent}
                        onChange={setEditContent}
                        placeholder="Edit Markdown source..."
                        onOpenMediaPicker={(insertCb) => handleOpenPickerForMarkdown("edit", insertCb)}
                      />
                    </div>

                    {/* Media & SEO fields */}
                    <div className="pt-2 border-t border-slate-800/80 space-y-4">
                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">
                          Featured Image
                        </label>
                        {editFeaturedMedia || editFeaturedImage ? (
                          <div className="flex items-center gap-4 p-3 bg-slate-900 border border-slate-800 rounded-xl">
                            <img
                              src={resolveMediaUrl(editFeaturedMedia?.public_url || editFeaturedImage)}
                              alt={editFeaturedMedia?.alt_text || "Featured image preview"}
                              className="w-20 h-14 rounded-lg object-cover border border-slate-700 bg-slate-950 shrink-0"
                            />
                            <div className="flex-1 min-w-0 text-xs">
                              <p className="text-white font-medium truncate">
                                {editFeaturedMedia?.original_filename || "Custom URL"}
                              </p>
                              <p className="text-slate-400 text-[11px] truncate">
                                {editFeaturedMedia?.width && editFeaturedMedia?.height
                                  ? `${editFeaturedMedia.width}×${editFeaturedMedia.height} px • `
                                  : ""}
                                {editFeaturedMedia?.file_size
                                  ? `${(editFeaturedMedia.file_size / 1024).toFixed(1)} KB • `
                                  : ""}
                                {editFeaturedMedia?.alt_text
                                  ? `Alt: "${editFeaturedMedia.alt_text}"`
                                  : "No alt text"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenPickerForFeatured("edit")}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
                              >
                                Change
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditFeaturedImage("");
                                  setEditFeaturedMediaId("");
                                  setEditFeaturedMedia(null);
                                }}
                                className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/50 rounded-lg transition-colors"
                                title="Remove Featured Image"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleOpenPickerForFeatured("edit")}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 hover:text-white text-xs font-semibold transition-colors"
                            >
                              <ImageIcon className="w-4 h-4 text-sky-400" />
                              <span>Select or Upload Featured Image</span>
                            </button>
                            <span className="text-[11px] text-slate-500 text-center sm:text-left">
                              or direct URL:
                            </span>
                            <input
                              type="url"
                              placeholder="https://example.com/image.png"
                              value={editFeaturedImage}
                              onChange={(e) => setEditFeaturedImage(e.target.value)}
                              className="flex-1 px-3.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-500"
                            />
                          </div>
                        )}
                      </div>

                    {/* Phase E4: SEO Engine & Structured Data Fields */}
                    <div className="pt-4 border-t border-slate-800/80 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-sky-400" />
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                            SEO Metadata & Social Sharing
                          </h4>
                        </div>
                        <span className="text-[10px] text-slate-500">
                          Google Search, OpenGraph &amp; Twitter Cards
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-slate-400 font-semibold">
                              Custom SEO Title
                            </label>
                            <span
                              className={`text-[10px] font-mono ${
                                (editSeoTitle || editTitle).length > 60
                                  ? "text-amber-400"
                                  : "text-slate-500"
                              }`}
                            >
                              {(editSeoTitle || editTitle).length}/60 chars
                            </span>
                          </div>
                          <input
                            type="text"
                            placeholder={editTitle || "Defaults to article title"}
                            value={editSeoTitle}
                            onChange={(e) => setEditSeoTitle(e.target.value)}
                            className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-sky-500"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">
                            Recommended 50–60 characters for desktop &amp; mobile search SERPs.
                          </p>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-slate-400 font-semibold">
                              Meta Description
                            </label>
                            <span
                              className={`text-[10px] font-mono ${
                                (editMetaDescription || editExcerpt).length > 160
                                  ? "text-amber-400"
                                  : "text-slate-500"
                              }`}
                            >
                              {(editMetaDescription || editExcerpt).length}/160 chars
                            </span>
                          </div>
                          <input
                            type="text"
                            placeholder={editExcerpt || "Defaults to article excerpt"}
                            value={editMetaDescription}
                            onChange={(e) => setEditMetaDescription(e.target.value)}
                            className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-sky-500"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">
                            Recommended 120–160 characters summary snippet.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-slate-400 mb-1 font-semibold">
                            Canonical URL (Optional)
                          </label>
                          <input
                            type="url"
                            placeholder={`${getSiteUrl()}/blog/${editSlug || "article-slug"}`}
                            value={editCanonicalUrl}
                            onChange={(e) => setEditCanonicalUrl(e.target.value)}
                            className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-sky-500"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">
                            Leave blank to default to this article&apos;s standard permalink. Specify only if cross-posted from an original source.
                          </p>
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1 font-semibold">
                            OpenGraph / Social Card Image
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="url"
                              placeholder={editFeaturedImage || "https://example.com/og-image.png"}
                              value={editOgImage}
                              onChange={(e) => setEditOgImage(e.target.value)}
                              className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs font-mono placeholder-slate-500 focus:outline-none focus:border-sky-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleOpenPickerForOg("edit")}
                              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors shrink-0"
                            >
                              Choose Media
                            </button>
                            {editOgImage && (
                              <button
                                type="button"
                                onClick={() => setEditOgImage("")}
                                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-950/50 rounded-xl transition-colors shrink-0"
                                title="Clear Custom OG Image"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1">
                            Defaults automatically to the Featured Image if omitted. (Recommended: 1200×630px).
                          </p>
                        </div>
                      </div>

                      {/* Article FAQ Section (FAQPage JSON-LD) */}
                      <div className="pt-4 border-t border-slate-800/60 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <HelpCircle className="w-4 h-4 text-sky-400" />
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                              Article FAQs (Structured Data &amp; Rich Snippets)
                            </h4>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddFaq("edit")}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-950/60 hover:bg-sky-900/60 border border-sky-800/60 text-sky-300 rounded-lg text-[11px] font-semibold transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add FAQ Question</span>
                          </button>
                        </div>

                        {editFaqs.length === 0 ? (
                          <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl text-center text-slate-500 text-xs italic">
                            No FAQs added. Click &quot;Add FAQ Question&quot; to define questions and answers for visible accordion display and Google FAQ schema.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {editFaqs.map((faq, idx) => (
                              <div
                                key={idx}
                                className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2.5 relative group"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-sky-400">
                                    Question #{idx + 1}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      disabled={idx === 0}
                                      onClick={() => handleMoveFaq("edit", idx, "up")}
                                      className="p-1 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-slate-800"
                                      title="Move up"
                                    >
                                      <ArrowUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={idx === editFaqs.length - 1}
                                      onClick={() => handleMoveFaq("edit", idx, "down")}
                                      className="p-1 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-slate-800"
                                      title="Move down"
                                    >
                                      <ArrowDown className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveFaq("edit", idx)}
                                      className="p-1 text-red-400 hover:text-red-300 rounded hover:bg-red-950/40"
                                      title="Remove FAQ"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                                <input
                                  type="text"
                                  placeholder="e.g. What is Content Security Policy (CSP)?"
                                  value={faq.question}
                                  onChange={(e) =>
                                    handleFaqChange("edit", idx, "question", e.target.value)
                                  }
                                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-sky-500"
                                />
                                <textarea
                                  rows={2}
                                  placeholder="Clear, authoritative answer explaining the security concept..."
                                  value={faq.answer}
                                  onChange={(e) =>
                                    handleFaqChange("edit", idx, "answer", e.target.value)
                                  }
                                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-sky-500"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Live SEO & Social Snippet Preview */}
                      <div className="pt-4 border-t border-slate-800/60 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                            Live SERP &amp; Social Card Preview
                          </h4>
                          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                            <button
                              type="button"
                              onClick={() => setEditSeoPreviewTab("search")}
                              className={`px-2.5 py-1 rounded-md transition-colors ${
                                editSeoPreviewTab === "search"
                                  ? "bg-slate-800 text-white font-semibold"
                                  : "text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              Google Search
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditSeoPreviewTab("social")}
                              className={`px-2.5 py-1 rounded-md transition-colors ${
                                editSeoPreviewTab === "social"
                                  ? "bg-slate-800 text-white font-semibold"
                                  : "text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              Social Card
                            </button>
                          </div>
                        </div>

                        {editSeoPreviewTab === "search" ? (
                          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1.5 font-sans">
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                              <span className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center text-[9px] font-bold text-sky-400">
                                S
                              </span>
                              <span>sitesecura.com</span>
                              <span>›</span>
                              <span>blog</span>
                              <span>›</span>
                              <span className="font-mono text-slate-300 truncate max-w-xs">
                                {editSlug || "article-slug"}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-sky-400 hover:underline cursor-pointer truncate">
                              {editSeoTitle || editTitle || "Security Article Title"} | SiteSecura Blog
                            </p>
                            <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                              {editMetaDescription ||
                                editExcerpt ||
                                "Learn essential website security strategies, automated vulnerability testing, and best practices on the SiteSecura Blog."}
                            </p>
                          </div>
                        ) : (
                          <div className="max-w-md bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                            <div className="relative aspect-[1200/630] bg-slate-950 flex items-center justify-center overflow-hidden">
                              {editOgImage || editFeaturedMedia?.public_url || editFeaturedImage ? (
                                <img
                                  src={resolveMediaUrl(
                                    editOgImage || editFeaturedMedia?.public_url || editFeaturedImage
                                  )}
                                  alt="Social Preview"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="text-slate-600 text-xs flex flex-col items-center gap-1">
                                  <ImageIcon className="w-8 h-8 stroke-[1.5]" />
                                  <span>No image set (fallback badge used)</span>
                                </div>
                              )}
                            </div>
                            <div className="p-3 bg-slate-950/70 border-t border-slate-800/80 space-y-1">
                              <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
                                sitesecura.com
                              </span>
                              <p className="text-xs font-semibold text-white truncate">
                                {editSeoTitle || editTitle || "Security Article Title"}
                              </p>
                              <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                                {editMetaDescription ||
                                  editExcerpt ||
                                  "Comprehensive website vulnerability assessment, scanning, and monitoring from SiteSecura."}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3">
                      <button
                        type="button"
                        onClick={() => setEditingPost(null)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submittingEdit}
                        className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl disabled:opacity-50"
                      >
                        {submittingEdit ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Posts Table */}
            <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-5">Article Title</th>
                    <th className="py-3 px-5">Category</th>
                    <th className="py-3 px-5">URL Route</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5">Published Date</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                  {posts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No articles found in blog CMS.
                      </td>
                    </tr>
                  ) : (
                    posts.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-3.5 px-5 max-w-xs">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-white truncate">{p.title}</span>
                            {p.is_featured && (
                              <span className="inline-flex items-center gap-1 text-[9px] text-amber-300 bg-amber-950/70 border border-amber-700/60 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">
                                <Star className="w-2.5 h-2.5 fill-amber-300" /> Featured
                              </span>
                            )}
                          </div>
                          {p.author && (
                            <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-500" />
                              <span>{p.author.name}</span>
                            </p>
                          )}
                          {p.tags && p.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {p.tags.map((t: any) => (
                                <span
                                  key={t.id}
                                  className="text-[9px] bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono"
                                >
                                  #{t.slug}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-5">
                          {p.category ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 bg-sky-950/60 border border-sky-800/50 px-2 py-0.5 rounded-full">
                              {p.category.name}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 font-mono text-slate-400">
                          {p.status === "published" ? (
                            <a
                              href={`/blog/${p.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sky-400 hover:underline inline-flex items-center gap-1"
                            >
                              <span>/blog/{p.slug}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span>/blog/{p.slug}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5">
                          <span
                            className={`capitalize px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${
                              p.status === "published"
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                : p.status === "draft"
                                ? "bg-slate-800 text-slate-400"
                                : p.status === "scheduled"
                                ? "bg-indigo-950 text-indigo-400 border border-indigo-800"
                                : "bg-amber-950 text-amber-400 border border-amber-800"
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-slate-400">
                          {p.published_at ? new Date(p.published_at).toLocaleDateString() : "Unpublished"}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEditPost(p)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                              title="Edit Article"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(p)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-semibold transition-colors"
                            >
                              {p.status === "published" ? "Unpublish" : "Publish"}
                            </button>
                            <button
                              onClick={() => handleDeletePost(p.id, p.title)}
                              className="p-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/40 rounded-lg transition-colors"
                              title="Delete Article"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ======================================================== */}
        {/* CATEGORIES TAB */}
        {/* ======================================================== */}
        {activeTab === "categories" && (
          <>
            {/* Create Category Form */}
            {isCreatingCat && (
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4 max-w-xl text-xs shadow-2xl">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Tag className="w-4 h-4 text-sky-400" /> Create Category
                </h3>
                <form onSubmit={handleCreateCategory} className="space-y-3">
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Category Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Website Security"
                      value={catName}
                      onChange={(e) => {
                        setCatName(e.target.value);
                        if (!catSlug || catSlug === slugify(catName)) {
                          setCatSlug(slugify(e.target.value));
                        }
                      }}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">URL Slug</label>
                    <input
                      type="text"
                      placeholder="e.g. website-security"
                      value={catSlug}
                      onChange={(e) => setCatSlug(slugify(e.target.value))}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Description</label>
                    <textarea
                      rows={2}
                      placeholder="Category focus and purpose..."
                      value={catDescription}
                      onChange={(e) => setCatDescription(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsCreatingCat(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingCat}
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl disabled:opacity-50"
                    >
                      {submittingCat ? "Creating..." : "Create Category"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Edit Category Modal */}
            {editingCat && (
              <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4 max-w-xl w-full text-xs shadow-2xl">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Tag className="w-4 h-4 text-sky-400" /> Edit Category
                    </h3>
                    <button onClick={() => setEditingCat(null)} className="p-1 text-slate-400 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveEditCat} className="space-y-3">
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Category Name *</label>
                      <input
                        type="text"
                        required
                        value={editCatName}
                        onChange={(e) => setEditCatName(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">URL Slug *</label>
                      <input
                        type="text"
                        required
                        value={editCatSlug}
                        onChange={(e) => setEditCatSlug(slugify(e.target.value))}
                        className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Description</label>
                      <textarea
                        rows={2}
                        value={editCatDescription}
                        onChange={(e) => setEditCatDescription(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingCat(null)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submittingEditCat}
                        className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl disabled:opacity-50"
                      >
                        {submittingEditCat ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Categories Table */}
            <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-5">Name</th>
                    <th className="py-3 px-5">Slug</th>
                    <th className="py-3 px-5">Description</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                  {categories.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-400">
                        No categories found.
                      </td>
                    </tr>
                  ) : (
                    categories.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-3.5 px-5 font-semibold text-white">{c.name}</td>
                        <td className="py-3.5 px-5 font-mono text-slate-400">{c.slug}</td>
                        <td className="py-3.5 px-5 text-slate-400 max-w-sm truncate">
                          {c.description || "—"}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEditCat(c)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                              title="Edit Category"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(c.id, c.name)}
                              className="p-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/40 rounded-lg transition-colors"
                              title="Delete Category"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ======================================================== */}
        {/* TAGS TAB */}
        {/* ======================================================== */}
        {activeTab === "tags" && (
          <>
            {/* Create Tag Form */}
            {isCreatingTag && (
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4 max-w-xl text-xs shadow-2xl">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Tag className="w-4 h-4 text-sky-400" /> Create Tag
                </h3>
                <form onSubmit={handleCreateTag} className="space-y-3">
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Tag Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. SSL/TLS"
                      value={tagName}
                      onChange={(e) => {
                        setTagName(e.target.value);
                        if (!tagSlug || tagSlug === slugify(tagName)) {
                          setTagSlug(slugify(e.target.value));
                        }
                      }}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">URL Slug</label>
                    <input
                      type="text"
                      placeholder="e.g. ssl-tls"
                      value={tagSlug}
                      onChange={(e) => setTagSlug(slugify(e.target.value))}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Description</label>
                    <textarea
                      rows={2}
                      placeholder="Topic definition or scope..."
                      value={tagDescription}
                      onChange={(e) => setTagDescription(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsCreatingTag(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingTag}
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl disabled:opacity-50"
                    >
                      {submittingTag ? "Creating..." : "Create Tag"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Edit Tag Modal */}
            {editingTag && (
              <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4 max-w-xl w-full text-xs shadow-2xl">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Tag className="w-4 h-4 text-sky-400" /> Edit Tag
                    </h3>
                    <button onClick={() => setEditingTag(null)} className="p-1 text-slate-400 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveEditTag} className="space-y-3">
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Tag Name *</label>
                      <input
                        type="text"
                        required
                        value={editTagName}
                        onChange={(e) => setEditTagName(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">URL Slug *</label>
                      <input
                        type="text"
                        required
                        value={editTagSlug}
                        onChange={(e) => setEditTagSlug(slugify(e.target.value))}
                        className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Description</label>
                      <textarea
                        rows={2}
                        value={editTagDescription}
                        onChange={(e) => setEditTagDescription(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingTag(null)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submittingEditTag}
                        className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl disabled:opacity-50"
                      >
                        {submittingEditTag ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Tags Table */}
            <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-5">Name</th>
                    <th className="py-3 px-5">Slug</th>
                    <th className="py-3 px-5">Description</th>
                    <th className="py-3 px-5">Post Count</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                  {allTags.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        No tags found.
                      </td>
                    </tr>
                  ) : (
                    allTags.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-3.5 px-5 font-semibold text-white">{t.name}</td>
                        <td className="py-3.5 px-5 font-mono text-slate-400">#{t.slug}</td>
                        <td className="py-3.5 px-5 text-slate-400 max-w-sm truncate">
                          {t.description || "—"}
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300">
                            {t.post_count ?? 0}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEditTag(t)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                              title="Edit Tag"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTag(t.id, t.name)}
                              className="p-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/40 rounded-lg transition-colors"
                              title="Delete Tag"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ======================================================== */}
        {/* MEDIA LIBRARY TAB */}
        {/* ======================================================== */}
        {activeTab === "media" && (
          <div className="space-y-6">
            {/* Toolbar: Search & Refresh */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search media by filename or alt text..."
                  value={mediaSearch}
                  onChange={(e) => {
                    setMediaSearch(e.target.value);
                    loadMedia(0, e.target.value);
                  }}
                  className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadMedia(mediaOffset, mediaSearch)}
                  disabled={mediaLoading}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${mediaLoading ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPickerMode("markdown_create");
                    setPickerTitle("Upload New Media");
                    setPickerActionLabel("Done");
                    setPickerOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Upload Image</span>
                </button>
              </div>
            </div>

            {/* Media Grid */}
            {mediaLoading && mediaAssets.length === 0 ? (
              <div className="py-24 text-center text-slate-400 text-xs flex flex-col items-center gap-3">
                <RefreshCw className="w-8 h-8 animate-spin text-sky-500" />
                <span>Loading media assets...</span>
              </div>
            ) : mediaAssets.length === 0 ? (
              <div className="bg-slate-950 border border-slate-800 rounded-2xl py-20 px-6 text-center space-y-4">
                <ImageIcon className="w-12 h-12 text-slate-700 mx-auto stroke-[1.5]" />
                <div className="space-y-1">
                  <h3 className="text-white font-semibold text-sm">No media assets found</h3>
                  <p className="text-slate-400 text-xs">
                    {mediaSearch
                      ? `No media matches "${mediaSearch}". Try a different search term.`
                      : "Upload images (.jpg, .png, .webp) to enrich your security articles."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPickerMode("markdown_create");
                    setPickerTitle("Upload New Media");
                    setPickerActionLabel("Done");
                    setPickerOpen(true);
                  }}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Upload First Image</span>
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {mediaAssets.map((asset) => {
                    const resolvedUrl = resolveMediaUrl(asset.public_url);
                    const isDeleting = deletingMediaId === asset.id;
                    const isCopied = copiedId === asset.id;
                    const isUrlCopied = copiedId === `url-${asset.id}`;

                    return (
                      <div
                        key={asset.id}
                        className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between group hover:border-slate-700 transition-colors"
                      >
                        {/* Image Preview Box */}
                        <div
                          onClick={() => handleOpenMediaDetail(asset)}
                          className="relative aspect-[16/10] bg-slate-900 cursor-pointer overflow-hidden"
                        >
                          <img
                            src={resolvedUrl}
                            alt={asset.alt_text || asset.original_filename}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                          <div className="absolute top-2 right-2 flex items-center gap-1">
                            <span className="px-1.5 py-0.5 bg-slate-950/80 backdrop-blur-sm rounded text-[10px] font-mono text-slate-300 border border-slate-800">
                              {asset.mime_type.split("/")[1]?.toUpperCase() || "IMAGE"}
                            </span>
                          </div>
                        </div>

                        {/* Card Info */}
                        <div className="p-3.5 space-y-2 flex-1">
                          <p
                            onClick={() => handleOpenMediaDetail(asset)}
                            title={asset.original_filename}
                            className="text-xs font-semibold text-white truncate cursor-pointer hover:text-sky-400 transition-colors"
                          >
                            {asset.original_filename}
                          </p>

                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span>
                              {asset.width && asset.height
                                ? `${asset.width}×${asset.height}`
                                : "Vector/Raster"}
                            </span>
                            <span>
                              {asset.file_size < 1024 * 1024
                                ? `${(asset.file_size / 1024).toFixed(1)} KB`
                                : `${(asset.file_size / (1024 * 1024)).toFixed(2)} MB`}
                            </span>
                          </div>

                          <div className="text-[11px] truncate">
                            {asset.alt_text ? (
                              <span className="text-slate-400 italic truncate block">
                                Alt: &ldquo;{asset.alt_text}&rdquo;
                              </span>
                            ) : (
                              <span className="text-amber-500 font-medium text-[10px]">
                                ⚠️ Missing alt text
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Card Actions */}
                        <div className="px-3.5 py-2.5 border-t border-slate-800/80 bg-slate-900/50 flex items-center justify-between gap-1 text-xs">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleCopyMarkdown(asset)}
                              title="Copy Markdown snippet"
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-400">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>MD</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyUrl(asset)}
                              title="Copy Image URL"
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] font-medium transition-colors"
                            >
                              {isUrlCopied ? (
                                <span className="text-emerald-400 text-[10px]">URL ✓</span>
                              ) : (
                                <span className="text-[10px]">URL</span>
                              )}
                            </button>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenMediaDetail(asset)}
                              title="View details & edit metadata"
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMediaAsset(asset)}
                              disabled={isDeleting}
                              title="Delete media asset"
                              className="p-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/40 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800 text-xs text-slate-400">
                  <div>
                    Showing {mediaTotal === 0 ? 0 : mediaOffset + 1} to{" "}
                    {Math.min(mediaOffset + mediaLimit, mediaTotal)} of {mediaTotal} assets
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={mediaOffset === 0 || mediaLoading}
                      onClick={() =>
                        loadMedia(Math.max(0, mediaOffset - mediaLimit), mediaSearch)
                      }
                      className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl transition-colors flex items-center gap-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Previous</span>
                    </button>
                    <button
                      type="button"
                      disabled={mediaOffset + mediaLimit >= mediaTotal || mediaLoading}
                      onClick={() => loadMedia(mediaOffset + mediaLimit, mediaSearch)}
                      className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl transition-colors flex items-center gap-1"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* REDIRECTS TAB (Phase E4) */}
        {/* ======================================================== */}
        {activeTab === "redirects" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-950 p-5 rounded-2xl border border-slate-800">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-sky-400" />
                  SEO Slug Redirects Engine
                </h3>
                <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                  Historical URL slug redirects (HTTP 301 / 308). Whenever a published article&apos;s slug is updated,
                  the SEO engine automatically creates a permanent redirect, prevents routing loops, and collapses multi-hop chains (A → B → C becomes A → C).
                </p>
              </div>
              <button
                type="button"
                onClick={loadRedirects}
                disabled={redirectsLoading}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors shrink-0 self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${redirectsLoading ? "animate-spin" : ""}`} />
                <span>Refresh Redirects</span>
              </button>
            </div>

            <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-5">Source URL Path</th>
                    <th className="py-3 px-5">Target URL Path</th>
                    <th className="py-3 px-5">HTTP Status</th>
                    <th className="py-3 px-5">Created Date</th>
                    <th className="py-3 px-5 text-right">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                  {redirectsLoading && redirects.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-400" />
                        Loading redirects...
                      </td>
                    </tr>
                  ) : redirects.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <ExternalLink className="w-8 h-8 text-slate-700 mx-auto mb-2 stroke-[1.5]" />
                        <p className="text-white font-semibold">No URL redirects recorded</p>
                        <p className="text-slate-500 text-[11px] mt-1">
                          When you update the slug of a published article, permanent 301 redirects will appear here.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    redirects.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-3.5 px-5 font-mono text-red-400/90 flex items-center gap-1.5">
                          <span className="text-slate-500">/blog/</span>
                          <span className="font-semibold">{r.old_slug}</span>
                        </td>
                        <td className="py-3.5 px-5 font-mono text-emerald-400 flex items-center gap-1.5">
                          <CornerDownRight className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-slate-500">/blog/</span>
                          <span className="font-semibold">{r.target_slug}</span>
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                            {r.status_code || 301} Permanent
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-slate-400">
                          {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <a
                            href={`/blog/${r.old_slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg text-[11px] font-semibold transition-colors"
                          >
                            <span>Test Redirect</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Media Details / Edit Drawer Modal */}
        {selectedAssetDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <ImageIcon className="w-4 h-4 text-sky-400" />
                  <span>Media Asset Details</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAssetDetail(null)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
                {/* Image Preview Box */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-center max-h-64 overflow-hidden">
                  <img
                    src={resolveMediaUrl(selectedAssetDetail.public_url)}
                    alt={selectedAssetDetail.alt_text || "Preview"}
                    className="max-h-60 rounded-lg object-contain"
                  />
                </div>

                {/* Technical Metadata */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5 text-slate-300">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                      Dimensions
                    </span>
                    <span className="font-mono">
                      {selectedAssetDetail.width && selectedAssetDetail.height
                        ? `${selectedAssetDetail.width} × ${selectedAssetDetail.height}`
                        : "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                      File Size
                    </span>
                    <span className="font-mono">
                      {selectedAssetDetail.file_size < 1024 * 1024
                        ? `${(selectedAssetDetail.file_size / 1024).toFixed(1)} KB`
                        : `${(selectedAssetDetail.file_size / (1024 * 1024)).toFixed(2)} MB`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                      MIME Type
                    </span>
                    <span className="font-mono">{selectedAssetDetail.mime_type}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                      Created
                    </span>
                    <span>{new Date(selectedAssetDetail.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Storage & Public Info */}
                <div className="space-y-2">
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Public URL</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={resolveMediaUrl(selectedAssetDetail.public_url)}
                        className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[11px] text-slate-300"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyUrl(selectedAssetDetail)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  {selectedAssetDetail.checksum_sha256 && (
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                        SHA256 Checksum
                      </span>
                      <span className="font-mono text-[11px] text-slate-400 break-all select-all">
                        {selectedAssetDetail.checksum_sha256}
                      </span>
                    </div>
                  )}
                </div>

                {/* Editable Metadata Form */}
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">
                      Alt Text (Accessibility & SEO)
                    </label>
                    <input
                      type="text"
                      placeholder="Descriptive text for accessibility..."
                      value={detailAlt}
                      onChange={(e) => setDetailAlt(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">
                      Caption (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Optional caption displayed under image in articles..."
                      value={detailCaption}
                      onChange={(e) => setDetailCaption(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleDeleteMediaAsset(selectedAssetDetail)}
                  className="px-3.5 py-2 bg-red-950/50 hover:bg-red-900/60 text-red-400 border border-red-800/50 rounded-xl font-semibold text-xs transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Asset</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAssetDetail(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveMediaDetail}
                    disabled={savingDetail}
                    className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
                  >
                    {savingDetail ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>{savingDetail ? "Saving..." : "Save Metadata"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Media Picker Modal */}
        <MediaPickerModal
          isOpen={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={handleMediaPickerSelect}
          title={pickerTitle}
          actionLabel={pickerActionLabel}
        />
      </div>
    </AdminLayout>
  );
}
