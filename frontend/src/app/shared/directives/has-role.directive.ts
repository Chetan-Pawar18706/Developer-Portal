import {
  Directive,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
  input,
} from '@angular/core';
import type { Role } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';

@Directive({
  selector: '[appHasRole]',
})
export class HasRoleDirective {
  private readonly templateRef = inject<TemplateRef<unknown>>(TemplateRef);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly auth = inject(AuthService);

  readonly appHasRole = input.required<Role | readonly Role[]>();

  constructor() {
    effect(() => {
      const allowedRoles = this.normalizeRoles(this.appHasRole());
      const currentRole = this.auth.role();
      const visible = currentRole !== null && allowedRoles.includes(currentRole);

      this.viewContainer.clear();

      if (visible) {
        this.viewContainer.createEmbeddedView(this.templateRef);
      }
    });
  }

  private normalizeRoles(roles: Role | readonly Role[]): readonly Role[] {
    return typeof roles === 'string' ? [roles] : roles;
  }
}
