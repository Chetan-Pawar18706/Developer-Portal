import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'developer-portal-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly dark = signal(this.readInitialPreference());

  constructor() {
    this.apply();
  }

  toggle(): void {
    this.dark.update((value) => !value);
    this.apply();
  }

  private apply(): void {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.classList.toggle('dark-theme', this.dark());

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, this.dark() ? 'dark' : 'light');
    }
  }

  private readInitialPreference(): boolean {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (stored === 'dark') {
        return true;
      }

      if (stored === 'light') {
        return false;
      }
    }

    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  }
}
