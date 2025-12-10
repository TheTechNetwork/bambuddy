import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Package,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  Printer,
  Target,
  Zap,
  AlertTriangle,
  TrendingDown,
  FileSpreadsheet,
  FileText,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { Button } from '../components/Button';
import { useToast } from '../contexts/ToastContext';
import { api } from '../api/client';
import { PrintCalendar } from '../components/PrintCalendar';
import { FilamentTrends } from '../components/FilamentTrends';
import { Dashboard, type DashboardWidget } from '../components/Dashboard';

// Widget Components
function QuickStatsWidget({
  stats,
  currency,
}: {
  stats: {
    total_prints: number;
    successful_prints: number;
    failed_prints: number;
    total_print_time_hours: number;
    total_filament_grams: number;
    total_cost: number;
    total_energy_kwh: number;
    total_energy_cost: number;
  } | undefined;
  currency: string;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-bambu-dark text-bambu-green">
          <Package className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-bambu-gray">Total Prints</p>
          <p className="text-xl font-bold text-white">{stats?.total_prints || 0}</p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-bambu-dark text-blue-400">
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-bambu-gray">Print Time</p>
          <p className="text-xl font-bold text-white">{stats?.total_print_time_hours.toFixed(1) || 0}h</p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-bambu-dark text-orange-400">
          <Package className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-bambu-gray">Filament Used</p>
          <p className="text-xl font-bold text-white">{((stats?.total_filament_grams || 0) / 1000).toFixed(2)}kg</p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-bambu-dark text-green-400">
          <DollarSign className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-bambu-gray">Filament Cost</p>
          <p className="text-xl font-bold text-white">{currency} {stats?.total_cost.toFixed(2) || '0.00'}</p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-bambu-dark text-yellow-400">
          <Zap className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-bambu-gray">Energy Used</p>
          <p className="text-xl font-bold text-white">{stats?.total_energy_kwh.toFixed(2) || '0.00'} kWh</p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-bambu-dark text-yellow-500">
          <DollarSign className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-bambu-gray">Energy Cost</p>
          <p className="text-xl font-bold text-white">{currency} {stats?.total_energy_cost.toFixed(2) || '0.00'}</p>
        </div>
      </div>
    </div>
  );
}

