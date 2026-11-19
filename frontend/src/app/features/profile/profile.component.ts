import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
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
import { ProfileService } from '../../core/services/profile.service';
import type { UpdateProfileRequest } from '../../core/models/user.model';
import { UserAvatarComponent } from '../../shared/components/user-avatar/user-avatar.component';
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
    UserAvatarComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly profiles = inject(ProfileService);

  readonly saving = signal(false);
  readonly avatarUploading = signal(false);
  readonly saved = signal(false);
  readonly error = signal<string | null>(null);
  readonly avatarUrl = computed(() => this.auth.currentUser()?.avatar ?? null);

  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(80)],
    }),
    jobTitle: new FormControl<string | null>(null),
    company: new FormControl<string | null>(null),
    location: new FormControl<string | null>(null),
    bio: new FormControl<string | null>(null, { validators: [Validators.maxLength(1000)] }),
    skills: new FormControl('', { nonNullable: true }),
    website: new FormControl<string | null>(null),
    github: new FormControl<string | null>(null),
    linkedin: new FormControl<string | null>(null),
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
      jobTitle: user.jobTitle,
      company: user.company,
      location: user.location,
      bio: user.bio,
      skills: user.skills.join(', '),
      website: user.website,
      github: user.github,
      linkedin: user.linkedin,
      notificationPrefs: { ...user.notificationPrefs },
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: UpdateProfileRequest = {
      name: raw.name,
      jobTitle: raw.jobTitle,
      company: raw.company,
      location: raw.location,
      bio: raw.bio,
      skills: raw.skills
        .split(',')
        .map((skill) => skill.trim())
        .filter((skill) => skill.length > 0),
      website: raw.website,
      github: raw.github,
      linkedin: raw.linkedin,
      notificationPrefs: raw.notificationPrefs,
    };

    this.saving.set(true);
    this.saved.set(false);
    this.error.set(null);

    this.auth.updateProfile(payload).subscribe({
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

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
      this.error.set('Profile picture must be a PNG or JPEG image.');
      input.value = '';
      return;
    }

    this.avatarUploading.set(true);
    this.saved.set(false);
    this.error.set(null);

    this.profiles.uploadAvatar(file).subscribe({
      next: () => {
        this.avatarUploading.set(false);
        this.saved.set(true);
        input.value = '';
      },
      error: (error: unknown) => {
        this.avatarUploading.set(false);
        this.error.set(getErrorMessage(error, 'Unable to upload your profile picture.'));
        input.value = '';
      },
    });
  }
}
