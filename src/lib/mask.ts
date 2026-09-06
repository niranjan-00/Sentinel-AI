/**
 * SENTINEL AI — Sensitive Data Masking Service
 * --------------------------------------------
 * All sensitive data is masked BEFORE it is persisted for AI processing or sent
 * to any external AI provider. Raw PII never leaves the trust boundary.
 */

export type PiiType =
  | "EMAIL"
  | "CREDIT_CARD"
  | "PHONE"
  | "SSN"
  | "API_KEY"
  | "PASSWORD"
  | "IBAN"
  | "GOVERNMENT_ID"
  | "HEALTHCARE_ID";

export interface PiiFinding {
  type: PiiType;
  masked: string;
  count: number;
}

const PATTERNS: Array<{
  type: PiiType;
  regex: RegExp;
  mask: (m: RegExpExecArray) => string;
}> = [
  {
    type: "API_KEY",
    // sk-..., pk-..., ghp_..., github_pat_..., xoxb-..., AKIA..., AIza... (hyphens allowed inside)
    regex: /\b((?:sk|pk|rk)[-_][A-Za-z0-9][A-Za-z0-9-]{5,}|gh[pousr]_[A-Za-z0-9]{10,}|github_pat_[A-Za-z0-9_]{10,}|xox[abp]-[A-Za-z0-9-]{10,}|AKIA[A-Z0-9]{12,}|AIza[A-Za-z0-9_-]{20,})\b/g,
    mask: (m) => {
      const token = m[1];
      const prefix = token.slice(0, 3);
      return `${prefix}${"*".repeat(8)}${token.slice(-3)}`;
    },
  },
  {
    type: "SSN",
    regex: /\b(\d{3})-(\d{2})-(\d{4})\b/g,
    mask: (m) => `***-**-${m[3]}`,
  },
  {
    type: "IBAN",
    regex: /\b([A-Z]{2}\d{2})(?:[ ]?([A-Z0-9]{2,4})){2,8}\b/g,
    mask: (m) => `${m[1]}**********`,
  },
  {
    type: "CREDIT_CARD",
    regex: /\b((?:\d[ -]?){13,19})\b/g,
    mask: (m) => {
      const raw = m[1];
      const digits = raw.replace(/\D/g, "");
      if (digits.length < 13 || digits.length > 19) return raw;
      // preserve any trailing separator the regex consumed
      const trailing = /[ -]$/.test(raw) ? raw.slice(-1) : "";
      return `${digits.slice(0, 4)} **** **** ${digits.slice(-4)}${trailing}`;
    },
  },
  {
    type: "HEALTHCARE_ID",
    regex: /\b(?:MRN|Medical\s?Record)[:\s#]*([A-Za-z0-9]{6,12})\b/gi,
    mask: () => "MRN:*****",
  },
  {
    type: "GOVERNMENT_ID",
    regex: /\b(?:Passport|DL|Driver(?:'s)?\s?Licen[cs]e|Aadhaar|PAN)[:\s#No.]*([A-Za-z0-9-]{6,16})\b/gi,
    mask: () => "ID:******",
  },
  {
    type: "EMAIL",
    regex: /\b([A-Za-z0-9._%+-])([A-Za-z0-9._%+-]*?)@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})\b/g,
    mask: (m) => `${m[1]}***@${m[3]}`,
  },
  {
    type: "PHONE",
    regex: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g,
    mask: (m) => {
      const digits = m[0].replace(/\D/g, "");
      return `***-***-${digits.slice(-4)}`;
    },
  },
  {
    type: "PASSWORD",
    regex: /\b(password|passwd|pwd|secret|api[_-]?token|access[_-]?token)["']?\s*[:=]\s*["']?([^\s"',;]{4,})/gi,
    mask: (m) => `${m[1]}: "********"`,
  },
];

export interface MaskResult {
  masked: string;
  findings: PiiFinding[];
  totalMasked: number;
}

/**
 * Mask sensitive data in free text. Returns masked text + list of findings.
 * This is the ONLY representation of payload data that is ever sent to AI.
 */
export function maskSensitiveData(input: string): MaskResult {
  let masked = input;
  const findings: PiiFinding[] = [];

  for (const { type, regex, mask } of PATTERNS) {
    regex.lastIndex = 0;
    let count = 0;
    masked = masked.replace(regex, (...args) => {
      count += 1;
      // rebuild exec array for the custom mask fn
      const groups = args.slice(0, -2) as unknown[];
      return mask(groups as unknown as RegExpExecArray);
    });
    if (count > 0) {
      findings.push({ type, masked: maskPreview(type), count });
    }
  }
  return { masked, findings, totalMasked: findings.reduce((a, f) => a + f.count, 0) };
}

function maskPreview(type: PiiType): string {
  switch (type) {
    case "EMAIL": return "j***@example.com";
    case "CREDIT_CARD": return "4532 **** **** 9010";
    case "PHONE": return "***-***-4021";
    case "SSN": return "***-**-1234";
    case "API_KEY": return "sk-********789";
    case "PASSWORD": return 'password: "********"';
    case "IBAN": return "DE44**********";
    case "GOVERNMENT_ID": return "ID:******";
    case "HEALTHCARE_ID": return "MRN:*****";
  }
}

/** Mask an arbitrary JSON-serialisable object (deep), returning a safe payload. */
export function maskObject<T>(obj: T): { payload: T; findings: PiiFinding[] } {
  const { masked, findings } = maskSensitiveData(JSON.stringify(obj));
  try {
    return { payload: JSON.parse(masked) as T, findings };
  } catch {
    return { payload: "[unserializable payload — fully redacted]" as unknown as T, findings };
  }
}

/** Public actor label — never expose a raw username/identity in feeds. */
export function maskUserLabel(emailOrName: string): string {
  if (!emailOrName) return "masked_user_****";
  const [local, domain] = emailOrName.split("@");
  if (domain) return `${local[0]}***@${domain}`;
  return `${emailOrName.slice(0, 2)}***_${emailOrName.slice(-2)}`;
}

/** Fully anonymised label for suspicious actors. */
export function anonymizeActor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `masked_user_${String(h % 10000).padStart(4, "0")}`;
}

/** Mask an IP address, keeping the first two octets for geo-correlation only. */
export function maskIp(ip: string): string {
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.x.x`;
  if (ip.includes(":")) return `${ip.split(":").slice(0, 3).join(":")}:xxxx`;
  return "x.x.x.x";
}
