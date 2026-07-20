"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { REQUIRED_DOCUMENTS } from "@/lib/constants";
import type { Document } from "@/lib/types";
import { ArrowLeft, Upload, File, CheckCircle, X, Download, Circle } from "lucide-react";

type ChecklistItem = {
  id: string;
  label: string;
  description: string;
  satisfied: boolean;
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [category, setCategory] = useState("other");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/documents");
      if (!res.ok) {
        // Fall back to portal payload if list route fails
        const portalRes = await fetch("/api/portal");
        if (!portalRes.ok) {
          window.location.href = "/login";
          return;
        }
        const data = await portalRes.json();
        setDocuments(data.client?.documents || []);
        return;
      }
      const data = await res.json();
      setDocuments(data.documents || []);
      setChecklist(data.checklist || []);
    } catch {
      window.location.href = "/login";
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);

    try {
      const res = await fetch("/api/portal/documents", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setSuccess(`${file.name} uploaded successfully`);
      await fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const downloadDoc = async (docId: string) => {
    try {
      // Stream through app (decrypted server-side) — no public storage URL
      const res = await fetch(`/api/portal/documents/${docId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Download failed");
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="([^"]+)"/);
      const name = match?.[1] || "document";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const displayChecklist =
    checklist.length > 0
      ? checklist
      : REQUIRED_DOCUMENTS.map((d) => ({
          ...d,
          satisfied: documents.some(
            (doc) =>
              doc.category === d.id ||
              doc.name.toLowerCase().includes(d.id.replace("_", ""))
          ),
        }));

  return (
    <>
      <Header showNav={false} />
      <main className="flex-1 max-w-2xl mx-auto px-4 py-8 w-full">
        <Link
          href="/portal"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-navy-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Portal
        </Link>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Upload Documents</CardTitle>
            <CardDescription>
              Securely upload your tax documents. Accepted formats: PDF, JPG, PNG (max 10MB each).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                Document type
              </label>
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                {REQUIRED_DOCUMENTS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </div>

            <div
              className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-navy-400 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <p className="font-medium text-slate-700 mb-1">
                {uploading ? "Uploading..." : "Click to upload or drag files here"}
              </p>
              <p className="text-sm text-slate-500">PDF, JPG, PNG up to 10MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={handleUpload}
                className="hidden"
                disabled={uploading}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <X className="w-4 h-4" /> {error}
              </p>
            )}
            {success && (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" /> {success}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Document checklist</CardTitle>
            <CardDescription>
              Mark items off by uploading with the matching document type.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {displayChecklist.map((doc) => (
                <li key={doc.id} className="flex items-start gap-2 text-sm">
                  {doc.satisfied ? (
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-300 mt-0.5" />
                  )}
                  <div>
                    <span
                      className={`font-medium ${
                        doc.satisfied ? "text-green-800" : "text-slate-700"
                      }`}
                    >
                      {doc.label}
                    </span>
                    <span className="text-slate-500"> — {doc.description}</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {documents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Uploaded Files ({documents.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg gap-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <File className="w-5 h-5 text-navy-700 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{doc.name}</p>
                        <p className="text-xs text-slate-500">
                          {doc.category && (
                            <span className="capitalize">{doc.category.replace(/_/g, " ")} · </span>
                          )}
                          {formatFileSize(doc.file_size)} ·{" "}
                          {new Date(doc.uploaded_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => downloadDoc(doc.id)}
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
