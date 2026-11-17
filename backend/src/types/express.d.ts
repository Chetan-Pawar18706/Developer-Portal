import type { ProjectDocument } from '../models/project.model';
import type { RequirementDocument } from '../models/requirement.model';
import type { TaskDocument } from '../models/task.model';
import type { UserRole } from '../models/user.model';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: UserRole;
      };
      project?: ProjectDocument;
      requirement?: RequirementDocument;
      task?: TaskDocument;
    }
  }
}

export {};
