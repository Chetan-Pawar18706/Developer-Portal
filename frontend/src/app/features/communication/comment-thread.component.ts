import { DatePipe } from '@angular/common';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute } from '@angular/router';
import { interval } from 'rxjs';
import type {
  Comment,
  CommentEntityType,
  CreateCommentRequest,
} from '../../core/models/comment.model';
import type { ProjectMember, ProjectUserSummary } from '../../core/models/project.model';
import { AuthService } from '../../core/services/auth.service';
import { CommentService } from '../../core/services/comment.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { UserAvatarComponent } from '../../shared/components/user-avatar/user-avatar.component';
import { ConfirmDialogService } from '../../shared/services/confirm-dialog.service';
import { getErrorMessage } from '../../shared/utils/http-error';

const POLL_INTERVAL_MS = 30_000;
const QUICK_REACTIONS = ['👍', '❤️', '🎉', '👀', '🚀'] as const;

interface MentionToken {
  start: number;
  end: number;
  query: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCommentText(value: string): string {
  return escapeHtml(value)
    .replace(
      /@\[([^\]]+)\]\(([a-f\d]{24})\)/gi,
      '<span class="comment-mention">@$1</span>',
    )
    .replace(/\n/g, '<br>');
}

function currentMentionToken(value: string, caret: number): MentionToken | null {
  const match = /@([^\s@[\]]*)$/.exec(value.slice(0, caret));

  if (!match) {
    return null;
  }

  return {
    start: caret - match[0].length,
    end: caret,
    query: match[1],
  };
}

function findComment(nodes: readonly Comment[], id: string): Comment | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }

    const nested = findComment(node.replies, id);

    if (nested) {
      return nested;
    }
  }

  return null;
}

@Component({
  selector: 'app-comment-thread',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    NgTemplateOutlet,
    MatAutocompleteModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    EmptyStateComponent,
    UserAvatarComponent,
  ],
  templateUrl: './comment-thread.component.html',
  styleUrl: './comment-thread.component.scss',
})
export class CommentThreadComponent {
  readonly entityType = input.required<CommentEntityType>();
  readonly entityId = input.required<string>();
  readonly projectId = input('');
  readonly members = input<readonly ProjectMember[]>([]);

  private readonly commentService = inject(CommentService);
  private readonly auth = inject(AuthService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly composerInput = viewChild<ElementRef<HTMLTextAreaElement>>('composerInput');

  private readonly routeProjectId =
    this.route.snapshot.pathFromRoot
      .map((snapshot) => snapshot.paramMap.get('id'))
      .find((value): value is string => Boolean(value)) ?? '';
  private loadedKey = '';

  readonly comments = signal<readonly Comment[]>([]);
  readonly loading = signal(false);
  readonly posting = signal(false);
  readonly busyId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly draft = signal('');
  readonly caret = signal(0);
  readonly replyTo = signal<string | null>(null);
  readonly internalNote = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly editDraft = signal('');
  readonly quickReactions = QUICK_REACTIONS;

  readonly resolvedProjectId = computed(() => this.projectId() || this.routeProjectId);
  readonly canUseInternal = computed(() => this.auth.isStaff());
  readonly canDeleteAny = computed(() => this.auth.role() === 'admin');
  readonly currentUserId = computed(() => this.auth.currentUser()?.id ?? '');

  readonly mentionToken = computed(() =>
    currentMentionToken(this.draft(), this.caret()),
  );
  readonly mentionCandidates = computed(() => {
    const token = this.mentionToken();

    if (!token) {
      return [];
    }

    const query = token.query.trim().toLowerCase();

    return this.members()
      .filter((member) => {
        if (!query) {
          return true;
        }

        return (
          member.user.name.toLowerCase().includes(query) ||
          member.user.email.toLowerCase().includes(query)
        );
      })
      .slice(0, 6);
  });
  readonly canPost = computed(() => this.draft().trim().length > 0 && !this.posting());
  readonly replyTarget = computed(() => {
    const replyTo = this.replyTo();
    return replyTo ? findComment(this.comments(), replyTo) : null;
  });

  constructor() {
    effect(() => {
      const key = `${this.entityType()}:${this.entityId()}:${this.resolvedProjectId()}`;

      if (this.entityId() && this.resolvedProjectId() && key !== this.loadedKey) {
        this.loadedKey = key;
        this.resetComposer();
        this.load();
      }
    });

    interval(POLL_INTERVAL_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (this.entityId() && this.resolvedProjectId()) {
          this.load(true);
        }
      });
  }

  renderCommentText(value: string): string {
    return formatCommentText(value);
  }

  toggleInternal(): void {
    this.internalNote.set(!this.internalNote());
  }

