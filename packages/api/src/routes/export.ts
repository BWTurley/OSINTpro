import { Router, Response, NextFunction } from 'express';
import { ExportService } from '../services/exportService.js';
import { requireAuth } from '../middleware/rbac.js';
import { createAppError } from '../middleware/errorHandler.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export function createExportRouter(exportService: ExportService): Router {
  const router = Router();

  // GET /export/case/:caseId/:format
  router.get(
    '/case/:caseId/:format',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const caseId = req.params.caseId as string;
        const format = req.params.format as string;

        switch (format) {
          case 'json': {
            const data = await exportService.exportJSON(caseId);
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="case-${caseId}.json"`);
            res.send(data);
            break;
          }
          case 'csv': {
            const data = await exportService.exportCSV(caseId);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="case-${caseId}.csv"`);
            res.send(data);
            break;
          }
          case 'markdown':
          case 'md': {
            const data = await exportService.exportMarkdown(caseId);
            res.setHeader('Content-Type', 'text/markdown');
            res.setHeader('Content-Disposition', `attachment; filename="case-${caseId}.md"`);
            res.send(data);
            break;
          }
          case 'stix': {
            const data = await exportService.exportSTIX(caseId);
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="case-${caseId}-stix.json"`);
            res.send(data);
            break;
          }
          case 'pdf': {
            const data = await exportService.exportPDF(caseId);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="case-${caseId}.pdf"`);
            res.send(data);
            break;
          }
          default:
            throw createAppError(
              `Unsupported export format: ${format}. Supported: json, csv, markdown, stix, pdf`,
              400,
              'INVALID_FORMAT',
            );
        }
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
