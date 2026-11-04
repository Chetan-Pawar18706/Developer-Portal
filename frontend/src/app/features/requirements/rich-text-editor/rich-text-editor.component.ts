import { NgClass } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  forwardRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Editor } from '@tiptap/core';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import StarterKit from '@tiptap/starter-kit';

type ToolbarMark = 'bold' | 'italic' | 'strike' | 'link';

@Component({
  selector: 'app-rich-text-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, MatButtonModule, MatIconModule, MatTooltipModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RichTextEditorComponent),
      multi: true,
    },
  ],
  template: `
    <div class="editor-shell" [class.is-disabled]="disabled()">
      <div class="toolbar" role="toolbar" aria-label="Rich text formatting">
        <button
          mat-icon-button
          type="button"
          [ngClass]="{ active: isMarkActive('bold') }"
          [disabled]="disabled()"
          matTooltip="Bold"
          aria-label="Bold"
          (click)="toggleBold()"
        >
          <mat-icon>format_bold</mat-icon>
        </button>
        <button
          mat-icon-button
          type="button"
          [ngClass]="{ active: isMarkActive('italic') }"
          [disabled]="disabled()"
          matTooltip="Italic"
          aria-label="Italic"
          (click)="toggleItalic()"
        >
          <mat-icon>format_italic</mat-icon>
        </button>
        <button
          mat-icon-button
          type="button"
          [ngClass]="{ active: isMarkActive('strike') }"
          [disabled]="disabled()"
          matTooltip="Strikethrough"
          aria-label="Strikethrough"
          (click)="toggleStrike()"
        >
          <mat-icon>strikethrough_s</mat-icon>
        </button>

        <span class="toolbar-divider" aria-hidden="true"></span>

        <button
          mat-icon-button
          type="button"
          [ngClass]="{ active: isHeading(2) }"
          [disabled]="disabled()"
          matTooltip="Heading"
          aria-label="Heading"
          (click)="toggleHeading()"
        >
          <mat-icon>title</mat-icon>
        </button>
        <button
          mat-icon-button
          type="button"
          [ngClass]="{ active: isActive('bulletList') }"
          [disabled]="disabled()"
          matTooltip="Bulleted list"
          aria-label="Bulleted list"
          (click)="toggleBulletList()"
        >
          <mat-icon>format_list_bulleted</mat-icon>
        </button>
        <button
          mat-icon-button
          type="button"
          [ngClass]="{ active: isActive('orderedList') }"
          [disabled]="disabled()"
          matTooltip="Numbered list"
          aria-label="Numbered list"
          (click)="toggleOrderedList()"
        >
          <mat-icon>format_list_numbered</mat-icon>
        </button>
        <button
          mat-icon-button
          type="button"
          [ngClass]="{ active: isActive('blockquote') }"
          [disabled]="disabled()"
          matTooltip="Quote"
          aria-label="Quote"
          (click)="toggleBlockquote()"
        >
          <mat-icon>format_quote</mat-icon>
        </button>
        <button
          mat-icon-button
          type="button"
          [ngClass]="{ active: isMarkActive('link') }"
          [disabled]="disabled()"
          matTooltip="Insert link"
          aria-label="Insert link"
          (click)="setLink()"
        >
          <mat-icon>link</mat-icon>
        </button>

        <span class="toolbar-divider" aria-hidden="true"></span>

        <button
          mat-icon-button
          type="button"
          [disabled]="disabled() || !canUndo()"
          matTooltip="Undo"
          aria-label="Undo"
          (click)="undo()"
        >
          <mat-icon>undo</mat-icon>
        </button>
        <button
          mat-icon-button
          type="button"
          [disabled]="disabled() || !canRedo()"
          matTooltip="Redo"
          aria-label="Redo"
          (click)="redo()"
        >
          <mat-icon>redo</mat-icon>
        </button>
      </div>

      <div #editorHost class="editor-host"></div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .editor-shell {
      overflow: hidden;
      border: 1px solid var(--mat-sys-outline);
      border-radius: 0.75rem;
      background: var(--mat-sys-surface);

      &:focus-within {
        border-color: var(--mat-sys-primary);
        box-shadow: 0 0 0 1px var(--mat-sys-primary);
      }

      &.is-disabled {
        opacity: 0.65;
      }
    }

    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.1rem;
      padding: 0.3rem 0.45rem;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container-low);

      button {
        --mat-icon-button-state-layer-size: 2.25rem;
        width: 2.25rem;
        height: 2.25rem;
        padding: 0.4rem;
        color: var(--mat-sys-on-surface-variant);

        &.active {
          background: var(--mat-sys-secondary-container);
          color: var(--mat-sys-on-secondary-container);
        }

        mat-icon {
          width: 1.2rem;
          height: 1.2rem;
          font-size: 1.2rem;
        }
      }
    }

    .toolbar-divider {
      width: 1px;
      height: 1.4rem;
      margin: 0 0.3rem;
      background: var(--mat-sys-outline-variant);
    }

    .editor-host {
      min-height: 12rem;
      max-height: 32rem;
      overflow-y: auto;
      padding: 0.9rem 1rem;
      cursor: text;
    }

    .editor-host ::ng-deep .tiptap {
      min-height: 10rem;
      outline: none;
      line-height: 1.65;

      > *:first-child {
        margin-top: 0;
      }

      > *:last-child {
        margin-bottom: 0;
      }

      p {
        margin: 0 0 0.7rem;
      }

      h2,
      h3 {
        margin: 0.8rem 0 0.45rem;
        line-height: 1.3;
      }

      ul,
      ol {
        margin: 0 0 0.75rem;
        padding-left: 1.4rem;
      }

      blockquote {
        margin: 0.75rem 0;
        padding-left: 0.9rem;
        border-left: 3px solid var(--mat-sys-outline-variant);
        color: var(--mat-sys-on-surface-variant);
      }

      a {
        color: var(--mat-sys-primary);
        text-decoration: underline;
      }

      p.is-editor-empty:first-child::before {
        float: left;
        height: 0;
        color: var(--mat-sys-on-surface-variant);
        content: attr(data-placeholder);
        pointer-events: none;
      }
    }
  `,
})
export class RichTextEditorComponent implements AfterViewInit, ControlValueAccessor {
  readonly placeholder = input('');