  load(silent = false): void {
    if (!silent) {
      this.loading.set(true);
      this.error.set(null);
    }

    this.commentService
      .list(this.entityType(), this.entityId(), { page: 1, limit: 100 })
      .subscribe({
        next: (result) => {
          this.comments.set(result.data);
          this.loading.set(false);
          this.error.set(null);
        },
        error: (error: unknown) => {
          this.loading.set(false);

          if (!silent) {
            this.error.set(getErrorMessage(error, 'Unable to load the discussion.'));
          }
        },
      });
  }

  onDraftInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.draft.set(textarea.value);
    this.caret.set(textarea.selectionStart ?? textarea.value.length);
  }

  onCaretMove(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.caret.set(textarea.selectionStart ?? textarea.value.length);
  }

  insertMention(member: ProjectUserSummary): void {
    const token = this.mentionToken();

    if (!token) {
      return;
    }

    const insertion = `@[${member.name}](${member.id}) `;
    const value = this.draft();
    const next = `${value.slice(0, token.start)}${insertion}${value.slice(token.end)}`;
    const nextCaret = token.start + insertion.length;

    this.draft.set(next);
    this.caret.set(nextCaret);

    queueMicrotask(() => {
      const textarea = this.composerInput()?.nativeElement;

      if (!textarea) {
        return;
      }

      textarea.focus();
      textarea.setSelectionRange(nextCaret, nextCaret);
    });
  }

  startReply(comment: Comment): void {
    this.replyTo.set(comment.id);
    this.editingId.set(null);
    this.internalNote.set(false);
    queueMicrotask(() => this.composerInput()?.nativeElement.focus());
  }

  cancelReply(): void {
    this.replyTo.set(null);
  }

  startEdit(comment: Comment): void {
    this.editingId.set(comment.id);
    this.editDraft.set(comment.text);
    this.replyTo.set(null);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editDraft.set('');
  }

  saveEdit(commentId: string): void {
    const text = this.editDraft().trim();

    if (!text) {
      return;
    }

    this.busyId.set(commentId);
    this.commentService.update(commentId, { text }).subscribe({
      next: () => {
        this.busyId.set(null);
        this.cancelEdit();
        this.load();
      },
      error: (error: unknown) => {
        this.busyId.set(null);
        this.error.set(getErrorMessage(error, 'Unable to update the comment.'));
      },
    });
  }

  removeComment(comment: Comment): void {
    this.confirmDialog
      .confirm({
        title: 'Delete comment?',
        message:
          comment.replies.length > 0
            ? 'This comment and all of its replies will be permanently removed.'
            : 'This comment will be permanently removed.',
        confirmLabel: 'Delete comment',
        tone: 'warn',
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.busyId.set(comment.id);
        this.commentService.delete(comment.id).subscribe({
          next: () => {
            this.busyId.set(null);
            this.load();
          },
          error: (error: unknown) => {
            this.busyId.set(null);
            this.error.set(getErrorMessage(error, 'Unable to delete the comment.'));
          },
        });
      });
  }

  react(commentId: string, emoji: string): void {
    this.busyId.set(commentId);
    this.commentService.react(commentId, { emoji }).subscribe({
      next: (updated) => {
        this.busyId.set(null);
        this.replaceComment(updated);
      },
      error: (error: unknown) => {
        this.busyId.set(null);
        this.error.set(getErrorMessage(error, 'Unable to save the reaction.'));
      },
    });
  }

  isReacted(users: readonly { id: string }[]): boolean {
    return users.some((user) => user.id === this.currentUserId());
  }

  submit(): void {
    const text = this.draft().trim();

    if (!text || this.posting()) {
      return;
    }

    const parent = this.replyTo();
    const request: CreateCommentRequest = {
      entityType: this.entityType(),
      entityId: this.entityId(),
      text,
      parent,
      isInternal: this.internalNote() && this.canUseInternal(),
    };

    this.posting.set(true);
    this.error.set(null);

    this.commentService.create(request).subscribe({
      next: () => {
        this.posting.set(false);
        this.resetComposer();
        this.load();
      },
      error: (error: unknown) => {
        this.posting.set(false);
        this.error.set(getErrorMessage(error, 'Unable to post the comment.'));
      },
    });
  }

  private resetComposer(): void {
    this.draft.set('');
    this.caret.set(0);
    this.replyTo.set(null);
    this.internalNote.set(false);
    this.editingId.set(null);
    this.editDraft.set('');
  }

  private replaceComment(updated: Comment): void {
    const replace = (nodes: readonly Comment[]): Comment[] =>
      nodes.map((node) =>
        node.id === updated.id
          ? updated
          : { ...node, replies: replace(node.replies) },
      );

    this.comments.set(replace(this.comments()));
  }
}
