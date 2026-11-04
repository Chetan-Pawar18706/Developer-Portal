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
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import {
  REQUIREMENT_PRIORITIES,
  REQUIREMENT_PRIORITY_LABELS,
  REQUIREMENT_TYPES,
  REQUIREMENT_TYPE_LABELS,
  type CreateRequirementRequest,
  type Requirement,
  type RequirementPriority,
  type RequirementType,
  type UpdateRequirementRequest,
} from '../../../core/models/requirement.model';
import { RequirementService } from '../../../core/services/requirement.service';
import { getErrorMessage } from '../../../shared/utils/http-error';
import { RequirementStore } from '../requirement.store';
import { RichTextEditorComponent } from '../rich-text-editor/rich-text-editor.component';

type FormMode = 'create' | 'edit';

interface RequirementDraft {
  title: string;
  description: string;
  acceptanceCriteria: string;
  priority: RequirementPriority;
  type: RequirementType;
  savedAt: string;
}

@Component({
  selector: 'app-requirement-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RichTextEditorComponent,
  ],
  templateUrl: './requirement-form.component.html',
  styleUrl: './requirement-form.component.scss',
})
export class RequirementFormComponent implements OnInit {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly store = inject(RequirementStore);
  private readonly requirementService = inject(RequirementService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly mode = signal<FormMode>('create');
  readonly projectId = signal('');
  readonly requirementId = signal('');
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly locked = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly draftRestored = signal(false);
  readonly autosaveAt = signal<string | null>(null);

  readonly priorities = REQUIREMENT_PRIORITIES;
  readonly priorityLabels = REQUIREMENT_PRIORITY_LABELS;
  readonly types = REQUIREMENT_TYPES;
  readonly typeLabels = REQUIREMENT_TYPE_LABELS;

  readonly title = computed(() =>
    this.mode() === 'edit' ? 'Edit requirement' : 'New requirement',
  );

  readonly form = this.formBuilder.group({
    title: this.formBuilder.control('', [
      Validators.required,
      Validators.minLength(3),
      Validators.maxLength(160),
    ]),
    description: this.formBuilder.control('', [Validators.required, Validators.maxLength(20_000)]),
    acceptanceCriteria: this.formBuilder.control('', [Validators.maxLength(20_000)]),
    priority: this.formBuilder.control<RequirementPriority>('should'),
    type: this.formBuilder.control<RequirementType>('functional'),
  });

  private loadedRequirement: Requirement | null = null;
  private formReady = false;
  private draftKey = '';

  constructor() {
    this.form.valueChanges
      .pipe(debounceTime(700), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.saveDraft());
  }

  ngOnInit(): void {
    const mode = this.route.snapshot.data['mode'] === 'edit' ? 'edit' : 'create';
    const projectId =
      this.route.snapshot.pathFromRoot
        .map((snapshot) => snapshot.paramMap.get('id'))
        .find((value): value is string => Boolean(value)) ?? '';
    const requirementId = this.route.snapshot.paramMap.get('requirementId') ?? '';

    this.mode.set(mode);
    this.projectId.set(projectId);
    this.requirementId.set(requirementId);
    this.draftKey = this.buildDraftKey(projectId, mode === 'edit' ? requirementId : 'new');

    if (mode === 'create') {
      this.restoreDraft();
      this.formReady = true;
      this.form.markAsPristine();
      return;
    }

    if (!requirementId) {
      this.serverError.set('Requirement not found.');
      return;
    }

    this.loadRequirement(requirementId);
  }

  submit(): void {
    if (!this.formReady || this.locked()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const acceptanceCriteria = value.acceptanceCriteria
      .split('\n')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    const description = value.description.trim();

    if (description.replace(/<[^>]*>/g, '').trim().length === 0) {
      this.serverError.set('Write a short requirement description.');
      return;
    }

    this.submitting.set(true);
    this.serverError.set(null);

    if (this.mode() === 'create') {
      const payload: CreateRequirementRequest = {
        title: value.title.trim(),
        description,
        acceptanceCriteria,
        priority: value.priority,
        type: value.type,
      };

      this.store.create(this.projectId(), payload).subscribe({
        next: (requirement) => this.handleSaved(requirement, 'Requirement created'),
        error: (error: unknown) => this.handleError(error),
      });
      return;
    }

    const payload: UpdateRequirementRequest = {
      title: value.title.trim(),
      description,
      acceptanceCriteria,
      priority: value.priority,
      type: value.type,
    };

    this.store.update(this.requirementId(), payload).subscribe({
      next: (requirement) => this.handleSaved(requirement, 'Requirement updated'),
      error: (error: unknown) => this.handleError(error),
    });
  }

  discardDraft(): void {
    this.removeDraft();
    this.draftRestored.set(false);
    this.autosaveAt.set(null);

    if (this.loadedRequirement) {
      this.patchForm(this.loadedRequirement);
      return;
    }

    this.form.reset({
      title: '',
      description: '',
      acceptanceCriteria: '',
      priority: 'should',
      type: 'functional',
    });
    this.form.markAsPristine();
  }

  private loadRequirement(requirementId: string): void {
    this.loading.set(true);

    this.requirementService
      .get(requirementId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (requirement) => {
          this.loadedRequirement = requirement;
          this.locked.set(requirement.status === 'approved');
          this.patchForm(requirement);
          this.loading.set(false);
          this.formReady = true;

          if (this.locked()) {
            this.form.disable();
            this.removeDraft();
          } else {
            this.restoreDraft();
          }
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.serverError.set(getErrorMessage(error, 'Unable to load this requirement.'));
        },
      });
  }

  private patchForm(requirement: Requirement): void {
    this.form.patchValue(
      {
        title: requirement.title,
        description: requirement.description,
        acceptanceCriteria: requirement.acceptanceCriteria.join('\n'),
        priority: requirement.priority,
        type: requirement.type,
      },
      { emitEvent: false },
    );
    this.form.markAsPristine();
  }

  private saveDraft(): void {
    if (!this.formReady || this.locked() || !this.draftKey || !this.form.dirty) {
      return;
    }

    const value = this.form.getRawValue();
    const draft: RequirementDraft = {
      title: value.title,
      description: value.description,
      acceptanceCriteria: value.acceptanceCriteria,
      priority: value.priority,
      type: value.type,
      savedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(this.draftKey, JSON.stringify(draft));
      this.autosaveAt.set(draft.savedAt);
    } catch {
      // A full or disabled local storage should not interrupt editing.
    }
  }

  private restoreDraft(): void {
    const draft = this.readDraft();

    if (!draft) {
      return;
    }

    this.form.patchValue(
      {
        title: draft.title,
        description: draft.description,
        acceptanceCriteria: draft.acceptanceCriteria,
        priority: draft.priority,
        type: draft.type,
      },
      { emitEvent: false },
    );
    this.draftRestored.set(true);
    this.autosaveAt.set(draft.savedAt);
    this.form.markAsPristine();
  }

  private readDraft(): RequirementDraft | null {
    try {
      const raw = localStorage.getItem(this.draftKey);

      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as Partial<RequirementDraft>;

      if (
        typeof parsed.title !== 'string' ||
        typeof parsed.description !== 'string' ||
        typeof parsed.acceptanceCriteria !== 'string' ||
        typeof parsed.priority !== 'string' ||
        typeof parsed.type !== 'string' ||
        typeof parsed.savedAt !== 'string'
      ) {
        return null;
      }

      return parsed as RequirementDraft;
    } catch {
      return null;
    }
  }

  private removeDraft(): void {
    try {
      localStorage.removeItem(this.draftKey);
    } catch {
      // Ignore unavailable local storage.
    }
  }

  private buildDraftKey(projectId: string, requirementId: string): string {
    return `devportal.requirement-draft:${projectId}:${requirementId}`;
  }

  private handleSaved(requirement: Requirement, message: string): void {
    this.submitting.set(false);
    this.removeDraft();
    this.snackBar.open(message, 'Dismiss', { duration: 3000 });
    this.router.navigate(['/projects', requirement.projectId, 'requirements', requirement.id]);
  }

  private handleError(error: unknown): void {
    this.submitting.set(false);
    this.serverError.set(
      getErrorMessage(error, 'Unable to save the requirement. Please try again.'),
    );
  }
}
