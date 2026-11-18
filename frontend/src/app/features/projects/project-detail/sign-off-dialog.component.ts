import { A11yModule } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type { SignOffInput } from '../../../core/models/project.model';

@Component({
  selector: 'app-sign-off-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    A11yModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>Sign off delivery</h2>

    <mat-dialog-content>
      <p class="dialog-subtitle">
        Completing the project records your acceptance of the delivered work. This action closes
        the active phase.
      </p>

      <form [formGroup]="form" (ngSubmit)="submit()" class="dialog-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Rating</mat-label>
          <mat-select formControlName="rating" cdkFocusInitial aria-label="Delivery rating">
            @for (rating of ratings; track rating.value) {
              <mat-option [value]="rating.value">{{ rating.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Feedback</mat-label>
          <textarea
            matInput
            formControlName="feedback"
            rows="3"
            maxlength="2000"
            placeholder="What went well? Anything to improve?"
            aria-label="Delivery feedback"
          ></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Note for the delivery team</mat-label>
          <textarea
            matInput
            formControlName="note"
            rows="2"
            maxlength="1000"
            placeholder="Optional handover note"
            aria-label="Note for the delivery team"
          ></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="cancel()">Cancel</button>
      <button mat-flat-button type="button" [disabled]="form.invalid" (click)="submit()">
        Sign off & complete
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content {
      min-width: min(27rem, 86vw);
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

    mat-dialog-actions {
      padding-bottom: 1rem;
    }
  `,
})
export class SignOffDialogComponent {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly dialogRef = inject(
    MatDialogRef<SignOffDialogComponent, SignOffInput>,
  );

  readonly ratings = [
    { value: 5, label: '5 · Excellent' },
    { value: 4, label: '4 · Good' },
    { value: 3, label: '3 · Satisfactory' },
    { value: 2, label: '2 · Needs improvement' },
    { value: 1, label: '1 · Poor' },
  ] as const;

  readonly form = this.formBuilder.group({
    rating: this.formBuilder.control<number>(5, [
      Validators.required,
      Validators.min(1),
      Validators.max(5),
    ]),
    feedback: this.formBuilder.control(''),
    note: this.formBuilder.control(''),
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.dialogRef.close({
      rating: value.rating,
      feedback: value.feedback.trim(),
      note: value.note.trim(),
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
