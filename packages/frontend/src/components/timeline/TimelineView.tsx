import React, { useEffect, useRef } from 'react';
import { Timeline as VisTimeline } from 'vis-timeline/standalone';
import { DataSet } from 'vis-data/standalone';
import { ENTITY_COLORS } from '@/utils/constants';
import type { Entity } from '@/types';

interface TimelineEvent {
  id: string;
  entityId: string;
  entityType: string;
  content: string;
  start: string;
  end?: string;
  group?: string;
  type?: 'point' | 'range' | 'box';
}

interface TimelineViewProps {
  events: TimelineEvent[];
  entities?: Entity[];
  onSelect?: (eventId: string) => void;
  height?: string;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  events,
  entities = [],
  onSelect,
  height = '400px',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<VisTimeline | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const items = new DataSet(
      events.map((evt) => ({
        id: evt.id,
        content: evt.content,
        start: new Date(evt.start),
        end: evt.end ? new Date(evt.end) : undefined,
        group: evt.group ?? evt.entityType,
        type: evt.type ?? 'point',
        style: `background-color: ${ENTITY_COLORS[evt.entityType as keyof typeof ENTITY_COLORS] ?? '#6b7280'}33;
                border-color: ${ENTITY_COLORS[evt.entityType as keyof typeof ENTITY_COLORS] ?? '#6b7280'};
                color: #e5e7eb;`,
      }))
    );

    // Build groups from unique entity types
    const groupSet = new Set(events.map((e) => e.group ?? e.entityType));
    const groups = new DataSet(
      Array.from(groupSet).map((g) => ({
        id: g,
        content: g.charAt(0).toUpperCase() + g.slice(1).replace('_', ' '),
        style: `color: #d1d5db; font-size: 14px;`,
      }))
    );

    const options = {
      height,
      stack: true,
      showCurrentTime: true,
      zoomMin: 1000 * 60 * 60, // 1 hour
      zoomMax: 1000 * 60 * 60 * 24 * 365, // 1 year
      orientation: { axis: 'top' as const },
      margin: { item: { horizontal: 5, vertical: 5 } },
      tooltip: { followMouse: true },
    };

    const timeline = new VisTimeline(containerRef.current, items, groups, options);

    timeline.on('select', (props: { items: string[] }) => {
      if (props.items.length > 0) {
        onSelect?.(props.items[0]);
      }
    });

    timelineRef.current = timeline;

    return () => {
      timeline.destroy();
    };
  }, [events, entities, height, onSelect]);

  return (
    <div className="bg-surface-900 rounded-lg border border-gray-700/50 overflow-hidden">
      {events.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-gray-500 text-base">
          No events to display
        </div>
      ) : (
        <div ref={containerRef} />
      )}
    </div>
  );
};