  readonly disabled = signal(false);
  readonly toolbarTick = signal(0);

  private readonly editorHost = viewChild.required<ElementRef<HTMLDivElement>>('editorHost');
  private editor: Editor | null = null;
  private pendingValue = '';
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  ngAfterViewInit(): void {
    this.editor = new Editor({
      element: this.editorHost().nativeElement,
      editable: !this.disabled(),
      content: this.pendingValue,
      extensions: [
        StarterKit.configure({
          link: false,
          heading: { levels: [2, 3] },
        }),
        Link.configure({
          openOnClick: false,
          autolink: true,
          HTMLAttributes: {
            rel: 'noopener noreferrer',
            target: '_blank',
          },
        }),
        Placeholder.configure({
          placeholder: this.placeholder(),
        }),
      ],
      onUpdate: ({ editor }) => {
        this.onChange(editor.getHTML());
        this.toolbarTick.update((tick) => tick + 1);
      },
      onSelectionUpdate: () => this.toolbarTick.update((tick) => tick + 1),
      onTransaction: () => this.toolbarTick.update((tick) => tick + 1),
      onBlur: () => this.onTouched(),
    });
  }

  writeValue(value: string | null): void {
    this.pendingValue = value ?? '';

    if (this.editor) {
      if (this.editor.getHTML() === this.pendingValue) {
        return;
      }

      this.editor.commands.setContent(this.pendingValue || '', { emitUpdate: false });
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
    this.editor?.setEditable(!isDisabled);
  }

  isMarkActive(mark: ToolbarMark): boolean {
    this.toolbarTick();
    return this.editor?.isActive(mark) ?? false;
  }

  isActive(node: string): boolean {
    this.toolbarTick();
    return this.editor?.isActive(node) ?? false;
  }

  isHeading(level: number): boolean {
    this.toolbarTick();
    return this.editor?.isActive('heading', { level }) ?? false;
  }

  toggleBold(): void {
    this.editor?.chain().focus().toggleBold().run();
  }

  toggleItalic(): void {
    this.editor?.chain().focus().toggleItalic().run();
  }

  toggleStrike(): void {
    this.editor?.chain().focus().toggleStrike().run();
  }

  toggleHeading(): void {
    this.editor?.chain().focus().toggleHeading({ level: 2 }).run();
  }

  toggleBulletList(): void {
    this.editor?.chain().focus().toggleBulletList().run();
  }

  toggleOrderedList(): void {
    this.editor?.chain().focus().toggleOrderedList().run();
  }

  toggleBlockquote(): void {
    this.editor?.chain().focus().toggleBlockquote().run();
  }

  setLink(): void {
    if (!this.editor) {
      return;
    }

    const current = this.editor.getAttributes('link')['href'];
    const previous = typeof current === 'string' ? current : 'https://';
    const entered = window.prompt('Link URL', previous);

    if (entered === null) {
      return;
    }

    const value = entered.trim();

    if (value.length === 0) {
      this.editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    const href = /^(https?:\/\/|mailto:)/i.test(value) ? value : `https://${value}`;

    this.editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  }

  canUndo(): boolean {
    this.toolbarTick();
    return this.editor?.can().chain().focus().undo().run() ?? false;
  }

  canRedo(): boolean {
    this.toolbarTick();
    return this.editor?.can().chain().focus().redo().run() ?? false;
  }

  undo(): void {
    this.editor?.chain().focus().undo().run();
  }

  redo(): void {
    this.editor?.chain().focus().redo().run();
  }
}
