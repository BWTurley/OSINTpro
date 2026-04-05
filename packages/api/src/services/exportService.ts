import { PrismaClient, Case, Entity, Relationship } from '@prisma/client';


interface CaseExportData {
  caseRecord: Case & {
    caseEntities: Array<{ entity: Entity }>;
    notes: Array<{ content: string; author: { name: string }; createdAt: Date }>;
    createdBy: { name: string; email: string };
  };
  relationships: Relationship[];
}

export class ExportService {
  constructor(private prisma: PrismaClient) {}

  private async loadCaseData(caseId: string): Promise<CaseExportData> {
    const caseRecord = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: {
        caseEntities: { include: { entity: true } },
        notes: {
          include: { author: { select: { name: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        },
        createdBy: { select: { name: true, email: true } },
      },
    });

    if (!caseRecord) {
      throw new Error(`Case not found: ${caseId}`);
    }

    const entityIds = caseRecord.caseEntities.map((ce) => ce.entity.id);

    const relationships = await this.prisma.relationship.findMany({
      where: {
        OR: [
          { sourceEntityId: { in: entityIds } },
          { targetEntityId: { in: entityIds } },
        ],
      },
    });

    return { caseRecord, relationships };
  }

  async exportJSON(caseId: string): Promise<string> {
    const data = await this.loadCaseData(caseId);

    const output = {
      case: {
        id: data.caseRecord.id,
        name: data.caseRecord.name,
        description: data.caseRecord.description,
        status: data.caseRecord.status,
        tlpLevel: data.caseRecord.tlpLevel,
        tags: data.caseRecord.tags,
        createdBy: data.caseRecord.createdBy,
        createdAt: data.caseRecord.createdAt.toISOString(),
        updatedAt: data.caseRecord.updatedAt.toISOString(),
      },
      entities: data.caseRecord.caseEntities.map((ce) => ({
        id: ce.entity.id,
        entityType: ce.entity.entityType,
        data: ce.entity.data,
        confidence: ce.entity.confidence,
        tags: ce.entity.tags,
        tlpLevel: ce.entity.tlpLevel,
      })),
      relationships: data.relationships.map((r) => ({
        id: r.id,
        sourceEntityId: r.sourceEntityId,
        targetEntityId: r.targetEntityId,
        relationshipType: r.relationshipType,
        confidence: r.confidence,
        description: r.description,
      })),
      notes: data.caseRecord.notes.map((n) => ({
        content: n.content,
        author: n.author.name,
        createdAt: n.createdAt.toISOString(),
      })),
      exportedAt: new Date().toISOString(),
    };

    return JSON.stringify(output, null, 2);
  }

  async exportCSV(caseId: string): Promise<string> {
    const data = await this.loadCaseData(caseId);
    const lines: string[] = [];

    // Header
    lines.push('EntityID,EntityType,Name,Value,Confidence,TLPLevel,Tags');

    for (const ce of data.caseRecord.caseEntities) {
      const entityData = ce.entity.data as Record<string, unknown>;
      const name = String(entityData.name ?? '').replace(/"/g, '""');
      const value = String(entityData.value ?? '').replace(/"/g, '""');
      const tags = ce.entity.tags.join(';');

      lines.push(
        `"${ce.entity.id}","${ce.entity.entityType}","${name}","${value}",${ce.entity.confidence},"${ce.entity.tlpLevel}","${tags}"`,
      );
    }

    // Relationships section
    lines.push('');
    lines.push('RelationshipID,SourceEntityID,TargetEntityID,Type,Confidence,Description');

    for (const r of data.relationships) {
      const desc = String(r.description ?? '').replace(/"/g, '""');
      lines.push(
        `"${r.id}","${r.sourceEntityId}","${r.targetEntityId}","${r.relationshipType}",${r.confidence},"${desc}"`,
      );
    }

    return lines.join('\n');
  }

  async exportMarkdown(caseId: string): Promise<string> {
    const data = await this.loadCaseData(caseId);
    const lines: string[] = [];

    lines.push(`# Case: ${data.caseRecord.name}`);
    lines.push('');
    lines.push(`**Status:** ${data.caseRecord.status}`);
    lines.push(`**TLP Level:** ${data.caseRecord.tlpLevel}`);
    lines.push(`**Created by:** ${data.caseRecord.createdBy.name}`);
    lines.push(`**Created:** ${data.caseRecord.createdAt.toISOString()}`);
    lines.push(`**Updated:** ${data.caseRecord.updatedAt.toISOString()}`);
    if (data.caseRecord.tags.length > 0) {
      lines.push(`**Tags:** ${data.caseRecord.tags.join(', ')}`);
    }
    lines.push('');
    if (data.caseRecord.description) {
      lines.push(`## Description`);
      lines.push('');
      lines.push(data.caseRecord.description);
      lines.push('');
    }

    lines.push('## Entities');
    lines.push('');
    lines.push('| Type | Name/Value | Confidence | TLP |');
    lines.push('|------|-----------|------------|-----|');

    for (const ce of data.caseRecord.caseEntities) {
      const entityData = ce.entity.data as Record<string, unknown>;
      const nameOrValue = String(entityData.name ?? entityData.value ?? 'N/A');
      lines.push(
        `| ${ce.entity.entityType} | ${nameOrValue} | ${(ce.entity.confidence * 100).toFixed(0)}% | ${ce.entity.tlpLevel} |`,
      );
    }

    lines.push('');
    lines.push('## Relationships');
    lines.push('');

    if (data.relationships.length === 0) {
      lines.push('No relationships found.');
    } else {
      lines.push('| Source | Type | Target | Confidence |');
      lines.push('|--------|------|--------|------------|');

      for (const r of data.relationships) {
        lines.push(
          `| ${r.sourceEntityId.slice(0, 8)}... | ${r.relationshipType} | ${r.targetEntityId.slice(0, 8)}... | ${(r.confidence * 100).toFixed(0)}% |`,
        );
      }
    }

    lines.push('');
    lines.push('## Notes');
    lines.push('');

    if (data.caseRecord.notes.length === 0) {
      lines.push('No notes.');
    } else {
      for (const note of data.caseRecord.notes) {
        lines.push(`### ${note.author.name} - ${note.createdAt.toISOString()}`);
        lines.push('');
        lines.push(note.content);
        lines.push('');
      }
    }

    lines.push('---');
    lines.push(`*Exported at ${new Date().toISOString()}*`);

    return lines.join('\n');
  }

  async exportSTIX(caseId: string): Promise<string> {
    const data = await this.loadCaseData(caseId);

    const stixBundle: Record<string, unknown> = {
      type: 'bundle',
      id: `bundle--${caseId}`,
      spec_version: '2.1',
      objects: [] as Array<Record<string, unknown>>,
    };

    const objects = stixBundle.objects as Array<Record<string, unknown>>;

    // Map entity types to STIX types
    const entityTypeToStix: Record<string, string> = {
      PERSON: 'identity',
      ORGANIZATION: 'identity',
      DOMAIN: 'domain-name',
      IP_ADDRESS: 'ipv4-addr',
      EMAIL: 'email-addr',
      PHONE: 'identity',
      CRYPTOCURRENCY: 'identity',
      SOCIAL_MEDIA: 'identity',
      VEHICLE: 'identity',
      LOCATION: 'location',
    };

    // Add report object for the case
    objects.push({
      type: 'report',
      spec_version: '2.1',
      id: `report--${caseId}`,
      created: data.caseRecord.createdAt.toISOString(),
      modified: data.caseRecord.updatedAt.toISOString(),
      name: data.caseRecord.name,
      description: data.caseRecord.description ?? '',
      report_types: ['investigation'],
      object_refs: data.caseRecord.caseEntities.map(
        (ce) => `${entityTypeToStix[ce.entity.entityType] ?? 'identity'}--${ce.entity.id}`,
      ),
    });

    // Add entity objects
    for (const ce of data.caseRecord.caseEntities) {
      const entityData = ce.entity.data as Record<string, unknown>;
      const stixType = entityTypeToStix[ce.entity.entityType] ?? 'identity';
      const stixId = `${stixType}--${ce.entity.id}`;

      const stixObject: Record<string, unknown> = {
        type: stixType,
        spec_version: '2.1',
        id: stixId,
        created: ce.entity.createdAt.toISOString(),
        modified: ce.entity.updatedAt.toISOString(),
        confidence: Math.round(ce.entity.confidence * 100),
      };

      switch (stixType) {
        case 'identity':
          stixObject.name = String(entityData.name ?? entityData.value ?? 'Unknown');
          stixObject.identity_class = ce.entity.entityType === 'ORGANIZATION' ? 'organization' : 'individual';
          break;
        case 'domain-name':
          stixObject.value = String(entityData.value ?? entityData.name ?? '');
          break;
        case 'ipv4-addr':
          stixObject.value = String(entityData.value ?? entityData.name ?? '');
          break;
        case 'email-addr':
          stixObject.value = String(entityData.value ?? entityData.name ?? '');
          break;
        case 'location':
          stixObject.name = String(entityData.name ?? '');
          if (entityData.latitude) stixObject.latitude = entityData.latitude;
          if (entityData.longitude) stixObject.longitude = entityData.longitude;
          if (entityData.country) stixObject.country = entityData.country;
          break;
      }

      // Add TLP marking
      if (ce.entity.tlpLevel !== 'WHITE') {
        stixObject.object_marking_refs = [
          `marking-definition--${ce.entity.tlpLevel.toLowerCase().replace('_', '-')}`,
        ];
      }

      objects.push(stixObject);
    }

    // Add relationship objects
    for (const r of data.relationships) {
      const sourceEntity = data.caseRecord.caseEntities.find(
        (ce) => ce.entity.id === r.sourceEntityId,
      );
      const targetEntity = data.caseRecord.caseEntities.find(
        (ce) => ce.entity.id === r.targetEntityId,
      );

      if (!sourceEntity || !targetEntity) continue;

      const sourceStixType = entityTypeToStix[sourceEntity.entity.entityType] ?? 'identity';
      const targetStixType = entityTypeToStix[targetEntity.entity.entityType] ?? 'identity';

      objects.push({
        type: 'relationship',
        spec_version: '2.1',
        id: `relationship--${r.id}`,
        created: r.createdAt.toISOString(),
        modified: r.updatedAt.toISOString(),
        relationship_type: r.relationshipType.toLowerCase().replace(/_/g, '-'),
        source_ref: `${sourceStixType}--${r.sourceEntityId}`,
        target_ref: `${targetStixType}--${r.targetEntityId}`,
        confidence: Math.round(r.confidence * 100),
        description: r.description ?? undefined,
      });
    }

    return JSON.stringify(stixBundle, null, 2);
  }

  async exportPDF(caseId: string): Promise<Buffer> {
    const data = await this.loadCaseData(caseId);
    const PDFDocument = (await import('pdfkit')).default;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title
      doc.fontSize(20).text(data.caseRecord.name, { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(
        `Status: ${data.caseRecord.status} | TLP: ${data.caseRecord.tlpLevel} | Exported: ${new Date().toISOString()}`,
        { align: 'center' },
      );
      doc.moveDown(2);

      // Description
      if (data.caseRecord.description) {
        doc.fontSize(14).text('Description');
        doc.moveDown(0.5);
        doc.fontSize(10).text(data.caseRecord.description);
        doc.moveDown();
      }

      // Entities
      if (data.caseRecord.caseEntities.length > 0) {
        doc.fontSize(14).text(`Entities (${data.caseRecord.caseEntities.length})`);
        doc.moveDown(0.5);
        for (const ce of data.caseRecord.caseEntities) {
          const entityData = ce.entity.data as Record<string, unknown>;
          const nameOrValue = String(entityData.name ?? entityData.value ?? ce.entity.id);
          doc.fontSize(10).text(
            `- [${ce.entity.entityType}] ${nameOrValue} (confidence: ${ce.entity.confidence ?? 'N/A'})`,
          );
        }
        doc.moveDown();
      }

      // Notes
      if (data.caseRecord.notes.length > 0) {
        doc.fontSize(14).text(`Notes (${data.caseRecord.notes.length})`);
        doc.moveDown(0.5);
        for (const note of data.caseRecord.notes) {
          doc.fontSize(10).text(`[${note.createdAt.toISOString()}] ${note.content}`);
          doc.moveDown(0.3);
        }
      }

      doc.end();
    });
  }
}
