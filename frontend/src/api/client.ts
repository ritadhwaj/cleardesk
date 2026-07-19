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
  id: string; ref_no: string; name: string; status: string;
  created_by: string; updated_by: string;
  created_at: string; updated_at: string;
}

import { useTimezone } from "../store/timezone";

/** Render a backend timestamp (stored in IST) as dd-MMM-yyyy HH:mm:ss GMT±x in
 *  the user's selected display timezone. Naive strings are treated as IST. */
export const fmtDateTime = (iso: string) => {
  if (!iso) return "—";
  const hasZone = iso.endsWith("Z") || /[+-]\d\d:?\d\d$/.test(iso);
  const d = new Date(hasZone ? iso : iso + "+05:30");   // stored value is IST
  const tz = useTimezone.getState().tz;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    timeZoneName: "shortOffset",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}-${get("month")}-${get("year")} `
       + `${get("hour")}:${get("minute")}:${get("second")} ${get("timeZoneName")}`;
};
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

export interface TableQuery {
  page: number; page_size: number; sort: string; order: "asc" | "desc";
  filters: Record<string, string>;
}
export interface Paged<T> { items: T[]; total: number; stats?: Record<string, number> }

export interface ActivityItem {
  id: number; when: string; category: string; action: string;
  details: string; user: string; case: string | null; case_id: string | null;
}

export const listCases = (q: Partial<TableQuery> & { status?: string } = {}) =>
  api.get<Paged<CaseSummary>>("/cases", {
    params: { page: q.page ?? 1, page_size: q.page_size ?? 10,
              sort: q.sort ?? "created_at", order: q.order ?? "desc",
              status: q.filters?.status ?? q.status,
              q: q.filters?.name, created_by: q.filters?.created_by,
              updated_by: q.filters?.updated_by },
  }).then((r) => r.data);

export const getMyActivity = (q: TableQuery) =>
  api.get<Paged<ActivityItem>>("/activity/me", {
    params: { page: q.page, page_size: q.page_size, sort: q.sort, order: q.order,
              category: q.filters.category, action: q.filters.action,
              q: q.filters.details },
  }).then((r) => r.data);

export const getCaseActivity = (caseId: string, q: TableQuery) =>
  api.get<Paged<ActivityItem>>(`/activity/cases/${caseId}`, {
    params: { page: q.page, page_size: q.page_size, sort: q.sort, order: q.order,
              category: q.filters.category, action: q.filters.action,
              q: q.filters.details },
  }).then((r) => r.data);

const downloadBlobResponse = (r: { data: Blob; headers: Record<string, string> },
                              fallback: string) => {
  const cd: string = r.headers["content-disposition"] ?? "";
  const name = cd.match(/filename="(.+?)"/)?.[1] ?? fallback;
  const url = URL.createObjectURL(r.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportMyActivity = async (format: "xlsx" | "pdf") => {
  const r = await api.get("/activity/me/export", { params: { format }, responseType: "blob" });
  downloadBlobResponse(r, `activity_log.${format}`);
};

export interface Insights {
  status: string; sla_hours: number; total: number; on_time: number; overdue: number;
  pivot: { process: string; on_time: number; overdue: number }[];
  cases: { id: string; ref_no: string; name: string; process: string;
           created_at: string; actioned_at: string | null; overdue: boolean }[];
}
export const getInsights = (status: string) =>
  api.get<Insights>("/cases/insights", { params: { status } }).then((r) => r.data);

export const exportCaseActivity = async (caseId: string, format: "xlsx" | "pdf") => {
  const r = await api.get(`/activity/cases/${caseId}/export`,
    { params: { format }, responseType: "blob" });
  downloadBlobResponse(r, `activity_log.${format}`);
};
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
