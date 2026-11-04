import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule, type MatSelectionListChange } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
import { Router, RouterLink } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  PROJECT_PRIORITIES,
  PROJECT_PRIORITY_LABELS,
  type CreateProjectRequest,
  type ProjectMemberInput,
  type ProjectPriority,
} from '../../../core/models/project.model';
import { ROLE_LABELS } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth.service';
import {
  UserDirectoryService,
  type DirectoryUser,
} from '../../../core/services/user-directory.service';
import { UserAvatarComponent } from '../../../shared/components/user-avatar/user-avatar.component';
import { getErrorMessage } from '../../../shared/utils/http-error';
import { ProjectStore } from '../project.store';

function dateRangeValidator(group: AbstractControl): ValidationErrors | null {
  const startDate = group.get('startDate')?.value as string;
  const dueDate = group.get('dueDate')?.value as string;

  if (startDate && dueDate && new Date(dueDate) < new Date(startDate)) {
    return { dateRange: true };
  }

  return null;
}

@Component({
  selector: 'app-project-create',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
    CurrencyPipe,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatStepperModule,
    MatListModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    UserAvatarComponent,
  ],
  templateUrl: './project-create.component.html',
  styleUrl: './project-create.component.scss',
})
export class ProjectCreateComponent implements OnInit {
  @ViewChild(MatStepper) private stepper?: MatStepper;

  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly store = inject(ProjectStore);
  private readonly directory = inject(UserDirectoryService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  readonly priorities = PROJECT_PRIORITIES;
  readonly priorityLabels = PROJECT_PRIORITY_LABELS;
  readonly roleLabels = ROLE_LABELS;
  readonly directoryUsers = signal<readonly DirectoryUser[]>([]);
  readonly selectedMembers = signal<readonly string[]>([]);
  readonly submitting = signal(false);
  readonly serverError = signal<string | null>(null);

  readonly isStaff = computed(() => {
    const role = this.auth.role();
    return role === 'admin' || role === 'pm';
  });

  readonly clientOptions = computed(() =>
    this.directoryUsers().filter((user) => user.role === 'client'),
  );

  readonly memberOptions = computed(() => {
    const currentUserId = this.auth.currentUser()?.id;
    return this.directoryUsers().filter((user) => user.id !== currentUserId);
  });

  readonly form = this.formBuilder.group(
    {
      title: this.formBuilder.control('', [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(120),
      ]),
      description: this.formBuilder.control('', [
        Validators.required,
        Validators.minLength(10),
        Validators.maxLength(5000),
      ]),
      clientId: this.formBuilder.control(''),
      priority: this.formBuilder.control<ProjectPriority>('medium'),
      startDate: this.formBuilder.control(''),
      dueDate: this.formBuilder.control(''),
      budget: this.formBuilder.control(0, [Validators.min(0)]),
      tags: this.formBuilder.control(''),
    },
    { validators: dateRangeValidator },
  );

  ngOnInit(): void {
    if (this.isStaff()) {
      this.form.controls.clientId.addValidators(Validators.required);
      this.loadDirectory();
    }
  }

  onMembersChange(event: MatSelectionListChange): void {
    this.selectedMembers.set(
      event.source.selectedOptions.selected.map((option) => String(option.value)),
    );
  }

  tags(): string[] {
    return this.form.controls.tags.value
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }

  selectedMemberSummary(): ProjectMemberInput[] {
    return this.memberOptions()
      .filter((user) => this.selectedMembers().includes(user.id))
      .map((user) => ({ userId: user.id, role: user.role }));
  }

  selectedClientName(): string {
    const clientId = this.form.controls.clientId.value;
    return this.clientOptions().find((client) => client.id === clientId)?.name ?? 'Not selected';
  }

  memberName(userId: string): string {
    return this.memberOptions().find((user) => user.id === userId)?.name ?? 'Unknown user';
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      if (this.stepper) {
        this.stepper.selectedIndex = 0;
      }

      return;
    }

    const value = this.form.getRawValue();
    const payload: CreateProjectRequest = {
      title: value.title.trim(),
      description: value.description.trim(),
      priority: value.priority,
      members: this.selectedMemberSummary(),
      startDate: value.startDate ? new Date(value.startDate).toISOString() : null,
      dueDate: value.dueDate ? new Date(value.dueDate).toISOString() : null,
      tags: this.tags(),
      budget: Number(value.budget) || 0,
    };

    if (this.isStaff()) {
      payload.clientId = value.clientId;
    }

    this.submitting.set(true);
    this.serverError.set(null);

    this.store.create(payload).subscribe({
      next: (project) => {
        this.submitting.set(false);
        this.snackBar.open('Project created', 'Dismiss', { duration: 3000 });
        this.router.navigate(['/projects', project.id, 'overview']);
      },
      error: (error: HttpErrorResponse) => {
        this.submitting.set(false);
        this.serverError.set(
          getErrorMessage(error, 'Unable to create the project. Please try again.'),
        );
      },
    });
  }

  private loadDirectory(): void {
    this.directory.lookup(['pm', 'developer', 'client']).subscribe({
      next: (users) => this.directoryUsers.set(users),
      error: () => this.directoryUsers.set([]),
    });
  }
}
