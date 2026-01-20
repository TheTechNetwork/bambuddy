import { Printer as PrinterIcon, Loader2, AlertCircle } from 'lucide-react';
import type { PrinterSelectorProps } from './types';

/**
 * Printer selection component with two modes:
 * - Grid mode (default): Shows printers as selectable cards
 * - Dropdown mode: Shows printers in a select dropdown (used when allowUnassigned is true)
 */
export function PrinterSelector({
  printers,
  selectedPrinterId,
  onSelect,
  isLoading = false,
  allowUnassigned = false,
}: PrinterSelectorProps) {
  const activePrinters = printers.filter((p) => p.is_active);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 text-bambu-green animate-spin" />
      </div>
    );
  }

  // Use dropdown mode for edit scenarios (allows unassigning printer)
  if (allowUnassigned) {
    return (
      <div>
        <label className="block text-sm text-bambu-gray mb-1">Printer</label>
        {printers.length === 0 ? (
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            No printers configured
          </div>
        ) : (
          <>
            <select
              className={`w-full px-3 py-2 bg-bambu-dark border rounded-lg text-white focus:border-bambu-green focus:outline-none ${
                selectedPrinterId === null ? 'border-orange-400' : 'border-bambu-dark-tertiary'
              }`}
              value={selectedPrinterId ?? ''}
              onChange={(e) => onSelect(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">-- Select a printer --</option>
              {printers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {selectedPrinterId === null && (
              <p className="text-xs text-orange-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Assign a printer to enable printing
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  // Grid mode for reprint/add-to-queue (only active printers)
  if (activePrinters.length === 0) {
    return (
      <div className="text-center py-8 text-bambu-gray">No active printers available</div>
    );
  }

  return (
    <div className="space-y-2 mb-6">
      {activePrinters.map((printer) => (
        <button
          key={printer.id}
          type="button"
          onClick={() => onSelect(printer.id)}
          className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
            selectedPrinterId === printer.id
              ? 'border-bambu-green bg-bambu-green/10'
              : 'border-bambu-dark-tertiary bg-bambu-dark hover:border-bambu-gray'
          }`}
        >
          <div
            className={`p-2 rounded-lg ${
              selectedPrinterId === printer.id ? 'bg-bambu-green/20' : 'bg-bambu-dark-tertiary'
            }`}
          >
            <PrinterIcon
              className={`w-5 h-5 ${
                selectedPrinterId === printer.id ? 'text-bambu-green' : 'text-bambu-gray'
              }`}
            />
          </div>
          <div className="text-left">
            <p className="text-white font-medium">{printer.name}</p>
            <p className="text-xs text-bambu-gray">
              {printer.model || 'Unknown model'} • {printer.ip_address}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
