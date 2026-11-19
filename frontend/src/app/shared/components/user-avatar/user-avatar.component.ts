import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { resolveAvatarUrl } from '../../utils/avatar-url';

type AvatarSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-user-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (showImage()) {
      <img
        class="avatar"
        [class.avatar-sm]="size() === 'sm'"
        [class.avatar-md]="size() === 'md'"
        [class.avatar-lg]="size() === 'lg'"
        [src]="resolvedAvatar()"
        [alt]="name()"
        (load)="failedAvatar.set(null)"
        (error)="failedAvatar.set(avatar())"
      />
    } @else {
      <span
        class="avatar avatar-fallback"
        [class.avatar-sm]="size() === 'sm'"
        [class.avatar-md]="size() === 'md'"
        [class.avatar-lg]="size() === 'lg'"
        [style.background]="color()"
        [attr.aria-label]="name()"
      >
        {{ initials() }}
      </span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
    }

    .avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      object-fit: cover;
      color: #fff;
      font-weight: 600;
      line-height: 1;
      background: var(--mat-sys-primary);
    }

    .avatar-sm {
      width: 2rem;
      height: 2rem;
      font-size: 0.75rem;
    }

    .avatar-md {
      width: 2.5rem;
      height: 2.5rem;
      font-size: 0.9rem;
    }

    .avatar-lg {
      width: 4rem;
      height: 4rem;
      font-size: 1.35rem;
    }
  `,
})
export class UserAvatarComponent {
  readonly name = input.required<string>();
  readonly avatar = input<string | null>(null);
  readonly size = input<AvatarSize>('md');

  readonly resolvedAvatar = computed(() => resolveAvatarUrl(this.avatar()));
  readonly failedAvatar = signal<string | null>(null);
  readonly showImage = computed(() => {
    const avatar = this.avatar();

    return !!avatar && this.failedAvatar() !== avatar;
  });

  readonly initials = computed(() => {
    const parts = this.name().trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
      return '?';
    }

    return parts
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  });

  readonly color = computed(() => {
    const seed = this.name()
      .split('')
      .reduce((accumulator, character) => accumulator + character.charCodeAt(0), 0);

    return `hsl(${seed % 360} 55% 42%)`;
  });
}
