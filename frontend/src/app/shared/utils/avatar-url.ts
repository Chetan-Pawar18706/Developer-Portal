import { environment } from '../../../environments/environment';

export function resolveAvatarUrl(avatar: string | null | undefined): string | null {
  if (!avatar) {
    return null;
  }

  return avatar.startsWith('/api/') ? `${environment.apiUrl}${avatar.slice(4)}` : avatar;
}
