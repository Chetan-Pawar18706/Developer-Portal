import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ROLES, ROLE_LABELS, type Role } from '../../../core/models/user.model';
import {
  UserDirectoryService,
  type DirectoryUser,
} from '../../../core/services/user-directory.service';

export interface AddMemberDialogData {
  existingUserIds: string[];
}

export interface AddMemberDialogResult {
  userId: string;
  role: Role;
}

@Component({
  selector: 'app-add-member-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>Add team member</h2>

    <mat-dialog-content>
      <p class="dialog-subtitle">
        Add a colleague to this project. Their workspace role sets the default project role.
      </p>

      <form [formGroup]="form" (ngSubmit)="submit()" class="dialog-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Person</mat-label>
          <mat-select formControlName="userId" (selectionChange)="onUserChange($event.value)">
            @for (user of availableUsers(); track user.id) {
              <mat-option [value]="user.id">
                {{ user.name }} · {{ roleLabels[user.role] }}
              </mat-option>
            }
          </mat-select>
          @if (form.controls.userId.touched && form.controls.userId.hasError('required')) {
            <mat-error>Select a person to add.</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Project role</mat-label>
          <mat-select formControlName="role">
            @for (role of roles; track role) {
              <mat-option [value]="role">{{ roleLabels[role] }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (availableUsers().length === 0) {
          <p class="empty-note">Everyone matching your filters is already on this project.</p>
        }
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="cancel()">Cancel</button>
      <button mat-flat-button type="button" [disabled]="form.invalid" (click)="submit()">
        Add member
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content {
      min-width: min(25rem, 84vw);
      padding-top: 0.25rem;
    }

    .dialog-subtitle {
      margin: 0 0 1rem;
      color: var(--mat-sys-on-surface-variant);
      line-height: 1.5;
    }

    .dialog-form {
      display: flex;
      flex-direction: column;
    }

    .empty-note {
      margin: 0.5rem 0 0;
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.85rem;
    }

    mat-dialog-actions {
      padding-bottom: 1rem;
    }
  `,
})
export class AddMemberDialogComponent implements OnInit {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly directory = inject(UserDirectoryService);
  private readonly dialogRef = inject(
    MatDialogRef<AddMemberDialogComponent, AddMemberDialogResult>,
  );
  private readonly data = inject<AddMemberDialogData>(MAT_DIALOG_DATA);

  readonly roles = ROLES;
  readonly roleLabels = ROLE_LABELS;
  readonly users = signal<readonly DirectoryUser[]>([]);

  readonly form = this.formBuilder.group({
    userId: this.formBuilder.control('', [Validators.required]),
    role: this.formBuilder.control<Role>('developer', [Validators.required]),
  });

  readonly availableUsers = signal<readonly DirectoryUser[]>([]);

  ngOnInit(): void {
    this.directory.lookup(['pm', 'developer', 'client']).subscribe({
      next: (users) => {
        const existing = new Set(this.data.existingUserIds);
        const available = users.filter((user) => !existing.has(user.id));
        this.users.set(available);
        this.availableUsers.set(available);
      },
      error: () => this.availableUsers.set([]),
    });
  }

  onUserChange(userId: string): void {
    const user = this.users().find((candidate) => candidate.id === userId);

    if (user) {
      this.form.controls.role.setValue(user.role);
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.dialogRef.close({ userId: value.userId, role: value.role });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
