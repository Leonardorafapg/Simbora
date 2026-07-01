const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export type LeadPayload = {
  name: string;
  email: string;
  phone?: string;
  companyName?: string;
  segment?: string;
  revenueRange?: string;
  specialty?: string;
  source: "site" | "medicos";
};

export async function submitLead(data: LeadPayload): Promise<void> {
  const payload = {
    name: data.name,
    email: data.email,
    phone: data.phone || "00000000000",
    company_name: data.companyName,
    segment: data.segment,
    revenue_range: data.revenueRange,
    specialty: data.specialty,
    source: data.source,
  };

  const res = await fetch(`${API_BASE}/api/v1/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let errorDetail = "Erro ao enviar formulário.";
    try {
      const errorData = await res.json();
      errorDetail = errorData.detail ?? errorDetail;
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }
}
