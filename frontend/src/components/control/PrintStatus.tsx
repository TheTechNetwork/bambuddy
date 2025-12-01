import type { PrinterStatus } from '../../api/client';
import { Clock, Layers, FileText } from 'lucide-react';

interface PrintStatusProps {
  printerId: number;
  status: PrinterStatus | null | undefined;
}

function formatTime(seconds: number | null | undefined): string {
  if (!seconds) return '--:--';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

export function PrintStatus({ status }: PrintStatusProps) {
  const isPrinting = status?.state === 'RUNNING' || status?.state === 'PAUSE';
  const progress = status?.progress ?? 0;

  return (
    <div className="bg-bambu-dark-secondary rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-bambu-gray">Print Status</h3>
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium ${
            status?.state === 'RUNNING'
              ? 'bg-bambu-green/20 text-bambu-green'
              : status?.state === 'PAUSE'
              ? 'bg-yellow-500/20 text-yellow-500'
              : status?.state === 'FINISH'
              ? 'bg-blue-500/20 text-blue-500'
              : status?.state === 'FAILED'
              ? 'bg-red-500/20 text-red-500'
              : 'bg-bambu-dark-tertiary text-bambu-gray'
          }`}
        >
          {status?.state || 'IDLE'}
        </span>
      </div>

      {isPrinting && status?.subtask_name && (
        <div className="flex items-center gap-2 mb-3 text-sm">
          <FileText className="w-4 h-4 text-bambu-gray" />
          <span className="truncate" title={status.subtask_name}>
            {status.subtask_name}
          </span>
        </div>
      )}

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-bambu-gray mb-1">
          <span>Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-bambu-dark-tertiary rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              status?.state === 'PAUSE' ? 'bg-yellow-500' : 'bg-bambu-green'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-bambu-gray" />
          <div>
            <div className="text-xs text-bambu-gray">Remaining</div>
            <div className="font-medium">{formatTime(status?.remaining_time)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-bambu-gray" />
          <div>
            <div className="text-xs text-bambu-gray">Layer</div>
            <div className="font-medium">
              {status?.layer_num ?? 0} / {status?.total_layers ?? 0}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
