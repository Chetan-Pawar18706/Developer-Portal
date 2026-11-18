import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import {
  ISSUE_SEVERITIES,
  ISSUE_SEVERITY_LABELS,
  ISSUE_TYPES,
  ISSUE_TYPE_LABELS,
  type Issue,
  type IssueSeverity,
  type IssueType,
} from '../../core/models/issue.model';
import type { FileLink } from '../../core/models/file.model';
import { AuthService } from '../../core/services/auth.service';
import { FileUploaderComponent } from '../files/file-uploader.component';
import { getErrorMessage } from '../../shared/utils/http-error';
import { IssueStore } from './issue.store';

export interface IssueCreateDialogData {
  projectId: string;
}

@Component({
  selector: 'app-issue-create-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    FileUploaderComponent,
  ],
  template: `
    <h2 mat-dialog-title>Raise an issue</h2>

    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-dialog-content class="dialog-content">
        <p class="dialog-intro">
          Tell the delivery team what is blocking you. It will be assigned to the project manager.
        </p>

        @if (error(); as message) {
          <div class="error-banner" role="alert">
            <mat-icon>error_outline</mat-icon>
            <span>{{ message }}</span>
          </div>
        }

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Title</mat-label>
          <input matInput formControlName="title" maxlength="160" />
          @if (form.controls.title.hasError('required')) {
            <mat-error>A title is required.</mat-error>
          } @else if (form.controls.title.hasError('minlength')) {
            <mat-error>Use at least 3 characters.</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Description</mat-label>
          <textarea
            matInput
            formControlName="description"
            rows="5"
            maxlength="20000"
          ></textarea>
          @if (form.controls.description.hasError('required')) {
            <mat-error>A description is required.</mat-error>
          } @else if (form.controls.description.hasError('minlength')) {
            <mat-error>Use at least 10 characters.</mat-error>
          }
        </mat-form-field>

        <div class="field-row">
          <mat-form-field appearance="outline">
            <mat-label>Type</mat-label>
            <mat-select formControlName="type">
              @for (type of types; track type) {
                <mat-option [value]="type">{{ typeLabels[type] }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Severity</mat-label>
            <mat-select formControlName="severity">
              @for (severity of severities; track severity) {
                <mat-option [value]="severity">{{ severityLabels[severity] }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Steps to reproduce</mat-label>
          <textarea
            matInput
            formControlName="stepsToReproduce"
            rows="4"
            maxlength="10000"
            placeholder="1. Open the page&#10;2. Click the button&#10;3. See the error"
          ></textarea>
          <mat-hint>Optional, but especially useful for bugs.</mat-hint>
        </mat-form-field>

        <app-file-uploader
          [projectId]="data.projectId"
          folder="other"
          [allowInternal]="isStaff()"
          title="Attach screenshots or logs"
          (uploaded)="onFileUploaded($event)"
        />
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close [disabled]="saving()">Cancel</button>
        <button mat-flat-button type="submit" [disabled]="saving()">
          @if (saving()) {
            <mat-spinner diameter="18" />
          } @else {
            <mat-icon>flag</mat-icon>
          }
          Raise issue
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .dialog-content {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      min-width: min(36rem, 90vw);
      padding-top: 0.5rem;
    }

    .dialog-intro {
      margin: 0 0 0.5rem;
      color: var(--mat-sys-on-surface-variant);
      line-height: 1.5;
    }

    .field-row {
      display: flex;
      gap: 1rem;

      mat-form-field {
        flex: 1;
      }
    }

    .full-width {
      width: 100%;
    }

    .error-banner {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 0.75rem;
      border: 1px solid var(--status-blocked-border);
      border-radius: 0.6rem;
      background: var(--status-blocked-bg);
      color: var(--status-blocked);
    }

    mat-dialog-actions button mat-spinner {
      display: inline-block;
      margin-right: 0.4rem;
    }

    @media (max-width: 34rem) {
      .field-row {
        flex-direction: column;
        gap: 0;
      }
    }
  `,
})
export class IssueCreateDialogComponent {
  private readonly data = inject<IssueCreateDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<IssueCreateDialogComponent, Issue | undefined>);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly issueStore = inject(IssueStore);
  private readonly auth = inject(AuthService);

  readonly types = ISSUE_TYPES;
  readonly typeLabels = ISSUE_TYPE_LABELS;
  readonly severities = ISSUE_SEVERITIES;
  readonly severityLabels = ISSUE_SEVERITY_LABELS;

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly attachedFileIds = signal<string[]>([]);
  readonly isStaff = this.auth.isStaff;

  readonly form = this.formBuilder.group({
    title: this.formBuilder.control('', {
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(160)],
    }),
    description: this.formBuilder.control('', {
      validators: [Validators.required, Validators.minLength(10), Validators.maxLength(20_000)],
    }),
    type: this.formBuilder.control<IssueType>('bug', {
      validators: [Validators.required],
    }),
    severity: this.formBuilder.control<IssueSeverity>('medium', {
      validators: [Validators.required],
    }),
    stepsToReproduce: this.formBuilder.control('', {
      validators: [Validators.maxLength(10_000)],
    }),
  });

  onFileUploaded(file: FileLink): void {
    this.attachedFileIds.update((ids) => [...ids, file.id]);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);

    this.issueStore
      .create(this.data.projectId, {
        title: value.title.trim(),
        description: value.description.trim(),
        type: value.type,
        severity: value.severity,
        stepsToReproduce: value.stepsToReproduce.trim(),
        attachments: [],
        fileIds: this.attachedFileIds(),
      })
      .subscribe({
        next: (issue) => {
          this.saving.set(false);
          this.dialogRef.close(issue);
        },
        error: (error: unknown) => {
          this.error.set(getErrorMessage(error, 'Unable to raise this issue.'));
          this.saving.set(false);
        },
      });
  }
}
