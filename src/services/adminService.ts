import { request, requestPage, type PageMeta } from "./apiClient";
import type { AdminArticle, AdminOverview, AdminUser, AuditEvent, FeedbackEntry, Role } from "@/types";

type ApiAdminUser = Omit<AdminUser, "role"> & { role: string };

const toUser = (u: ApiAdminUser): AdminUser => ({ ...u, role: u.role.toLowerCase() as Role });

export interface Paged<T> {
  items: T[];
  meta: PageMeta;
}

export interface ArticleInput {
  title: string;
  category: string;
  readMins: number;
  dek: string;
  body?: string;
  publish: boolean;
}

// Everything the administrator's screens call. The server enforces who may use
// each of these; the screens only hide what the person cannot do.
export const adminService = {
  overview: () => request<AdminOverview>("/admin/overview"),

  async users(query: { page: number; pageSize?: number; role?: "WOMAN" | "COACH" | "ADMIN"; search?: string }): Promise<Paged<AdminUser>> {
    const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize ?? 10) });
    if (query.role) params.set("role", query.role);
    if (query.search) params.set("search", query.search);
    const { items, meta } = await requestPage<ApiAdminUser>(`/admin/users?${params}`);
    return { items: items.map(toUser), meta };
  },
  setRole: (userId: string, role: "WOMAN" | "COACH") =>
    request(`/admin/users/${userId}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
  deactivate: (userId: string) => request(`/admin/users/${userId}`, { method: "DELETE" }),

  auditLog(page: number, action?: string): Promise<Paged<AuditEvent>> {
    const params = new URLSearchParams({ page: String(page), pageSize: "15" });
    if (action) params.set("action", action);
    return requestPage<AuditEvent>(`/admin/audit-log?${params}`);
  },
  feedback: (page: number): Promise<Paged<FeedbackEntry>> => requestPage<FeedbackEntry>(`/admin/feedback?page=${page}&pageSize=10`),

  articles: () => request<AdminArticle[]>("/learn"),
  createArticle: (input: ArticleInput) => request<AdminArticle>("/learn", { method: "POST", body: JSON.stringify(input) }),
  updateArticle: (id: string, input: Partial<ArticleInput>) =>
    request<AdminArticle>(`/learn/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteArticle: (id: string) => request(`/learn/${id}`, { method: "DELETE" }),
};
