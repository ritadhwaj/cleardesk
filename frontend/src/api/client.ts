import axios from "axios";
import { useAuth } from "../store/auth";

export const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((config) => {
  const token = useAuth.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ---- typed helpers ----
export interface CaseSummary {
  id: string; ref_no: string; name: string; status: string; created_at: string;
}
export interface RunAudit {
  run_no: number; trigger: string; note: string | null;
  started_at: string | null; finished_at: string | null;
  scorecard_version: number | null;
  field_diff: {
    added: { field: string; value: string }[];
    updated: { field: string; old: string; new: string }[];
    deleted: { field: string; old: string }[];
  } | null;
}
export interface Scorecard {
  version: number; overall_score: number; doc_scores: Record<string, number>;
  summary: string; auto_verified: number; review_needed: number; hard_fail: number;
}
export interface AgentEvent {
  id: number; agent: string; type: string; payload: Record<string, unknown>; at: string;
}

export const listCases = (status?: string) =>
  api.get<CaseSummary[]>("/cases", { params: { status } }).then((r) => r.data);
export const createCase = () => api.post<{ id: string }>("/cases").then((r) => r.data);
export const uploadFiles = (caseId: string, files: File[]) => {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  return api.post(`/cases/${caseId}/uploads`, form);
};
export const runCase = (caseId: string) => api.post(`/cases/${caseId}/run`);
export const getCase = (caseId: string) => api.get(`/cases/${caseId}`).then((r) => r.data);
export const getScorecard = (caseId: string) =>
  api.get<Scorecard>(`/cases/${caseId}/scorecard`).then((r) => r.data);
export const postReviewAction = (caseId: string, body: object) =>
  api.post(`/reviews/${caseId}/actions`, body);
export const getEvents = (caseId: string, after = 0) =>
  api.get<AgentEvent[]>(`/cases/${caseId}/events`, { params: { after } }).then((r) => r.data);
export const deleteUpload = (caseId: string, uploadId: string) =>
  api.delete(`/cases/${caseId}/uploads/${uploadId}`);
export const resubmitCase = (caseId: string, note: string) =>
  api.post(`/cases/${caseId}/resubmit`, { note });
export const exportCase = async (caseId: string, format: "xlsx" | "pdf") => {
  const r = await api.get(`/cases/${caseId}/export`, {
    params: { format }, responseType: "blob",
  });
  const cd: string = r.headers["content-disposition"] ?? "";
  const name = cd.match(/filename="(.+?)"/)?.[1] ?? `case_scorecard.${format}`;
  const url = URL.createObjectURL(r.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};
