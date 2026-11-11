import { HttpErrorResponse } from '@angular/common/http';

/**
 * Достаёт текст ошибки, который прислал бэкенд ({ status, message, timestamp }),
 * чтобы показать его пользователю как есть. Если сервер ничего внятного не вернул —
 * возвращает ключ перевода `fallbackKey`.
 *
 * Результат можно пропускать через pipe `translate`: для готового текста он вернёт сам текст.
 */
export function apiErrorMessage(err: unknown, fallbackKey: string): string {
  const response = err as HttpErrorResponse | undefined;

  // Нет соединения с сервером / CORS / сервер недоступен
  if (response?.status === 0) {
    return 'ERRORS.NETWORK';
  }

  const body: unknown = response?.error;

  if (body && typeof body === 'object') {
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
    // Ошибки валидации приходят как { поле: "текст" }
    const firstText = Object.values(body as Record<string, unknown>).find(
      (value) => typeof value === 'string' && value.trim(),
    );
    if (typeof firstText === 'string') {
      return firstText;
    }
  }

  return fallbackKey;
}
