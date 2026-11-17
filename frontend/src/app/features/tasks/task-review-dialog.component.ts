import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface TaskReviewDialogData {
  taskTitle: string;
}

@Component({
  selector: 'app-task-review-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>Request changes</h2>

    <mat-dialog-content>
      <p class="dialog-message">
        Tell the delivery team what needs to change on <strong>{{ data.taskTitle }}</strong>.
      </p>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Review note</mat-label>
        <textarea
          matInput
          rows="5"
          [formControl]="note"
          placeholder="Explain what is missing or needs adjustment"
        ></textarea>
        <mat-hint align="end">{{ note.value.length }}/2000</mat-hint>
        @if (note.hasError('required')) {
          <mat-error>A review note is required.</mat-error>
        }
        @if (note.hasError('minlength')) {
          <mat-error>Add at least 5 characters so the team has clear guidance.</mat-error>
        }
        @if (note.hasError('maxlength')) {
          <mat-error>Keep the note under 2000 characters.</mat-error>
        }
      </mat-form-field>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
      <button
        mat-flat-button
        type="button"
        [disabled]="note.invalid"
        (click)="submit()"
      >
        Send request
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .dialog-message {
      margin: 0 0 1rem;
      color: var(--mat-sys-on-surface-variant);
    }

    .full-width {
      width: 100%;
    }

    textarea {
      resize: vertical;
    }
  `,
})
export class TaskReviewDialogComponent {
  readonly data = inject<TaskReviewDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<TaskReviewDialogComponent, string>);

  readonly note = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(5), Validators.maxLength(2000)],
  });

  submit(): void {
    if (this.note.invalid) {
      this.note.markAsTouched();
      return;
    }

    this.dialogRef.close(this.note.value.trim());
  }
}
