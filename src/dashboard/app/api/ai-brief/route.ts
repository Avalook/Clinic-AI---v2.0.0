// /api/ai-brief
//   POST { clinic_patient_id } → { markdown, elapsed_ms } | { error }
//
// Cầu sang LÕI AI: gọi backend POST /api/v1/brief/{id} qua callBackend (tự gắn
// header X-API-Key). AI đọc dữ liệu BN trong DB → tóm tắt tiền khám cho bác sĩ.
// CHỈ ĐỌC, không ghi hồ sơ. Gate: phải có session phòng khám + đã chọn role.

import { NextResponse } from "next/server";
import { getSupabaseServer } from "../../../lib/supabase-server";
import { getClinicRole } from "../../../lib/clinic-session";
import { callBackend } from "../../../lib/clinicai-backend";

interface BriefBackend {
  markdown: string;
  elapsed_ms: number;
}

export async function POST(request: Request) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const role = await getClinicRole();
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { clinic_patient_id?: string };
  try {
    body = (await request.json()) as { clinic_patient_id?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = (body.clinic_patient_id ?? "").trim();
  if (!id) return NextResponse.json({ error: "Thiếu id bệnh nhân." }, { status: 400 });

  const res = await callBackend<BriefBackend>(`/api/v1/brief/${id}`, { method: "POST" });
  if (!res.ok || !res.data) {
    // 404 = BN chưa có trong lõi AI; 502 = LLM lỗi; 0 = không gọi được backend.
    const status = res.status >= 400 ? res.status : 502;
    const detail =
      res.status === 404
        ? "Bệnh nhân chưa có dữ liệu trong lõi AI (chưa đồng bộ)."
        : (res.error ?? "Lõi AI không tạo được brief.");
    return NextResponse.json({ error: detail }, { status });
  }
  return NextResponse.json({ markdown: res.data.markdown, elapsed_ms: res.data.elapsed_ms });
}
