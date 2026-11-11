/**
 * Приводит казахстанский номер к виду 7XXXXXXXXXX (так же, как PhoneNormalizer на бэкенде).
 * Принимает +7 (707) 123-45-67, 8 707 123 45 67, 77071234567, 7071234567.
 * Возвращает null, если номер некорректный.
 */
export function normalizeKzPhone(rawPhone: string | null | undefined): string | null {
  let digits = (rawPhone || '').replace(/\D/g, '');

  if (digits.length === 11 && digits.startsWith('8')) {
    digits = '7' + digits.substring(1);
  } else if (digits.length === 10) {
    digits = '7' + digits;
  }

  return /^7\d{10}$/.test(digits) ? digits : null;
}

/** 77071234567 → +7 707 123 45 67 (только для отображения). */
export function formatKzPhone(phone: string | null | undefined): string {
  const normalized = normalizeKzPhone(phone);
  if (!normalized) return phone || '';
  return `+7 ${normalized.slice(1, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7, 9)} ${normalized.slice(9, 11)}`;
}
