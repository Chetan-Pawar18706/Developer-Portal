import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { HttpErrorResponse } from '@angular/common/http';
import { ROLES, ROLE_LABELS, type Role, type User } from '../../../core/models/user.model';
import { getErrorMessage } from '../../../shared/utils/http-error';
import { UserAdminService } from '../services/user-admin.service';

@Component({
  selector: 'app-create-user-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>Create user</h2>

    <mat-dialog-content>
      <p class="dialog-subtitle">
        New accounts can sign in immediately. Share the password securely.
      </p>

      @if (serverError()) {
        <div class="form-error-banner" role="alert">
          <mat-icon>error_outline</mat-icon>
          <span>{{ serverError() }}</span>
        </div>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Full name</mat-label>
          <input matInput formControlName="name" autocomplete="off" placeholder="Alex Smith" />
          @if (form.controls.name.touched && form.controls.name.hasError('required')) {
            <mat-error>Full name is required.</mat-error>
          }
          @if (form.controls.name.touched && form.controls.name.hasError('minlength')) {
            <mat-error>Name must be at least 2 characters.</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Email address</mat-label>
          <input
            matInput
            type="email"
            formControlName="email"
            autocomplete="off"
            placeholder="alex@company.com"
          />
          @if (form.controls.email.touched && form.controls.email.hasError('required')) {
            <mat-error>Email address is required.</mat-error>
          }
          @if (form.controls.email.touched && form.controls.email.hasError('email')) {
            <mat-error>Enter a valid email address.</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Initial password</mat-label>
          <input
            matInput
            type="password"
            formControlName="password"
            autocomplete="new-password"
          />
          @if (form.controls.password.touched && form.controls.password.hasError('required')) {
            <mat-error>Password is required.</mat-error>
          }
          @if (form.controls.password.touched && form.controls.password.hasError('minlength')) {
            <mat-error>Password must be at least 8 characters.</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Role</mat-label>
          <mat-select formControlName="role">
            @for (role of roles; track role) {
              <mat-option [value]="role">{{ roleLabels[role] }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="cancel()">Cancel</button>
      <button mat-flat-button type="button" [disabled]="submitting()" (click)="submit()">
        @if (submitting()) {
          <mat-spinner diameter="18" />
        } @else {
          Create user
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content {
      min-width: min(26rem, 80vw);
      padding-top: 0.25rem;
    }

    .dialog-subtitle {
      margin: 0 0 1rem;
      color: var(--mat-sys-on-surface-variant);
      line-height: 1.5;
    }

    form {
      display: flex;
      flex-direction: column;
    }

    mat-dialog-actions {
      padding-bottom: 1rem;
    }
  `,
})
export class CreateUserDialogComponent {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly userAdmin = inject(UserAdminService);
  private readonly dialogRef = inject(MatDialogRef<CreateUserDialogComponent, User>);

  readonly roles = ROLES;
  readonly roleLabels = ROLE_LABELS;

  readonly form = this.formBuilder.group({
    name: this.formBuilder.control('', [
      Validators.required,
      Validators.minLength(2),
      Validators.maxLength(80),
    ]),
    email: this.formBuilder.control('', [Validators.required, Validators.email]),
    password: this.formBuilder.control('', [Validators.required, Validators.minLength(8)]),
    role: this.formBuilder.control<Role>('developer', { validators: [Validators.required] }),
  });

  readonly submitting = signal(false);
  readonly serverError = signal<string | null>(null);

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.serverError.set(null);

    this.userAdmin.create(this.form.getRawValue()).subscribe({
      next: (user) => {
        this.submitting.set(false);
        this.dialogRef.close(user);
      },
      error: (error: HttpErrorResponse) => {
        this.submitting.set(false);
        this.serverError.set(
          getErrorMessage(error, 'Unable to create the user. Please try again.'),
        );
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
