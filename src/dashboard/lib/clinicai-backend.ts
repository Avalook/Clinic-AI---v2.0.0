// Cầu sang lõi AI (FastAPI trên Vercel) — SERVER ONLY (route handlers / server
// actions). Giữ chìa khoá ở server, KHÔNG import vào client component.
//
// Backend gate mọi route (trừ /health) bằng header X-API-Key == BACKEND_API_KEY
// (xem src/clinicai/api/auth.py). Helper này tự gắn URL + chìa từ env:
//   CLINICAI_BACKEND_URL      — gốc backend (vd https://clinic-ai-v2-0-0.vercel.app)
//   CLINICAI_BACKEND_API_KEY  — chìa, gửi qua X-API-Key

export interface BackendResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  /** null khi ok; ngược lại là thông điệp gọn để hiển thị. */
  error: string | null;
}

/**
 * Gọi một endpoint của lõi AI. Tự thêm Content-Type + X-API-Key, không cache
 * (lõi AI là nguồn động). Trả kết quả đã bọc — không ném lỗi mạng ra ngoài.
 */
export async function callBackend<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<BackendResult<T>> {
  const base = process.env.CLINICAI_BACKEND_URL;
  const apiKey = process.env.CLINICAI_BACKEND_API_KEY;
  if (!base) {
    return { ok: false, status: 0, data: null, error: "CLINICAI_BACKEND_URL chưa cấu hình." };
  }

  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "X-API-Key": apiKey } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, status: 0, data: null, error: `Không gọi được lõi AI: ${String(e)}` };
  }

  let data: T | null = null;
  try {
    data = (await res.json()) as T;
  } catch {
    data = null;
  }

  return {
    ok: res.ok,
    status: res.status,
    data,
    error: res.ok ? null : `Lõi AI trả ${res.status}`,
  };
}
