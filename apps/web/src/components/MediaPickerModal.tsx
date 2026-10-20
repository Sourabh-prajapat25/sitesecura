"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Upload,
  Search,
  Image as ImageIcon,
  Check,
  AlertCircle,
  RefreshCw,
  FileCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/utils";
import { MediaAsset } from "@/types";

export interface MediaPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (asset: MediaAsset, customAlt?: string, customCaption?: string) => void;
  title?: string;
  actionLabel?: string;
}

export function MediaPickerModal({
  isOpen,
  onClose,
  onSelect,
  title = "Select Image",
  actionLabel = "Insert Image",
}: MediaPickerModalProps) {
  const [activeTab, setActiveTab] = useState<"library" | "upload">("library");
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
  const [customAlt, setCustomAlt] = useState("");
  const [customCaption, setCustomCaption] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadAlt, setUploadAlt] = useState("");
  const [uploadCaption, setUploadCaption] = useState("");
  const [uploading, setUploading] = useState(false);

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const loadAssets = async (query = search) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getAdminBlogMedia({ search: query, limit: 30 });
      setAssets(res.items || []);
    } catch (err: any) {
      setError(err.message || "Failed to load media assets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAssets();
      setSelectedAsset(null);
      setCustomAlt("");
      setCustomCaption("");
      setError(null);
      setUploadFile(null);
      setUploadPreview(null);
      setUploadAlt("");
      setUploadCaption("");
    }
  }, [isOpen]);

  const handleSelectAsset = (asset: MediaAsset) => {
    setSelectedAsset(asset);
    setCustomAlt(asset.alt_text || "");
    setCustomCaption(asset.caption || "");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("File exceeds maximum allowed size of 5 MB.");
      return;
    }

    setUploadFile(file);
    setError(null);

    const reader = new FileReader();
    reader.onload = () => {
      setUploadPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setError("Please select an image file to upload.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const createdAsset = await api.uploadAdminBlogMedia(
        uploadFile,
        uploadAlt.trim() || undefined,
        uploadCaption.trim() || undefined
      );

      // Prepend to library list
      setAssets((prev) => [createdAsset, ...prev]);
      handleSelectAsset(createdAsset);
      setActiveTab("library");

      // Reset upload fields
      setUploadFile(null);
      setUploadPreview(null);
      setUploadAlt("");
      setUploadCaption("");
    } catch (err: any) {
      setError(err.message || "Upload failed. Please ensure the file is a valid image (.jpg, .png, .webp).");
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmSelect = () => {
    if (!selectedAsset) return;
    onSelect(selectedAsset, customAlt.trim() || undefined, customCaption.trim() || undefined);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <ImageIcon className="w-5 h-5 text-sky-400" />
            <span>{title}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-3 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("library")}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === "library"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Media Library</span>
            </button>
            <button
              onClick={() => setActiveTab("upload")}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === "upload"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload New</span>
            </button>
          </div>

          {activeTab === "library" && (
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search images..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  loadAssets(e.target.value);
                }}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          )}
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mx-6 mt-3 p-3 bg-red-950/70 border border-red-800 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 min-h-[340px]">
          {activeTab === "library" ? (
            loading ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-sky-500" />
                <span>Loading media assets...</span>
              </div>
            ) : assets.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs gap-3 text-center">
                <ImageIcon className="w-12 h-12 text-slate-700 stroke-[1.5]" />
                <p>No images found in your Media Library.</p>
                <button
                  onClick={() => setActiveTab("upload")}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 font-semibold rounded-lg transition-colors"
                >
                  Upload your first image
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {assets.map((asset) => {
                  const isSelected = selectedAsset?.id === asset.id;
                  const thumbUrl = resolveMediaUrl(asset.public_url);

                  return (
                    <div
                      key={asset.id}
                      onClick={() => handleSelectAsset(asset)}
                      className={`group relative rounded-xl overflow-hidden border cursor-pointer transition-all aspect-[4/3] bg-slate-950 ${
                        isSelected
                          ? "border-sky-500 ring-2 ring-sky-500/50 shadow-lg"
                          : "border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <img
                        src={thumbUrl}
                        alt={asset.alt_text || asset.original_filename}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-sky-600 text-white p-1 rounded-full shadow-md">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent p-2 text-[10px] text-slate-300 truncate">
                        <p className="font-semibold truncate text-white">
                          {asset.original_filename}
                        </p>
                        <p className="text-slate-400">
                          {asset.width && asset.height ? `${asset.width}×${asset.height} • ` : ""}
                          {formatSize(asset.file_size)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* Upload Tab */
            <form onSubmit={handleUpload} className="max-w-xl mx-auto space-y-4">
              <div className="border-2 border-dashed border-slate-700 hover:border-sky-500 rounded-2xl p-6 text-center transition-colors bg-slate-950/40">
                {uploadPreview ? (
                  <div className="space-y-3">
                    <img
                      src={uploadPreview}
                      alt="Upload preview"
                      className="max-h-48 mx-auto rounded-xl border border-slate-800 object-contain"
                    />
                    <div className="text-xs text-slate-300 font-medium">
                      {uploadFile?.name} ({uploadFile && formatSize(uploadFile.size)})
                    </div>
                    <label className="inline-block px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg cursor-pointer transition-colors">
                      Change File
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="space-y-2 py-6">
                    <Upload className="w-10 h-10 text-sky-500 mx-auto stroke-[1.5]" />
                    <p className="text-xs font-semibold text-white">
                      Click to choose or drag an image here
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Supports JPEG, PNG, and WebP up to 5 MB.
                    </p>
                    <label className="inline-block mt-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm transition-colors">
                      Select Image
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">
                    Alt Text (Accessibility & SEO)
                  </label>
                  <input
                    type="text"
                    placeholder="Descriptive text for visually impaired readers and search engines..."
                    value={uploadAlt}
                    onChange={(e) => setUploadAlt(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">
                    Caption (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Optional image caption displayed under the illustration..."
                    value={uploadCaption}
                    onChange={(e) => setUploadCaption(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={!uploadFile || uploading}
                  className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-2"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Optimizing & Saving...</span>
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>Upload & Select</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer: Selection Details & Confirmation */}
        {selectedAsset && activeTab === "library" && (
          <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/70 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <img
                src={resolveMediaUrl(selectedAsset.public_url)}
                alt={selectedAsset.alt_text || "Selected"}
                className="w-12 h-12 rounded-lg object-cover border border-slate-800 shrink-0"
              />
              <div className="text-xs truncate">
                <p className="text-white font-semibold truncate max-w-xs">
                  {selectedAsset.original_filename}
                </p>
                <p className="text-[11px] text-slate-400">
                  {selectedAsset.width && selectedAsset.height
                    ? `${selectedAsset.width}×${selectedAsset.height} px • `
                    : ""}
                  {formatSize(selectedAsset.file_size)}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Alt text"
                  value={customAlt}
                  onChange={(e) => setCustomAlt(e.target.value)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 w-44"
                  title="Override Alt Text for this placement"
                />
                <input
                  type="text"
                  placeholder="Caption (opt)"
                  value={customCaption}
                  onChange={(e) => setCustomCaption(e.target.value)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 w-36"
                  title="Override Caption for this placement"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSelect}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{actionLabel}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
