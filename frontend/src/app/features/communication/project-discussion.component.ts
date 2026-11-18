import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommentThreadComponent } from './comment-thread.component';

@Component({
  selector: 'app-project-discussion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommentThreadComponent],
  template: `
    <app-comment-thread
      entityType="project"
      [entityId]="projectId"
      [projectId]="projectId"
    />
  `,
})
export class ProjectDiscussionComponent {
  private readonly route = inject(ActivatedRoute);

  readonly projectId =
    this.route.snapshot.pathFromRoot
      .map((snapshot) => snapshot.paramMap.get('id'))
      .find((value): value is string => Boolean(value)) ?? '';
}
