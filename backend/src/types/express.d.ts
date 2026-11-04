import type { ProjectDocument } from '../models/project.model';
import type { UserRole } from '../models/user.model';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: UserRole;
      };
      project?: ProjectDocument;
    }
  }
}

export {};
