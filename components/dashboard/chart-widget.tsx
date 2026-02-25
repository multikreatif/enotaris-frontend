'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  ChartComponent,
  SeriesCollectionDirective,
  SeriesDirective,
  Inject,
  ColumnSeries,
  Category,
  Tooltip,
  DataLabel,
} from '@syncfusion/ej2-react-charts';
import {
  AccumulationChartComponent,
  AccumulationSeriesCollectionDirective,
  AccumulationSeriesDirective,
  Inject as AccumulationInject,
  AccumulationLegend,
  AccumulationDataLabel,
  AccumulationTooltip,
  PieSeries,
} from '@syncfusion/ej2-react-charts';

import '@syncfusion/ej2-base/styles/material.css';

export type ChartWidgetVariant = 'bar' | 'pie';

export interface ChartWidgetProps {
  title: string;
  data: { name: string; value: number }[];
  variant?: ChartWidgetVariant;
  className?: string;
  /** Warna untuk bar/pie (opsional) */
  colors?: string[];
}

const DEFAULT_COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#a855f7', '#64748b'];

export function ChartWidget({
  title,
  data,
  variant = 'bar',
  className,
  colors = DEFAULT_COLORS,
}: ChartWidgetProps) {
  const pieData = data.map((d) => ({ x: d.name, y: d.value }));

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[240px] w-full">
          {data.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Tidak ada data
            </div>
          ) : variant === 'pie' ? (
            <AccumulationChartComponent
              id="chart-widget-pie"
              height="240px"
              legendSettings={{ visible: true, position: 'Bottom' }}
              tooltip={{ enable: true }}
            >
              <AccumulationInject services={[PieSeries, AccumulationLegend, AccumulationDataLabel, AccumulationTooltip]} />
              <AccumulationSeriesCollectionDirective>
                <AccumulationSeriesDirective
                  dataSource={pieData}
                  xName="x"
                  yName="y"
                  type="Pie"
                  palettes={colors}
                  dataLabel={{
                    visible: true,
                    position: 'Outside',
                    name: 'x',
                    connectorStyle: { length: '20px' },
                  }}
                />
              </AccumulationSeriesCollectionDirective>
            </AccumulationChartComponent>
          ) : (
            <ChartComponent
              id="chart-widget-bar"
              height="240px"
              primaryXAxis={{ valueType: 'Category', labelStyle: { size: '12px' } }}
              primaryYAxis={{
                minimum: 0,
                labelStyle: { size: '12px' },
                majorGridLines: { width: 0 },
              }}
              tooltip={{ enable: true }}
              legendSettings={{ visible: false }}
              palettes={colors}
            >
              <Inject services={[ColumnSeries, Category, Tooltip, DataLabel]} />
              <SeriesCollectionDirective>
                <SeriesDirective
                  dataSource={data}
                  xName="name"
                  yName="value"
                  type="Column"
                  name="Jumlah"
                  marker={{ dataLabel: { visible: true, position: 'Top' } }}
                />
              </SeriesCollectionDirective>
            </ChartComponent>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
