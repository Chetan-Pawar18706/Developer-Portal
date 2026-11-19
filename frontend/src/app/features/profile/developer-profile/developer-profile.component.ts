import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { catchError, filter, map, of, switchMap } from 'rxjs';
import {
  ROLE_LABELS,
  socialProfileUrl,
  type DeveloperProfile,
} from '../../../core/models/user.model';
import { ProfileService } from '../../../core/services/profile.service';
import { UserAvatarComponent } from '../../../shared/components/user-avatar/user-avatar.component';
import { getErrorMessage } from '../../../shared/utils/http-error';

@Component({
  selector: 'app-developer-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatProgressBarModule,
    UserAvatarComponent,
  ],
  templateUrl: './developer-profile.component.html',
  styleUrl: './developer-profile.component.scss',
})
export class DeveloperProfileComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly profiles = inject(ProfileService);
  private readonly destroyRef = inject(DestroyRef);

  readonly profile = signal<DeveloperProfile | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly roleLabels = ROLE_LABELS;
  readonly joinedAt = computed(() => this.profile()?.createdAt ?? null);
  readonly githubUrl = computed(() => {
    const github = this.profile()?.github;
    return github ? socialProfileUrl('github', github) : null;
  });
  readonly linkedinUrl = computed(() => {
    const linkedin = this.profile()?.linkedin;
    return linkedin ? socialProfileUrl('linkedin', linkedin) : null;
  });

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        filter((id): id is string => id !== null),
        switchMap((id) => {
          this.loading.set(true);
          this.error.set(null);

          return this.profiles.getDeveloper(id).pipe(
            catchError((error: unknown) => {
              this.error.set(getErrorMessage(error, 'Unable to load this profile.'));
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((profile) => {
        this.loading.set(false);
        this.profile.set(profile);
      });
  }
}
