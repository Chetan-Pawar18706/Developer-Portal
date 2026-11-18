import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { isPreviewable } from '../../core/models/file.model';
import { FileService } from '../../core/services/file.service';

export interface FilePreviewDialogData {
  id: string;
  name: string;
  mimeType: string;
}

@Component({
  selector: 'app-file-preview-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './file-preview-dialog.component.html',
  styleUrl: './file-preview-dialog.component.scss',
})
export class FilePreviewDialogComponent implements OnInit {
  readonly data = inject<FilePreviewDialogData>(MAT_DIALOG_DATA);
  private readonly fileService = inject(FileService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private objectUrl: string | null = null;

  readonly loading = signal(true);
  readonly error = signal('');
  readonly previewUrl = signal<SafeResourceUrl | null>(null);
  readonly isImage = this.data.mimeType.startsWith('image/');
  readonly canPreview = isPreviewable(this.data.mimeType);

  constructor() {
    this.destroyRef.onDestroy(() => this.revoke());
  }

  ngOnInit(): void {
    if (!this.canPreview) {
      this.loading.set(false);
      this.error.set('This file type cannot be previewed in the browser.');
      return;
    }

    this.fileService
      .preview(this.data.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          this.objectUrl = URL.createObjectURL(blob);
          this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Unable to load this preview.');
          this.loading.set(false);
        },
      });
  }

  download(): void {
    this.fileService
      .download(this.data.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = this.data.name;
        link.click();
        URL.revokeObjectURL(url);
      });
  }

  revoke(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
