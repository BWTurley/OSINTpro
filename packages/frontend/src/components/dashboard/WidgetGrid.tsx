import React, { useState } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { QuickSearch } from './QuickSearch';
import { RecentCases } from './RecentCases';
import { ThreatTicker } from './ThreatTicker';
import { GlobalEventMap } from './GlobalEventMap';
import { ActiveAlerts } from './ActiveAlerts';
import { ApiHealthStatus } from './ApiHealthStatus';
import { CollectionActivity } from './CollectionActivity';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

const defaultLayouts: { lg: LayoutItem[] } = {
  lg: [
    { i: 'search', x: 0, y: 0, w: 4, h: 3, minW: 3, minH: 2 },
    { i: 'alerts', x: 4, y: 0, w: 4, h: 3, minW: 3, minH: 2 },
    { i: 'health', x: 8, y: 0, w: 4, h: 3, minW: 3, minH: 2 },
    { i: 'cases', x: 0, y: 3, w: 4, h: 4, minW: 3, minH: 3 },
    { i: 'iocs', x: 4, y: 3, w: 4, h: 4, minW: 3, minH: 3 },
    { i: 'map', x: 8, y: 3, w: 4, h: 4, minW: 3, minH: 3 },
    { i: 'activity', x: 0, y: 7, w: 12, h: 3, minW: 6, minH: 3 },
  ],
};

const widgetComponents: Record<string, React.ReactNode> = {
  search: <QuickSearch />,
  alerts: <ActiveAlerts />,
  health: <ApiHealthStatus />,
  cases: <RecentCases />,
  iocs: <ThreatTicker />,
  map: <GlobalEventMap />,
  activity: <CollectionActivity />,
};

export const WidgetGrid: React.FC = () => {
  const [layouts, setLayouts] = useState(defaultLayouts);

  return (
    <ResponsiveGridLayout
      className="layout"
      layouts={layouts}
      breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
      cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
      rowHeight={60}
      isDraggable
      isResizable
      onLayoutChange={(_current, allLayouts) => {
        setLayouts(allLayouts as typeof defaultLayouts);
      }}
      draggableHandle=".card h3"
      compactType="vertical"
      margin={[16, 16]}
    >
      {defaultLayouts.lg.map((item) => (
        <div key={item.i} className="overflow-hidden">
          {widgetComponents[item.i]}
        </div>
      ))}
    </ResponsiveGridLayout>
  );
};
