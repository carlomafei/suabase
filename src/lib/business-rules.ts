/**
 * Regras de Negócio — Utility Functions
 */

// 1. Normalização de CPF/CNPJ (frontend mirror do trigger DB)
export const normalizeCpfCnpj = (value: string): string =>
  value.replace(/[^0-9]/g, "");

export const formatCpf = (raw: string): string => {
  const d = normalizeCpfCnpj(raw);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return d;
};

export const isValidCpf = (raw: string): boolean => {
  const d = normalizeCpfCnpj(raw);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (slice: number) => {
    let sum = 0;
    for (let i = 0; i < slice; i++) sum += parseInt(d[i]) * (slice + 1 - i);
    const rem = (sum * 10) % 11;
    return rem === 10 ? 0 : rem;
  };
  return calc(9) === parseInt(d[9]) && calc(10) === parseInt(d[10]);
};

// 2. Deduplicação — check antes de inserir
export const buildDeduplicationKey = (tenantId: string, cpfCnpj: string): string =>
  `${tenantId}:${normalizeCpfCnpj(cpfCnpj)}`;

// 3. Idempotência Bling — gera chave única
export const buildBlingIdempotencyKey = (tenantId: string, blingId: string): string =>
  `${tenantId}:bling:${blingId}`;

// 4. Janela de 24h WhatsApp
export const isWithin24hWindow = (lastInboundAt: string | null): boolean => {
  if (!lastInboundAt) return false;
  const diff = Date.now() - new Date(lastInboundAt).getTime();
  return diff < 24 * 60 * 60 * 1000;
};

// 5. Quality score labels
export const getQualityLabel = (score: number): { label: string; color: string } => {
  if (score >= 80) return { label: "Excelente", color: "text-emerald-400" };
  if (score >= 60) return { label: "Bom", color: "text-primary" };
  if (score >= 40) return { label: "Regular", color: "text-amber-400" };
  return { label: "Incompleto", color: "text-destructive" };
};

// 6. Opt-out channels
export type OptOutChannels = {
  whatsapp: boolean;
  email: boolean;
  sms: boolean;
};

export const canSendToChannel = (
  channel: "whatsapp" | "email" | "sms",
  optOut: OptOutChannels
): boolean => !optOut[channel];

// 7. Source audit display
export const SOURCE_LABELS: Record<string, string> = {
  bling: "Bling ERP",
  manual: "Manual",
  whatsapp: "WhatsApp",
  import: "Importação CSV",
  api: "API",
};

export const getSourceLabel = (source: string | null): string =>
  source ? SOURCE_LABELS[source] || source : "Desconhecido";
