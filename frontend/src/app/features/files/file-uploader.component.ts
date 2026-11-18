import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  ALLOWED_FILE_EXTENSIONS,
  ALLOWED_FILE_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  type FileFolder,
  type FileLink,
  type ProjectFile,
} from '../../core/models/file.model';
import { FileService } from '../../core/services/file.service';

interface UploadRow {
  id: number;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error: string;
}

const ACCEPTED_TYPES = [...ALLOWED_FILE_EXTENSIONS, ...ALLOWED_FILE_MIME_TYPES].join(',');

@Component({
  selector: 'app-file-uploader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  templateUrl: './file-uploader.component.html',
  styleUrl: './file-uploader.component.scss',
})
export class FileUploaderComponent {
  readonly projectId = input.required<string>();
  readonly folder = input<FileFolder>('other');
  readonly allowInternal = input(false);
  readonly title = input('Upload files');
  readonly uploaded = output<FileLink>();

  private readonly fileService = inject(FileService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fileInput =
    viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly acceptedTypes = ACCEPTED_TYPES;
  readonly rows = signal<UploadRow[]>([]);
  readonly internal = signal(false);
  readonly dragging = signal(false);
  private nextId = 1;

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    this.addFiles([...(event.dataTransfer?.files ?? [])]);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.addFiles([...(input.files ?? [])]);
    input.value = '';
  }

  uploadAll(): void {
    for (const row of this.rows().filter((item) => item.status === 'pending' || item.status === 'error')) {
      this.uploadRow(row);
    }
  }

  remove(rowId: number): void {
    this.rows.update((rows) => rows.filter((row) => row.id !== rowId));
  }

  clearCompleted(): void {
    this.rows.update((rows) => rows.filter((row) => row.status === 'uploading'));
  }

  private addFiles(files: readonly File[]): void {
    const accepted: UploadRow[] = [];

    for (const file of files) {
      const error = this.validate(file);

      accepted.push({
        id: this.nextId++,
        file,
        progress: 0,
        status: error ? 'error' : 'pending',
        error,
      });
    }

    this.rows.update((rows) => [...rows, ...accepted]);
  }

  private validate(file: File): string {
    const name = file.name.toLowerCase();
    const hasAllowedExtension = ALLOWED_FILE_EXTENSIONS.some((extension) =>
      name.endsWith(extension),
    );
    const hasAllowedMime = (ALLOWED_FILE_MIME_TYPES as readonly string[]).includes(
      file.type.toLowerCase(),
    );

    if (!hasAllowedExtension) {
      return 'Unsupported file type';
    }

    if (!hasAllowedMime) {
      return 'Unsupported MIME type';
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return 'File is larger than 25 MB';
    }

    return '';
  }

  private uploadRow(row: UploadRow): void {
    this.updateRow(row.id, { status: 'uploading', progress: 0, error: '' });

    this.fileService
      .upload(this.projectId(), row.file, this.folder(), this.allowInternal() && this.internal())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (event) => {
          if (event.kind === 'progress') {
            this.updateRow(row.id, { progress: event.progress });
            return;
          }

          this.updateRow(row.id, { status: 'done', progress: 100 });
          this.uploaded.emit({
            id: event.file.id,
            name: event.file.originalName,
            mimeType: event.file.mimeType,
            size: event.file.size,
            version: event.file.version,
            isInternal: event.file.isInternal,
          });
        },
        error: (error: unknown) => {
          const message =
            typeof error === 'object' &&
            error !== null &&
            'error' in error &&
            typeof error.error === 'object' &&
            error.error !== null &&
            'message' in error.error
              ? String(error.error.message)
              : 'Upload failed';

          this.updateRow(row.id, { status: 'error', error: message });
        },
      });
  }

  private updateRow(
    rowId: number,
    changes: Partial<Pick<UploadRow, 'status' | 'progress' | 'error'>>,
  ): void {
    this.rows.update((rows) =>
      rows.map((row) => (row.id === rowId ? { ...row, ...changes } : row)),
    );
  }
}

export function toFileLink(file: ProjectFile): FileLink {
  return {
    id: file.id,
    name: file.originalName,
    mimeType: file.mimeType,
    size: file.size,
    version: file.version,
    isInternal: file.isInternal,
  };
}
