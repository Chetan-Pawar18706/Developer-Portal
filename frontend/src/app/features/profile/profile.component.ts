import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { AuthService } from '../../core/services/auth.service';
import { getErrorMessage } from '../../shared/utils/http-error';

interface PreferenceControls {
  emailOnAssignment: FormControl<boolean>;
  emailOnMention: FormControl<boolean>;
  emailOnStatusChange: FormControl<boolean>;
  emailOnReminder: FormControl<boolean>;
}

@Component({
  selector: 'app-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSlideToggleModule,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private readonly auth = inject(AuthService);

  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(80)],
    }),
    notificationPrefs: new FormGroup<PreferenceControls>({
      emailOnAssignment: new FormControl(true, { nonNullable: true }),
      emailOnMention: new FormControl(true, { nonNullable: true }),
      emailOnStatusChange: new FormControl(true, { nonNullable: true }),
      emailOnReminder: new FormControl(true, { nonNullable: true }),
    }),
  });

  ngOnInit(): void {
    const user = this.auth.currentUser();

    if (!user) {
      return;
    }

    this.form.patchValue({
      name: user.name,
      notificationPrefs: { ...user.notificationPrefs },
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.saved.set(false);
    this.error.set(null);

    this.auth.updateProfile(this.form.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.set(true);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(getErrorMessage(error, 'Unable to update your profile.'));
      },
    });
  }
}
