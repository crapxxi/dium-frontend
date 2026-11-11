import { signal } from '@angular/core';

/**
 * Обратный отсчёт до повторной отправки кода (бэкенд разрешает отправку раз в 60 секунд).
 * Считает от реального времени, поэтому не «отстаёт», если вкладка была в фоне.
 */
export class ResendCountdown {
  /** Сколько секунд осталось; 0 — можно отправлять снова. */
  readonly seconds = signal(0);

  private timer: ReturnType<typeof setInterval> | null = null;

  start(durationSeconds = 60): void {
    this.stop();
    if (typeof window === 'undefined') return; // на сервере (SSR) таймеры не запускаем

    const endTime = Date.now() + durationSeconds * 1000;
    this.seconds.set(durationSeconds);

    this.timer = setInterval(() => {
      const remaining = Math.ceil((endTime - Date.now()) / 1000);
      if (remaining <= 0) {
        this.stop();
      } else {
        this.seconds.set(remaining);
      }
    }, 500);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.seconds.set(0);
  }
}
