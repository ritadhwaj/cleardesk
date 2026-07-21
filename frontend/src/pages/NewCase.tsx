import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import {
  UploadCloud, FileText, X, Loader2, Sparkles, ArrowLeft, Check, Circle,
  ShieldCheck, Home, Car, Wallet, Briefcase, CreditCard, Landmark, Lock,
  BookOpen, RefreshCw, Repeat, Receipt, Smartphone, UserCheck,
} from "lucide-react";
import { createCase, uploadFiles, runCase, getTemplates, type Template } from "../api/client";

const ICON: Record<string, typeof Home> = {
  KYC: ShieldCheck, KYC_PARTIAL: UserCheck, LOAN: Home, CAR_LOAN: Car,
  PERSONAL_LOAN: Wallet, BUSINESS_LOAN: Briefcase, CREDIT_CARD: CreditCard,
  DEBIT_CARD: CreditCard, NEW_ACCOUNT: Landmark, LOCKER: Lock, FASTAG: Car,
  CHEQUE_BOOK: BookOpen, DORMANT_REACT: RefreshCw, NACH_SI: Repeat,
  PASSBOOK: BookOpen, TAX: Receipt, MOBILE_BANKING: Smartphone,
};

export default function NewCase() {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [picked, setPicked] = useState<Template | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { getTemplates().then(setTemplates).catch(() => setTemplates([])); }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => setFiles((prev) => [...prev, ...accepted]),
  });
  const removeFile = (name: string) => setFiles((f) => f.filter((x) => x.name !== name));

  const start = async () => {
    if (!picked) return;
    setBusy(true);
    try {
      const { id } = await createCase(picked.code);
      await uploadFiles(id, files);
      await runCase(id);
      navigate(`/cases/${id}`);
    } finally {
      setBusy(false);
    }
  };

  // ---- step 1: choose a template ----
  if (!picked) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10 animate-fade-up">
        <h1 className="text-2xl font-bold tracking-tight h-page">New verification case</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-8">
          Choose the bank service — each has its own document checklist.
        </p>
        {templates === null ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-28" />)}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((t, i) => {
              const Icon = ICON[t.code] ?? FileText;
              return (
                <button key={t.code} onClick={() => setPicked(t)}
                        className="card card-hover p-5 text-left animate-fade-up"
                        style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
                  <div className="flex items-start gap-3">
                    <span className="w-10 h-10 rounded-xl chip-indigo flex items-center justify-center shrink-0">
                      <Icon size={19} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-slate-100 leading-tight">{t.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {t.description}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-2">
                        <span className="text-red-500 font-semibold">{t.mandatory} required</span>
                        {t.optional > 0 && <> · {t.optional} optional</>}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ---- step 2: checklist + upload ----
  const Icon = ICON[picked.code] ?? FileText;
  return (
    <div className="max-w-5xl mx-auto px-6 py-10 animate-fade-up">
      <button onClick={() => setPicked(null)}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800
                         dark:hover:text-slate-200 mb-4 transition-colors">
        <ArrowLeft size={15} /> Change service
      </button>
      <div className="flex items-center gap-3 mb-6">
        <span className="w-11 h-11 rounded-xl chip-indigo flex items-center justify-center">
          <Icon size={21} />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight h-page">{picked.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{picked.description}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-[minmax(0,320px)_1fr] gap-5">
        {/* left: checklist */}
        <div className="card p-5 h-fit">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Document checklist
          </h2>
          <ul className="space-y-2">
            {picked.docs.map((d) => (
              <li key={d.code} className="flex items-center gap-2.5 text-sm">
                {d.mandatory
                  ? <Check size={15} className="text-red-500 shrink-0" />
                  : <Circle size={13} className="text-slate-300 dark:text-slate-600 shrink-0" />}
                <span className="text-slate-700 dark:text-slate-200">{d.name}</span>
                {d.mandatory
                  ? <span className="ml-auto text-[10px] font-bold text-red-500 uppercase">required</span>
                  : <span className="ml-auto text-[10px] text-slate-400 uppercase">optional</span>}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
            Upload what you have — the agents verify each document and the case
            gets a completeness score against this checklist.
          </p>
        </div>

        {/* right: upload */}
        <div>
          <div {...getRootProps()}
               className={`rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer
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
            <ul className="mt-4 space-y-2">
              {files.map((f, i) => (
                <li key={f.name}
                    className="card card-hover flex items-center gap-3 px-4 py-3 animate-fade-up"
                    style={{ animationDelay: `${i * 40}ms` }}>
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
                  className="btn btn-primary w-full mt-6 py-3.5 disabled:opacity-40 disabled:pointer-events-none">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {busy ? "Dispatching agents…" : `Run verification${files.length ? ` on ${files.length} file(s)` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
