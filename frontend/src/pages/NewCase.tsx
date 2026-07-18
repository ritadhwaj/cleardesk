import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { createCase, uploadFiles, runCase } from "../api/client";

export default function NewCase() {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => setFiles((prev) => [...prev, ...accepted]),
  });

  const start = async () => {
    setBusy(true);
    const { id } = await createCase();
    await uploadFiles(id, files);
    await runCase(id);
    navigate(`/cases/${id}`);
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">New verification case</h1>
      <div {...getRootProps()}
           className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
                       ${isDragActive ? "border-slate-800 bg-slate-100" : "border-slate-300"}`}>
        <input {...getInputProps()} />
        <p className="text-slate-600">
          Drop customer documents here — PDFs, scans, photos. Any order, any mess.
        </p>
      </div>
      <ul className="mt-4 space-y-1">
        {files.map((f) => (
          <li key={f.name} className="text-sm text-slate-600 bg-white rounded-lg p-2 shadow-sm">
            {f.name}
          </li>
        ))}
      </ul>
      <button onClick={start} disabled={files.length === 0 || busy}
              className="mt-6 bg-slate-800 text-white px-6 py-3 rounded-lg disabled:opacity-40">
        {busy ? "Starting agents…" : "Run verification"}
      </button>
    </div>
  );
}