function SuccessRateWidget({
  stats,
}: {
  stats: {
    total_prints: number;
    successful_prints: number;
    failed_prints: number;
  } | undefined;
}) {
  const successRate = stats?.total_prints
    ? Math.round((stats.successful_prints / stats.total_prints) * 100)
    : 0;

  return (
    <div className="flex items-center gap-6">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90">
          <circle cx="56" cy="56" r="48" fill="none" stroke="#3d3d3d" strokeWidth="10" />
          <circle
            cx="56"
            cy="56"
            r="48"
            fill="none"
            stroke="#00ae42"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${successRate * 3.02} 302`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-white">{successRate}%</span>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-bambu-green" />
          <span className="text-sm text-bambu-gray">Successful:</span>
          <span className="text-sm text-white font-medium">{stats?.successful_prints || 0}</span>
        </div>
        <div className="flex items-center gap-2">
          <XCircle className="w-4 h-4 text-red-400" />
          <span className="text-sm text-bambu-gray">Failed:</span>
          <span className="text-sm text-white font-medium">{stats?.failed_prints || 0}</span>
        </div>
      </div>
    </div>
  );
}

function TimeAccuracyWidget({
  stats,
  printerMap,
}: {
  stats: {
    average_time_accuracy: number | null;
    time_accuracy_by_printer: Record<string, number> | null;
  } | undefined;
  printerMap: Map<string, string>;
}) {
  const accuracy = stats?.average_time_accuracy;

  if (accuracy === null || accuracy === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-bambu-gray text-center py-4">No time accuracy data yet</p>
      </div>
    );
  }

  // Normalize accuracy for display (100% = perfect, clamp between 50-150 for gauge)
  const displayValue = Math.min(150, Math.max(50, accuracy));
  const normalizedForGauge = ((displayValue - 50) / 100) * 100; // 50-150 -> 0-100

  // Color based on accuracy
  const getColor = (acc: number) => {
    if (acc >= 95 && acc <= 105) return '#00ae42'; // Green - within 5%
    if (acc > 105) return '#3b82f6'; // Blue - faster than expected
    return '#f97316'; // Orange - slower than expected
  };

  const color = getColor(accuracy);
  const deviation = accuracy - 100;

  return (
    <div className="flex items-center gap-6">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90">
          <circle cx="56" cy="56" r="48" fill="none" stroke="#3d3d3d" strokeWidth="10" />
          <circle
            cx="56"
            cy="56"
            r="48"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${normalizedForGauge * 3.02} 302`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-white">{accuracy.toFixed(0)}%</span>
          <span className={`text-xs ${deviation >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
            {deviation >= 0 ? '+' : ''}{deviation.toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="space-y-2 flex-1">
        <div className="flex items-center gap-2 text-xs text-bambu-gray">
          <Target className="w-3 h-3" />
          <span>100% = perfect estimate</span>
        </div>
        {stats?.time_accuracy_by_printer && Object.keys(stats.time_accuracy_by_printer).length > 0 && (
          <div className="space-y-1 mt-2">
            {Object.entries(stats.time_accuracy_by_printer).slice(0, 3).map(([printerId, acc]) => (
              <div key={printerId} className="flex items-center justify-between text-xs">
                <span className="text-bambu-gray truncate max-w-[100px]">
                  {printerMap.get(printerId) || `Printer ${printerId}`}
                </span>
                <span className={`font-medium ${
                  acc >= 95 && acc <= 105 ? 'text-bambu-green' :
                  acc > 105 ? 'text-blue-400' : 'text-orange-400'
                }`}>
                  {acc.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilamentTypesWidget({
  stats,
}: {
  stats: {
    total_prints: number;
    prints_by_filament_type: Record<string, number>;
  } | undefined;
}) {
  if (!stats?.prints_by_filament_type || Object.keys(stats.prints_by_filament_type).length === 0) {
    return <p className="text-bambu-gray text-center py-4">No filament data available</p>;
  }

  // Sort by print count descending
  const sortedEntries = Object.entries(stats.prints_by_filament_type).sort(
    ([, a], [, b]) => b - a
  );

  return (
    <div className="space-y-3">
      {sortedEntries.map(([type, count]) => {
        const percentage = Math.round((count / (stats.total_prints || 1)) * 100);
        return (
          <div key={type}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-white">{type}</span>
              <span className="text-bambu-gray">{count} prints</span>
            </div>
            <div className="h-2 bg-bambu-dark rounded-full">
              <div
                className="h-full bg-bambu-green rounded-full transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PrintActivityWidget({ printDates }: { printDates: string[] }) {
  return <PrintCalendar printDates={printDates} months={4} />;
}

function PrintsByPrinterWidget({
  stats,
  printerMap,
}: {
  stats: { prints_by_printer: Record<string, number> } | undefined;
  printerMap: Map<string, string>;
}) {
  if (!stats?.prints_by_printer || Object.keys(stats.prints_by_printer).length === 0) {
    return <p className="text-bambu-gray text-center py-4">No printer data available</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {Object.entries(stats.prints_by_printer).map(([printerId, count]) => (
        <div key={printerId} className="flex items-center gap-3 p-3 bg-bambu-dark rounded-lg">
          <div className="p-2 bg-bambu-dark-tertiary rounded-lg">
            <Printer className="w-4 h-4 text-bambu-green" />
          </div>
          <div>
            <p className="text-white font-medium text-sm">
              {printerMap.get(printerId) || `Printer ${printerId}`}
            </p>
            <p className="text-xs text-bambu-gray">{count} prints</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function FilamentTrendsWidget({
  archives,
  currency,
}: {
  archives: Parameters<typeof FilamentTrends>[0]['archives'];
  currency: string;
}) {
  if (!archives || archives.length === 0) {
    return <p className="text-bambu-gray text-center py-4">No print data available</p>;
  }
  return <FilamentTrends archives={archives} currency={currency} />;
}

function FailureAnalysisWidget() {
  const { data: analysis, isLoading } = useQuery({
    queryKey: ['failureAnalysis'],
    queryFn: () => api.getFailureAnalysis({ days: 30 }),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="w-6 h-6 text-bambu-green animate-spin" />
      </div>
    );
  }

  if (!analysis || analysis.total_prints === 0) {
    return <p className="text-bambu-gray text-center py-4">No print data in the last 30 days</p>;
  }

  const topReasons = Object.entries(analysis.failures_by_reason)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`w-5 h-5 ${analysis.failure_rate > 20 ? 'text-red-400' : analysis.failure_rate > 10 ? 'text-yellow-400' : 'text-bambu-green'}`} />
          <span className="text-2xl font-bold text-white">{analysis.failure_rate.toFixed(1)}%</span>
          <span className="text-sm text-bambu-gray">failure rate</span>
        </div>
        <div className="text-sm text-bambu-gray">
          {analysis.failed_prints} / {analysis.total_prints} prints failed
        </div>
      </div>

      {/* Top Failure Reasons */}
      {topReasons.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-bambu-gray font-medium">Top Failure Reasons</p>
          {topReasons.map(([reason, count]) => (
            <div key={reason} className="flex items-center justify-between text-sm">
              <span className="text-white truncate max-w-[200px]">{reason || 'Unknown'}</span>
              <span className="text-bambu-gray">{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Trend indicator */}
      {analysis.trend && analysis.trend.length >= 2 && (
        <div className="pt-2 border-t border-bambu-dark-tertiary">
          <div className="flex items-center gap-2 text-sm">
            <TrendingDown className={`w-4 h-4 ${
              analysis.trend[analysis.trend.length - 1].failure_rate < analysis.trend[analysis.trend.length - 2].failure_rate
                ? 'text-bambu-green'
                : 'text-red-400'
            }`} />
            <span className="text-bambu-gray">
              Last week: {analysis.trend[analysis.trend.length - 1].failure_rate.toFixed(1)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function StatsPage() {
  const { showToast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [dashboardKey, setDashboardKey] = useState(0);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['archiveStats'],
    queryFn: api.getArchiveStats,
  });

  const { data: printers } = useQuery({
    queryKey: ['printers'],
    queryFn: api.getPrinters,
  });

  const { data: archives } = useQuery({
    queryKey: ['archives'],
    queryFn: () => api.getArchives(undefined, 1000, 0),
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  });

  const handleExport = async (format: 'csv' | 'xlsx') => {
    setShowExportMenu(false);
    setIsExporting(true);
    try {
      const { blob, filename } = await api.exportStats({ format, days: 90 });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Export downloaded');
    } catch (err) {
      showToast('Export failed', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const currency = settings?.currency || '$';
  const printerMap = new Map(printers?.map((p) => [String(p.id), p.name]) || []);
  const printDates = archives?.map((a) => a.created_at) || [];

  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="text-center py-12 text-bambu-gray">Loading statistics...</div>
      </div>
    );
  }

  // Define dashboard widgets
  // Sizes: 1 = quarter (1/4), 2 = half (1/2), 4 = full width
  const widgets: DashboardWidget[] = [
    {
      id: 'quick-stats',
      title: 'Quick Stats',
      component: <QuickStatsWidget stats={stats} currency={currency} />,
      defaultSize: 2,
    },
    {
      id: 'success-rate',
      title: 'Success Rate',
      component: <SuccessRateWidget stats={stats} />,
      defaultSize: 1,
    },
    {
      id: 'time-accuracy',
      title: 'Time Accuracy',
      component: <TimeAccuracyWidget stats={stats} printerMap={printerMap} />,
      defaultSize: 1,
    },
    {
      id: 'filament-types',
      title: 'Filament Types',
      component: <FilamentTypesWidget stats={stats} />,
      defaultSize: 1,
    },
    {
      id: 'failure-analysis',
      title: 'Failure Analysis (30 days)',
      component: <FailureAnalysisWidget />,
      defaultSize: 1,
    },
    {
      id: 'print-activity',
      title: 'Print Activity',
      component: <PrintActivityWidget printDates={printDates} />,
      defaultSize: 2,
    },
    {
      id: 'prints-by-printer',
      title: 'Prints by Printer',
      component: <PrintsByPrinterWidget stats={stats} printerMap={printerMap} />,
      defaultSize: 2,
    },
    {
      id: 'filament-trends',
      title: 'Filament Usage Trends',
      component: <FilamentTrendsWidget archives={archives || []} currency={currency} />,
      defaultSize: 4,
    },
  ];

  const handleResetLayout = () => {
    localStorage.removeItem('bambusy-dashboard-layout');
    setDashboardKey(prev => prev + 1);
    showToast('Layout reset');
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-bambu-gray">Drag widgets to rearrange. Click the eye icon to hide.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleResetLayout}
          >
            <RotateCcw className="w-4 h-4" />
            Reset Layout
          </Button>
          {/* Export dropdown */}
          <div className="relative">
            <Button
              variant="secondary"
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              Export Stats
            </Button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-bambu-dark-secondary border border-bambu-dark-tertiary rounded-lg shadow-xl z-20">
                <button
                  className="w-full px-4 py-2 text-left text-white hover:bg-bambu-dark-tertiary transition-colors flex items-center gap-2 rounded-t-lg"
                  onClick={() => handleExport('csv')}
                >
                  <FileText className="w-4 h-4" />
                  Export as CSV
                </button>
                <button
                  className="w-full px-4 py-2 text-left text-white hover:bg-bambu-dark-tertiary transition-colors flex items-center gap-2 rounded-b-lg"
                  onClick={() => handleExport('xlsx')}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Export as Excel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dashboard key={dashboardKey} widgets={widgets} storageKey="bambusy-dashboard-layout" hideControls />
    </div>
  );
}
