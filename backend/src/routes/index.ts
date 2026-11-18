import { Router } from 'express';
import { authRouter } from './auth.routes';
import { commentRouter } from './comment.routes';
import { fileRouter } from './file.routes';
import { healthRouter } from './health.routes';
import { issueRouter } from './issue.routes';
import { notificationRouter } from './notification.routes';
import { projectRouter } from './project.routes';
import { requirementRouter } from './requirement.routes';
import { taskRouter } from './task.routes';
import { userRouter } from './user.routes';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/comments', commentRouter);
apiRouter.use('/files', fileRouter);
apiRouter.use('/issues', issueRouter);
apiRouter.use('/notifications', notificationRouter);
apiRouter.use('/projects', projectRouter);
apiRouter.use('/requirements', requirementRouter);
apiRouter.use('/tasks', taskRouter);
apiRouter.use('/users', userRouter);
