const PHONE_PATTERN = /^010-\d{4}-\d{4}$/;

function requiredText(form: FormData, name: string, label: string, max: number): string {
  const value = form.get(name);
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label}을(를) 입력해 주세요.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) throw new Error(`${label}은(는) ${max}자 이하로 입력해 주세요.`);
  return trimmed;
}

function optionalPhone(form: FormData): string | null {
  const value = form.get("phone");
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !PHONE_PATTERN.test(value.trim())) {
    throw new Error("연락처는 010-0000-0000 형식으로 입력해 주세요.");
  }
  return value.trim();
}

function triState(form: FormData, name: string): boolean | null {
  const value = form.get(name);
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

export function parseSubjectForm(form: FormData, currentYear = new Date().getFullYear()) {
  const name = requiredText(form, "name", "대상자 이름", 20);
  const birthYear = Number(form.get("birthYear"));
  if (!Number.isInteger(birthYear) || birthYear < currentYear - 120 || birthYear > currentYear - 65) {
    throw new Error("생년은 65세 이상 대상자의 네 자리 연도로 입력해 주세요.");
  }
  const airconStatus = form.get("airconStatus");
  const aircon = airconStatus === "normal"
    ? { hasAircon: true, airconBroken: false }
    : airconStatus === "issue"
      ? { hasAircon: false, airconBroken: true }
      : { hasAircon: null, airconBroken: false };

  return {
    name,
    birthYear,
    phone: optionalPhone(form),
    livesAlone: form.get("livesAlone") === "true",
    hasMobilityIssue: triState(form, "hasMobilityIssue"),
    hasChronicDisease: triState(form, "hasChronicDisease"),
    ...aircon,
    workerId: requiredText(form, "workerId", "담당자", 64),
    buildingId: requiredText(form, "buildingId", "주소", 64),
  };
}

export function parseWorkerForm(form: FormData) {
  return {
    name: requiredText(form, "name", "생활지원사 이름", 20),
    phone: optionalPhone(form),
  };
}
