import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { PrinterStatus } from '../../api/client';
import { Package, Loader2, ArrowDown, ArrowUp } from 'lucide-react';

interface AMSPanelProps {
  printerId: number;
  status: PrinterStatus | null | undefined;
}

interface AMSTray {
  id: number;
  color: string;
  type: string;
  remain: number;
  active: boolean;
}

interface AMSUnit {
  id: number;
  trays: AMSTray[];
}

// Parse AMS data from raw_data in status
function parseAMSData(status: PrinterStatus | null | undefined): AMSUnit[] {
  // AMS data comes from raw MQTT data
  // This is a simplified parser - actual data structure may vary
  const rawData = (status as { raw_data?: { ams?: unknown[] } })?.raw_data;
  if (!rawData?.ams) return [];

  try {
    return (rawData.ams as Array<{
      id?: number;
      tray?: Array<{
        id?: number;
        tray_color?: string;
        tray_type?: string;
        remain?: number;
      }>;
    }>).map((unit) => ({
      id: unit.id ?? 0,
      trays: (unit.tray ?? []).map((tray) => ({
        id: tray.id ?? 0,
        color: tray.tray_color ?? 'FFFFFF',
        type: tray.tray_type ?? 'Unknown',
        remain: tray.remain ?? 0,
        active: false, // Would need additional MQTT data to determine
      })),
    }));
  } catch {
    return [];
  }
}

function hexToRgb(hex: string): string {
  // Handle RRGGBBAA format
  const cleanHex = hex.replace('#', '').substring(0, 6);
  const r = parseInt(cleanHex.substring(0, 2), 16) || 128;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 128;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 128;
  return `rgb(${r}, ${g}, ${b})`;
}

export function AMSPanel({ printerId, status }: AMSPanelProps) {
  const isConnected = status?.connected ?? false;
  const isPrinting = status?.state === 'RUNNING';
  const amsUnits = parseAMSData(status);

  const [selectedTray, setSelectedTray] = useState<number | null>(null);

  const loadMutation = useMutation({
    mutationFn: (trayId: number) => api.amsLoadFilament(printerId, trayId),
  });

  const unloadMutation = useMutation({
    mutationFn: () => api.amsUnloadFilament(printerId),
  });

  const handleLoad = () => {
    if (selectedTray !== null) {
      loadMutation.mutate(selectedTray);
    }
  };

  const handleUnload = () => {
    unloadMutation.mutate();
  };

  const isLoading = loadMutation.isPending || unloadMutation.isPending;

  if (amsUnits.length === 0) {
    return (
      <div className="bg-bambu-dark-secondary rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-4 h-4 text-bambu-gray" />
          <h3 className="text-sm font-medium">AMS</h3>
        </div>
        <p className="text-sm text-bambu-gray text-center py-4">
          No AMS detected or using external spool
        </p>
      </div>
    );
  }

  return (
    <div className="bg-bambu-dark-secondary rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-bambu-gray" />
          <h3 className="text-sm font-medium">AMS</h3>
        </div>
        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-bambu-green" />}
      </div>

      {/* AMS Units */}
      {amsUnits.map((unit) => (
        <div key={unit.id} className="mb-4">
          {amsUnits.length > 1 && (
            <div className="text-xs text-bambu-gray mb-2">AMS {unit.id + 1}</div>
          )}
          <div className="grid grid-cols-4 gap-2">
            {unit.trays.map((tray) => {
              const globalTrayId = unit.id * 4 + tray.id;
              const isSelected = selectedTray === globalTrayId;
              const isEmpty = tray.type === 'NONE' || !tray.type;

              return (
                <button
                  key={tray.id}
                  onClick={() => !isEmpty && setSelectedTray(isSelected ? null : globalTrayId)}
                  disabled={isEmpty || isPrinting}
                  className={`relative p-2 rounded-lg transition-all ${
                    isSelected
                      ? 'ring-2 ring-bambu-green bg-bambu-dark'
                      : 'bg-bambu-dark hover:bg-bambu-dark-tertiary'
                  } ${isEmpty ? 'opacity-50' : ''} disabled:cursor-not-allowed`}
                >
                  {/* Color Indicator */}
                  <div
                    className="w-8 h-8 mx-auto rounded-full mb-1 border-2 border-bambu-dark-tertiary"
                    style={{
                      backgroundColor: isEmpty ? '#333' : hexToRgb(tray.color),
                    }}
                  />

                  {/* Tray Number */}
                  <div className="text-xs text-center text-bambu-gray">
                    {tray.id + 1}
                  </div>

                  {/* Type */}
                  <div className="text-xs text-center truncate" title={tray.type}>
                    {isEmpty ? '--' : tray.type}
                  </div>

                  {/* Remaining */}
                  {!isEmpty && (
                    <div className="mt-1">
                      <div className="h-1 bg-bambu-dark-tertiary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-bambu-green"
                          style={{ width: `${Math.min(100, tray.remain)}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-center text-bambu-gray mt-0.5">
                        {tray.remain}%
                      </div>
                    </div>
                  )}

                  {/* Active Indicator */}
                  {tray.active && (
                    <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-bambu-green animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Load/Unload Controls */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={handleLoad}
          disabled={!isConnected || isPrinting || selectedTray === null || isLoading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded bg-bambu-green/20 text-bambu-green hover:bg-bambu-green/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowDown className="w-4 h-4" />
          <span className="text-sm">Load</span>
        </button>
        <button
          onClick={handleUnload}
          disabled={!isConnected || isPrinting || isLoading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded bg-bambu-dark hover:bg-bambu-dark-tertiary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowUp className="w-4 h-4" />
          <span className="text-sm">Unload</span>
        </button>
      </div>

      {selectedTray !== null && (
        <p className="mt-2 text-xs text-bambu-gray text-center">
          Selected: Slot {(selectedTray % 4) + 1}
          {amsUnits.length > 1 && ` (AMS ${Math.floor(selectedTray / 4) + 1})`}
        </p>
      )}

      {isPrinting && (
        <p className="mt-2 text-xs text-yellow-500 text-center">
          Filament change disabled during print
        </p>
      )}

      {(loadMutation.error || unloadMutation.error) && (
        <p className="mt-2 text-sm text-red-400">
          {(loadMutation.error || unloadMutation.error)?.message}
        </p>
      )}
    </div>
  );
}
