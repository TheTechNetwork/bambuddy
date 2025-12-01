import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { PrinterStatus } from '../api/client';
import { CameraFeed } from '../components/control/CameraFeed';
import { PrintStatus } from '../components/control/PrintStatus';
import { PrintControls } from '../components/control/PrintControls';
import { TemperaturePanel } from '../components/control/TemperaturePanel';
import { SpeedControl } from '../components/control/SpeedControl';
import { FanControls } from '../components/control/FanControls';
import { LightToggle } from '../components/control/LightToggle';
import { MovementControls } from '../components/control/MovementControls';
import { AMSPanel } from '../components/control/AMSPanel';
import { Loader2, WifiOff } from 'lucide-react';

export function ControlPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedPrinterId, setSelectedPrinterId] = useState<number | null>(null);

  // Fetch all printers
  const { data: printers, isLoading: loadingPrinters } = useQuery({
    queryKey: ['printers'],
    queryFn: api.getPrinters,
  });

  // Get statuses for all printers
  const { data: statuses } = useQuery({
    queryKey: ['printerStatuses'],
    queryFn: async () => {
      if (!printers) return {};
      const statusMap: Record<number, PrinterStatus> = {};
      await Promise.all(
        printers.map(async (p) => {
          try {
            statusMap[p.id] = await api.getPrinterStatus(p.id);
          } catch {
            // Printer offline
          }
        })
      );
      return statusMap;
    },
    enabled: !!printers && printers.length > 0,
    refetchInterval: 2000,
  });

  // Initialize selected printer from URL or first printer
  useEffect(() => {
    const printerParam = searchParams.get('printer');
    if (printerParam) {
      const id = parseInt(printerParam, 10);
      if (!isNaN(id)) {
        setSelectedPrinterId(id);
        return;
      }
    }
    // Default to first printer
    if (printers && printers.length > 0 && !selectedPrinterId) {
      setSelectedPrinterId(printers[0].id);
    }
  }, [printers, searchParams, selectedPrinterId]);

  // Update URL when printer changes
  const handlePrinterSelect = (printerId: number) => {
    setSelectedPrinterId(printerId);
    setSearchParams({ printer: String(printerId) });
  };

  const selectedPrinter = printers?.find((p) => p.id === selectedPrinterId);
  const selectedStatus = selectedPrinterId ? statuses?.[selectedPrinterId] : null;

  if (loadingPrinters) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-bambu-green" />
      </div>
    );
  }

  if (!printers || printers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-bambu-gray">
        <WifiOff className="w-16 h-16 mb-4" />
        <p className="text-xl">No printers configured</p>
        <p className="text-sm mt-2">Add a printer in the Printers page first</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Printer Tabs */}
      <div className="bg-bambu-dark-secondary border-b border-bambu-dark-tertiary">
        <div className="flex overflow-x-auto">
          {printers.map((printer) => {
            const status = statuses?.[printer.id];
            const isConnected = status?.connected ?? false;
            const isSelected = printer.id === selectedPrinterId;

            return (
              <button
                key={printer.id}
                onClick={() => handlePrinterSelect(printer.id)}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
                  isSelected
                    ? 'border-bambu-green text-bambu-green bg-bambu-dark'
                    : 'border-transparent text-bambu-gray hover:text-white hover:bg-bambu-dark-tertiary'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-bambu-green' : 'bg-red-500'
                  }`}
                />
                {printer.name}
                {status?.state && status.state !== 'IDLE' && (
                  <span className="text-xs px-2 py-0.5 rounded bg-bambu-dark-tertiary">
                    {status.state}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      {selectedPrinter && (
        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-7xl mx-auto">
            {/* Connection Warning */}
            {!selectedStatus?.connected && (
              <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-3">
                <WifiOff className="w-5 h-5 text-red-500" />
                <span className="text-red-400">
                  Printer is not connected. Controls are disabled.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left Column: Camera + Print Status */}
              <div className="space-y-4">
                {/* Camera Feed */}
                <CameraFeed
                  printerId={selectedPrinter.id}
                  isConnected={selectedStatus?.connected ?? false}
                />

                {/* Print Status & Controls */}
                <PrintStatus
                  printerId={selectedPrinter.id}
                  status={selectedStatus}
                />
                <PrintControls
                  printerId={selectedPrinter.id}
                  status={selectedStatus}
                />

                {/* AMS Panel */}
                <AMSPanel
                  printerId={selectedPrinter.id}
                  status={selectedStatus}
                />
              </div>

              {/* Right Column: Controls */}
              <div className="space-y-4">
                {/* Temperature Panel */}
                <TemperaturePanel
                  printerId={selectedPrinter.id}
                  status={selectedStatus}
                  nozzleCount={selectedPrinter.nozzle_count}
                />

                {/* Speed Control */}
                <SpeedControl
                  printerId={selectedPrinter.id}
                  status={selectedStatus}
                />

                {/* Fan Controls */}
                <FanControls
                  printerId={selectedPrinter.id}
                  status={selectedStatus}
                />

                {/* Light Toggle */}
                <LightToggle
                  printerId={selectedPrinter.id}
                  status={selectedStatus}
                />

                {/* Movement Controls */}
                <MovementControls
                  printerId={selectedPrinter.id}
                  status={selectedStatus}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
