import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

export interface RequirementReviewDialogData {
  title: string;
  message: string;
  confirmLabel: string;
  placeholder: string;
}

@Component({
  selector: 'app-requirement-review-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>

    <mat-dialog-content>
      <p class="dialog-message">{{ data.message }}</p>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Review note</mat-label>
        <textarea
          matInput
          [formControl]="note"
          rows="4"
          [placeholder]="data.placeholder"
        ></textarea>
        <mat-hint align="end">{{ note.value.length }} / 2000</mat-hint>
        @if (note.touched && note.hasError('required')) {
          <mat-error>A note is required for this action.</mat-error>
        }
      </mat-form-field>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="cancel()">Cancel</button>
      <button mat-flat-button type="button" (click)="confirm()">
        <mat-icon>send</mat-icon>
        {{ data.confirmLabel }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .dialog-message {
      margin: 0 0 1rem;
      color: var(--mat-sys-on-surface-variant);
      line-height: 1.5;
    }

    .full-width {
      width: 100%;
      min-width: min(30rem, 75vw);
    }
  `,
})
export class RequirementReviewDialogComponent {
  readonly data = inject<RequirementReviewDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<RequirementReviewDialogComponent, string>);

  readonly note = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(2000)],
  });

  cancel(): void {
    this.dialogRef.close();
  }

  confirm(): void {
    if (this.note.invalid) {
      this.note.markAsTouched();
      return;
    }

    this.dialogRef.close(this.note.value.trim());
  }
}
