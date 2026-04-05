import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { StorageService } from '../services/storageService.js';
import { requireAuth } from '../middleware/rbac.js';
import { createAppError } from '../middleware/errorHandler.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10,
  },
});

export function createFileRouter(storageService: StorageService): Router {
  const router = Router();

  // POST /files/upload
  router.post(
    '/upload',
    requireAuth,
    upload.single('file'),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.file) {
          throw createAppError('No file provided', 400, 'MISSING_FILE');
        }

        const ext = req.file.originalname.split('.').pop() ?? 'bin';
        const key = `uploads/${uuidv4()}.${ext}`;

        const result = await storageService.upload(
          key,
          req.file.buffer,
          req.file.mimetype,
          {
            'x-original-name': req.file.originalname,
            'x-uploaded-by': req.user?.id ?? 'unknown',
          },
        );

        res.status(201).json({
          key: result.key,
          bucket: result.bucket,
          etag: result.etag,
          size: req.file.size,
          contentType: req.file.mimetype,
          originalName: req.file.originalname,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /files/upload-multiple
  router.post(
    '/upload-multiple',
    requireAuth,
    upload.array('files', 10),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const files = req.files as Express.Multer.File[] | undefined;
        if (!files || files.length === 0) {
          throw createAppError('No files provided', 400, 'MISSING_FILE');
        }

        const results = await Promise.all(
          files.map(async (file) => {
            const ext = file.originalname.split('.').pop() ?? 'bin';
            const key = `uploads/${uuidv4()}.${ext}`;

            const result = await storageService.upload(
              key,
              file.buffer,
              file.mimetype,
              {
                'x-original-name': file.originalname,
                'x-uploaded-by': req.user?.id ?? 'unknown',
              },
            );

            return {
              key: result.key,
              etag: result.etag,
              size: file.size,
              contentType: file.mimetype,
              originalName: file.originalname,
            };
          }),
        );

        res.status(201).json({ files: results });
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /files/:key - download
  router.get(
    '/:key(*)',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { key } = req.params;
        const stat = await storageService.stat(key);

        if (!stat) {
          throw createAppError('File not found', 404, 'FILE_NOT_FOUND');
        }

        const stream = await storageService.download(key);

        res.setHeader('Content-Type', stat.contentType ?? 'application/octet-stream');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Disposition', `attachment; filename="${key.split('/').pop()}"`);

        stream.pipe(res);
      } catch (err) {
        next(err);
      }
    },
  );

  // DELETE /files/:key
  router.delete(
    '/:key(*)',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { key } = req.params;
        await storageService.delete(key);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /files/presigned/:key
  router.get(
    '/presigned/:key(*)',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { key } = req.params;
        const expiry = parseInt(req.query.expiry as string, 10) || 3600;
        const url = await storageService.getPresignedUrl(key, expiry);
        res.json({ url, expiresIn: expiry });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
