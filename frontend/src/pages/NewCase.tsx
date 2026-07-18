import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FileText, X, Loader2, Sparkles } from "lucide-react";
import { createCase, uploadFiles, runCase } from "../api/client";

export default function NewCase() {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => setFiles((prev) => [...prev, ...accepted]),
  });

  const removeFile = (name: string) => setFiles((f) => f.filter((x) => x.name !== name));

  const start = async () => {
    setBusy(true);
    try {
      const { id } = await createCase();
      await uploadFiles(id, files);
      await runCase(id);
      navigate(`/cases/${id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 animate-fade-up">
      <h1 className="text-2xl font-bold tracking-tight h-page">New verification case</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-8">
        Upload the customer's documents in any order — the agents will identify, sort and verify them.
      </p>

      <div {...getRootProps()}
           className={`rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer
                       transition-all duration-300
                       ${isDragActive
                         ? "border-slate-900 bg-slate-100 dark:border-white dark:bg-slate-800 scale-[1.01]"
                         : `border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/60
                            dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-500
                            dark:hover:bg-slate-800/60`}`}>
        <input {...getInputProps()} />
        <span className="mx-auto w-14 h-14 rounded-2xl chip-slate flex items-center justify-center mb-4">
          <UploadCloud size={26} />
        </span>
        <p className="font-semibold text-slate-700 dark:text-slate-200">
          {isDragActive ? "Drop them here" : "Drag & drop documents"}
        </p>
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
          PDFs, scans, photos · or click to browse
        </p>
      </div>

      {files.length > 0 && (
        <ul className="mt-5 space-y-2">
          {files.map((f, i) => (
            <li key={f.name}
                className="card card-hover flex items-center gap-3 px-4 py-3 animate-fade-up"
                style={{ animationDelay: `${i * 50}ms` }}>
              <span className="w-9 h-9 rounded-lg chip-blue flex items-center justify-center shrink-0">
                <FileText size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{f.name}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{(f.size / 1024).toFixed(0)} KB</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); removeFile(f.name); }}
                      className="text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors">
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button onClick={start} disabled={files.length === 0 || busy}
              className="btn btn-primary w-full mt-7 py-3.5 disabled:opacity-40 disabled:pointer-events-none">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        {busy ? "Dispatching agents…" : `Run verification${files.length ? ` on ${files.length} file(s)` : ""}`}
      </button>
    </div>
  );
}
