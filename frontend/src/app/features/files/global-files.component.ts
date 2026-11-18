import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
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
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import {
  FILE_FOLDERS,
  FILE_FOLDER_LABELS,
  formatFileSize,
  isPreviewable,
  type FileFolder,
  type ProjectFile,
} from '../../core/models/file.model';
import { FileService } from '../../core/services/file.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import {
  FilePreviewDialogComponent,
  type FilePreviewDialogData,
} from './file-preview-dialog.component';

type FolderFilter = FileFolder | 'all';

@Component({
  selector: 'app-global-files',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTooltipModule,
    EmptyStateComponent,
    LoadingSkeletonComponent,
  ],
  templateUrl: './global-files.component.html',
  styleUrl: './global-files.component.scss',
})
export class GlobalFilesComponent implements OnInit {
  private readonly fileService = inject(FileService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly folders = FILE_FOLDERS;
  readonly folderLabels = FILE_FOLDER_LABELS;
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly folderControl = new FormControl<FolderFilter>('all', { nonNullable: true });

  readonly files = signal<ProjectFile[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly sizeLabel = formatFileSize;
  readonly previewable = isPreviewable;

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());

    this.folderControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());

    this.load();
  }

  load(): void {
    const folder = this.folderControl.value;
    this.loading.set(true);
    this.error.set('');

    this.fileService
      .listAll({
        folder: folder === 'all' ? undefined : folder,
        search: this.searchControl.value.trim() || undefined,
        limit: 100,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.files.set(result.data);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Unable to load files.');
          this.loading.set(false);
        },
      });
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
}
