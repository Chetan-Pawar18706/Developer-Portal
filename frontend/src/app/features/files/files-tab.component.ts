import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute } from '@angular/router';
import { debounceTime, distinctUntilChanged, filter, map } from 'rxjs';
import {
  FILE_FOLDERS,
  FILE_FOLDER_LABELS,
  formatFileSize,
  isPreviewable,
  type FileFolder,
  type ProjectFile,
} from '../../core/models/file.model';
import { AuthService } from '../../core/services/auth.service';
import { FileService } from '../../core/services/file.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import { FileUploaderComponent } from './file-uploader.component';
import {
  FilePreviewDialogComponent,
  type FilePreviewDialogData,
} from './file-preview-dialog.component';

type FolderFilter = FileFolder | 'all';
type ViewMode = 'grid' | 'list';

@Component({
  selector: 'app-files-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    EmptyStateComponent,
    LoadingSkeletonComponent,
    FileUploaderComponent,
  ],
  templateUrl: './files-tab.component.html',
  styleUrl: './files-tab.component.scss',
})
export class FilesTabComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly fileService = inject(FileService);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly versionInput = viewChild<ElementRef<HTMLInputElement>>('versionInput');

  readonly folders = FILE_FOLDERS;
  readonly folderLabels = FILE_FOLDER_LABELS;
  readonly isStaff = this.auth.isStaff;
  readonly currentUserId = this.auth.currentUser;
  readonly searchControl = new FormControl('', { nonNullable: true });

  readonly projectId = signal('');
  readonly files = signal<ProjectFile[]>([]);
  readonly loading = signal(true);
  readonly folder = signal<FolderFilter>('all');
  readonly view = signal<ViewMode>('grid');
  readonly selected = signal<ProjectFile | null>(null);
  readonly uploadingVersion = signal(false);
  readonly sizeLabel = formatFileSize;
  readonly previewable = isPreviewable;

  ngOnInit(): void {
    this.route.parent?.paramMap
      .pipe(
        map((params) => params.get('id') ?? ''),
        filter((id) => id.length > 0),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => {
        this.projectId.set(id);
        this.load();
      });

    this.searchControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
  }

  setFolder(folder: FolderFilter): void {
    this.folder.set(folder);
    this.load();
  }

  setView(view: ViewMode): void {
    this.view.set(view);
  }

  uploadFolder(): FileFolder {
    const folder = this.folder();
    return folder === 'all' ? 'other' : folder;
  }

  select(file: ProjectFile): void {
    this.selected.update((current) => (current?.id === file.id ? null : file));
  }

  load(): void {
    const projectId = this.projectId();

    if (!projectId) {
      return;
    }

    const folder = this.folder();
    this.loading.set(true);
    this.fileService
      .list(projectId, {
        folder: folder === 'all' ? undefined : folder,
        search: this.searchControl.value.trim() || undefined,
        limit: 100,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.files.set(result.data);
          const selected = this.selected();
          if (selected) {
            const refreshed = result.data.find((file) => file.id === selected.id) ?? null;
            this.selected.set(refreshed);
          }
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  canDelete(file: ProjectFile): boolean {
    return this.isStaff() || file.uploadedBy?.id === this.currentUserId()?.id;
  }

  preview(file: ProjectFile): void {
    if (!isPreviewable(file.mimeType)) {
      return;
    }

    const data: FilePreviewDialogData = {
      id: file.id,
      name: file.originalName,
      mimeType: file.mimeType,
    };
    this.dialog.open(FilePreviewDialogComponent, { data, maxWidth: '95vw' });
  }

  download(file: ProjectFile): void {
    this.fileService
      .download(file.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.originalName;
        link.click();
        URL.revokeObjectURL(url);
      });
  }

  delete(file: ProjectFile): void {
    if (!this.canDelete(file) || !window.confirm(`Delete ${file.originalName}?`)) {
      return;
    }

    this.fileService
      .delete(file.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.selected()?.id === file.id) {
          this.selected.set(null);
        }
        this.load();
      });
  }

  addVersion(file: ProjectFile, event?: Event): void {
    const input = (event?.target as HTMLInputElement | null) ?? this.versionInput()?.nativeElement;
    const versionFile = input?.files?.[0];

    if (!versionFile) {
      return;
    }

    this.uploadingVersion.set(true);
    this.fileService
      .addVersion(file.id, versionFile)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.uploadingVersion.set(false);
          this.selected.set(updated);
          if (input) {
            input.value = '';
          }
          this.load();
        },
        error: () => this.uploadingVersion.set(false),
      });
  }
}
