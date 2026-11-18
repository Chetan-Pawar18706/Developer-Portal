import { Injectable, effect, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';

const STORAGE_PREFIX = 'developer-portal-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly auth = inject(AuthService);

  readonly dark = signal(this.readPreference(null));

  constructor() {
    effect(() => {
      const user = this.auth.currentUser();
      this.dark.set(user?.theme ? user.theme === 'dark' : this.readPreference(user?.id ?? null));
      this.apply();
    });
  }

  toggle(): void {
    const next = !this.dark();
    this.dark.set(next);
    this.apply();

    const user = this.auth.currentUser();
    this.cachePreference(user?.id ?? null, next);

    if (user) {
      this.auth.updateProfile({ theme: next ? 'dark' : 'light' }).subscribe({
        error: () => undefined,
      });
    }
  }

  private apply(): void {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.classList.toggle('dark-theme', this.dark());
  }

  private storageKey(userId: string | null): string {
    return userId ? `${STORAGE_PREFIX}:${userId}` : STORAGE_PREFIX;
  }

  private cachePreference(userId: string | null, dark: boolean): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(this.storageKey(userId), dark ? 'dark' : 'light');
    } catch {
      // Storage can be unavailable in private or restricted browsing contexts.
    }
  }

  private readPreference(userId: string | null): boolean {
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem(this.storageKey(userId));

        if (stored === 'dark') {
          return true;
        }

        if (stored === 'light') {
          return false;
        }
      } catch {
        // Fall through to the system preference when storage is unavailable.
      }
    }

    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  }
}
