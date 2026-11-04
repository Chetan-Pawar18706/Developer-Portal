import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  REQUIREMENT_PRIORITIES,
  REQUIREMENT_PRIORITY_LABELS,
  REQUIREMENT_TYPES,
  REQUIREMENT_TYPE_LABELS,
  type CreateChangeRequestRequest,
  type Requirement,
  type RequirementPriority,
  type RequirementType,
} from '../../core/models/requirement.model';

export interface ChangeRequestDialogData {
  requirement: Requirement;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function textToHtml(value: string): string {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');
}

@Component({
  selector: 'app-change-request-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title>Raise a change request</h2>

    <mat-dialog-content>
      <p class="dialog-message">
        Create a new draft requirement linked to <strong>{{ data.requirement.title }}</strong
        >. The approved requirement stays untouched for audit purposes.
      </p>

      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Change request title</mat-label>
          <input matInput formControlName="title" />
          @if (form.controls.title.touched && form.controls.title.hasError('required')) {
            <mat-error>A title is required.</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>What needs to change?</mat-label>
          <textarea
            matInput
            formControlName="summary"
            rows="5"
            placeholder="Describe the new or changed behaviour and why it is needed."
          ></textarea>
          @if (form.controls.summary.touched && form.controls.summary.hasError('required')) {
            <mat-error>Describe the requested change.</mat-error>
          }
        </mat-form-field>

        <div class="field-row">
          <mat-form-field appearance="outline">
            <mat-label>Priority</mat-label>
            <mat-select formControlName="priority">
              @for (priority of priorities; track priority) {
                <mat-option [value]="priority">{{ priorityLabels[priority] }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Type</mat-label>
            <mat-select formControlName="type">
              @for (type of types; track type) {
                <mat-option [value]="type">{{ typeLabels[type] }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="cancel()">Cancel</button>
      <button mat-flat-button type="button" (click)="confirm()">
        <mat-icon>alt_route</mat-icon>
        Create change request
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .dialog-message {
      margin: 0 0 1rem;
      color: var(--mat-sys-on-surface-variant);
      line-height: 1.5;
    }

    .dialog-form {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .full-width {
      width: 100%;
      min-width: min(32rem, 78vw);
    }

    .field-row {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.85rem;
    }

    @media (max-width: 34rem) {
      .field-row {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class ChangeRequestDialogComponent {
  readonly data = inject<ChangeRequestDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(
    MatDialogRef<ChangeRequestDialogComponent, CreateChangeRequestRequest>,
  );
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly priorities = REQUIREMENT_PRIORITIES;
  readonly priorityLabels = REQUIREMENT_PRIORITY_LABELS;
  readonly types = REQUIREMENT_TYPES;
  readonly typeLabels = REQUIREMENT_TYPE_LABELS;

  readonly form = this.formBuilder.group({
    title: this.formBuilder.control(
      `Change request: ${this.data.requirement.title}`.slice(0, 160),
      [Validators.required, Validators.minLength(3), Validators.maxLength(160)],
    ),
    summary: this.formBuilder.control('', [Validators.required, Validators.maxLength(5_000)]),
    priority: this.formBuilder.control<RequirementPriority>(this.data.requirement.priority),
    type: this.formBuilder.control<RequirementType>(this.data.requirement.type),
  });

  cancel(): void {
    this.dialogRef.close();
  }

  confirm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    this.dialogRef.close({
      title: value.title.trim(),
      description: textToHtml(value.summary),
      priority: value.priority,
      type: value.type,
    });
  }
}
