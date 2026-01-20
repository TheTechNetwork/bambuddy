import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Printer, Loader2, Calendar, Pencil } from 'lucide-react';
import { api } from '../../api/client';
import type { PrintQueueItemCreate, PrintQueueItemUpdate } from '../../api/client';
import { Card, CardContent } from '../Card';
import { Button } from '../Button';
import { useToast } from '../../contexts/ToastContext';
import { useFilamentMapping } from '../../hooks/useFilamentMapping';
import { isPlaceholderDate } from '../../utils/amsHelpers';
import { PrinterSelector } from './PrinterSelector';
import { PlateSelector } from './PlateSelector';
import { FilamentMapping } from './FilamentMapping';
import { PrintOptionsPanel } from './PrintOptions';
import { ScheduleOptionsPanel } from './ScheduleOptions';
import type {
  PrintModalProps,
  PrintOptions,
  ScheduleOptions,
  ScheduleType,
} from './types';
import { DEFAULT_PRINT_OPTIONS, DEFAULT_SCHEDULE_OPTIONS } from './types';

/**
 * Unified PrintModal component that handles three modes:
 * - 'reprint': Immediate print from archive
 * - 'add-to-queue': Schedule print to queue
 * - 'edit-queue-item': Edit existing queue item
 */
export function PrintModal({
  mode,
  archiveId,
  archiveName,
  queueItem,
  onClose,
  onSuccess,
}: PrintModalProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  // Initialize state based on mode
  const [selectedPrinter, setSelectedPrinter] = useState<number | null>(() => {
    if (mode === 'edit-queue-item' && queueItem) {
      return queueItem.printer_id;
    }
    return null;
  });

  const [selectedPlate, setSelectedPlate] = useState<number | null>(() => {
    if (mode === 'edit-queue-item' && queueItem) {
      return queueItem.plate_id;
    }
    return null;
  });

  const [printOptions, setPrintOptions] = useState<PrintOptions>(() => {
    if (mode === 'edit-queue-item' && queueItem) {
      return {
        bed_levelling: queueItem.bed_levelling ?? DEFAULT_PRINT_OPTIONS.bed_levelling,
        flow_cali: queueItem.flow_cali ?? DEFAULT_PRINT_OPTIONS.flow_cali,
        vibration_cali: queueItem.vibration_cali ?? DEFAULT_PRINT_OPTIONS.vibration_cali,
        layer_inspect: queueItem.layer_inspect ?? DEFAULT_PRINT_OPTIONS.layer_inspect,
        timelapse: queueItem.timelapse ?? DEFAULT_PRINT_OPTIONS.timelapse,
      };
    }
    return DEFAULT_PRINT_OPTIONS;
  });

  const [scheduleOptions, setScheduleOptions] = useState<ScheduleOptions>(() => {
    if (mode === 'edit-queue-item' && queueItem) {
      // Determine schedule type from queue item
      let scheduleType: ScheduleType = 'asap';
      if (queueItem.manual_start) {
        scheduleType = 'manual';
      } else if (queueItem.scheduled_time && !isPlaceholderDate(queueItem.scheduled_time)) {
        scheduleType = 'scheduled';
      }

      // Convert scheduled time to local datetime-local format
      let scheduledTime = '';
      if (queueItem.scheduled_time && !isPlaceholderDate(queueItem.scheduled_time)) {
        const date = new Date(queueItem.scheduled_time);
        scheduledTime = date.toISOString().slice(0, 16);
      }

      return {
        scheduleType,
        scheduledTime,
        requirePreviousSuccess: queueItem.require_previous_success,
        autoOffAfter: queueItem.auto_off_after,
      };
    }
    return DEFAULT_SCHEDULE_OPTIONS;
  });

  // Manual slot overrides: slot_id (1-indexed) -> globalTrayId
  const [manualMappings, setManualMappings] = useState<Record<number, number>>(() => {
    if (mode === 'edit-queue-item' && queueItem?.ams_mapping && Array.isArray(queueItem.ams_mapping)) {
      const mappings: Record<number, number> = {};
      queueItem.ams_mapping.forEach((globalTrayId, idx) => {
        if (globalTrayId !== -1) {
          mappings[idx + 1] = globalTrayId;
        }
      });
      return mappings;
    }
    return {};
  });

  // Track initial values for clearing mappings on change (edit mode only)
  const [initialPrinterId] = useState(() => (mode === 'edit-queue-item' && queueItem ? queueItem.printer_id : null));
  const [initialPlateId] = useState(() => (mode === 'edit-queue-item' && queueItem ? queueItem.plate_id : null));

  // Queries
  const { data: printers, isLoading: loadingPrinters } = useQuery({
    queryKey: ['printers'],
    queryFn: api.getPrinters,
  });

  const { data: platesData } = useQuery({
    queryKey: ['archive-plates', archiveId],
    queryFn: () => api.getArchivePlates(archiveId),
  });

  const { data: filamentReqs } = useQuery({
    queryKey: ['archive-filaments', archiveId, selectedPlate],
    queryFn: () => api.getArchiveFilamentRequirements(archiveId, selectedPlate ?? undefined),
    enabled: selectedPlate !== null || !platesData?.is_multi_plate,
  });

  const { data: printerStatus } = useQuery({
    queryKey: ['printer-status', selectedPrinter],
    queryFn: () => api.getPrinterStatus(selectedPrinter!),
    enabled: !!selectedPrinter,
  });

  // Get AMS mapping from hook
  const { amsMapping } = useFilamentMapping(filamentReqs, printerStatus, manualMappings);

  // Auto-select first plate for single-plate files
  useEffect(() => {
    if (platesData?.plates?.length === 1 && !selectedPlate) {
      setSelectedPlate(platesData.plates[0].index);
    }
  }, [platesData, selectedPlate]);

  // Auto-select first printer when only one available (add-to-queue mode)
  useEffect(() => {
    if (mode === 'add-to-queue' && printers?.length === 1 && !selectedPrinter) {
      setSelectedPrinter(printers[0].id);
    }
  }, [mode, printers, selectedPrinter]);

  // Clear manual mappings when printer or plate changes
  useEffect(() => {
    if (mode === 'edit-queue-item') {
      // Only clear if changed from initial values
      if (selectedPrinter !== initialPrinterId || selectedPlate !== initialPlateId) {
        setManualMappings({});
      }
    } else {
      // Always clear on change for non-edit modes
      setManualMappings({});
    }
  }, [mode, selectedPrinter, selectedPlate, initialPrinterId, initialPlateId]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const isMultiPlate = platesData?.is_multi_plate ?? false;
  const plates = platesData?.plates ?? [];

  // Reprint mutation
  const reprintMutation = useMutation({
    mutationFn: () => {
      if (!selectedPrinter) throw new Error('No printer selected');
      return api.reprintArchive(archiveId, selectedPrinter, {
        plate_id: selectedPlate ?? undefined,
        ams_mapping: amsMapping,
        ...printOptions,
      });
    },
    onSuccess: () => {
      showToast('Print started');
      onSuccess?.();
      onClose();
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to start print', 'error');
    },
  });

  // Add to queue mutation
  const addToQueueMutation = useMutation({
    mutationFn: (data: PrintQueueItemCreate) => api.addToQueue(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      showToast('Added to print queue');
      onSuccess?.();
      onClose();
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to add to queue', 'error');
    },
  });

  // Update queue item mutation
  const updateQueueMutation = useMutation({
    mutationFn: (data: PrintQueueItemUpdate) => api.updateQueueItem(queueItem!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      showToast('Queue item updated');
      onSuccess?.();
      onClose();
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to update queue item', 'error');
    },
  });

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();

    if (mode === 'reprint') {
      if (!selectedPrinter) {
        showToast('Please select a printer', 'error');
        return;
      }
      reprintMutation.mutate();
    } else if (mode === 'add-to-queue') {
      if (!selectedPrinter) {
        showToast('Please select a printer', 'error');
        return;
      }

      const data: PrintQueueItemCreate = {
        printer_id: selectedPrinter,
        archive_id: archiveId,
        require_previous_success: scheduleOptions.requirePreviousSuccess,
        auto_off_after: scheduleOptions.autoOffAfter,
        manual_start: scheduleOptions.scheduleType === 'manual',
        ams_mapping: amsMapping,
        plate_id: selectedPlate,
        ...printOptions,
      };

      if (scheduleOptions.scheduleType === 'scheduled' && scheduleOptions.scheduledTime) {
        data.scheduled_time = new Date(scheduleOptions.scheduledTime).toISOString();
      }

      addToQueueMutation.mutate(data);
    } else if (mode === 'edit-queue-item') {
      const data: PrintQueueItemUpdate = {
        printer_id: selectedPrinter,
        require_previous_success: scheduleOptions.requirePreviousSuccess,
        auto_off_after: scheduleOptions.autoOffAfter,
        manual_start: scheduleOptions.scheduleType === 'manual',
        ams_mapping: amsMapping,
        plate_id: selectedPlate,
        ...printOptions,
      };

      if (scheduleOptions.scheduleType === 'scheduled' && scheduleOptions.scheduledTime) {
        data.scheduled_time = new Date(scheduleOptions.scheduledTime).toISOString();
      } else {
        data.scheduled_time = null;
      }

      updateQueueMutation.mutate(data);
    }
  };

  const isPending =
    reprintMutation.isPending || addToQueueMutation.isPending || updateQueueMutation.isPending;

  const canSubmit = useMemo(() => {
    // For edit mode, printer can be null (unassigned)
    if (mode === 'edit-queue-item') {
      return !isPending && (printers?.length ?? 0) > 0;
    }
    // For reprint and add-to-queue, need a selected printer
    if (!selectedPrinter) return false;
    // For multi-plate files, need a selected plate
    if (isMultiPlate && !selectedPlate) return false;
    return !isPending;
  }, [mode, selectedPrinter, isMultiPlate, selectedPlate, isPending, printers]);

  // Modal title and action button text based on mode
  const modalConfig = {
    reprint: {
      title: 'Re-print',
      icon: Printer,
      submitText: 'Print',
      submitIcon: Printer,
      loadingText: 'Sending...',
    },
    'add-to-queue': {
      title: 'Schedule Print',
      icon: Calendar,
      submitText: 'Add to Queue',
      submitIcon: Calendar,
      loadingText: 'Adding...',
    },
    'edit-queue-item': {
      title: 'Edit Queue Item',
      icon: Pencil,
      submitText: 'Save Changes',
      submitIcon: Pencil,
      loadingText: 'Saving...',
    },
  }[mode];

  const TitleIcon = modalConfig.icon;
  const SubmitIcon = modalConfig.submitIcon;

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <CardContent className={mode === 'reprint' ? '' : 'p-0'}>
          {/* Header */}
          <div
            className={`flex items-center justify-between ${
              mode === 'reprint' ? 'mb-4' : 'p-4 border-b border-bambu-dark-tertiary'
            }`}
          >
            <div className="flex items-center gap-2">
              <TitleIcon className="w-5 h-5 text-bambu-green" />
              <h2 className="text-lg font-semibold text-white">{modalConfig.title}</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className={mode === 'reprint' ? '' : 'p-4 space-y-4'}>
            {/* Archive name */}
            <p className={`text-sm text-bambu-gray ${mode === 'reprint' ? 'mb-4' : ''}`}>
              {mode === 'reprint' ? (
                <>
                  Send <span className="text-white">{archiveName}</span> to a printer
                </>
              ) : (
                <>
                  <span className="block text-bambu-gray mb-1">Print Job</span>
                  <span className="text-white font-medium truncate block">{archiveName}</span>
                </>
              )}
            </p>

            {/* Printer selection */}
            <PrinterSelector
              printers={printers || []}
              selectedPrinterId={selectedPrinter}
              onSelect={setSelectedPrinter}
              isLoading={loadingPrinters}
              allowUnassigned={mode === 'edit-queue-item'}
            />

            {/* Plate selection */}
            <PlateSelector
              plates={plates}
              isMultiPlate={isMultiPlate}
              selectedPlate={selectedPlate}
              onSelect={setSelectedPlate}
            />

            {/* Filament mapping - show when printer selected and plate ready */}
            {selectedPrinter && (isMultiPlate ? selectedPlate !== null : true) && (
              <FilamentMapping
                printerId={selectedPrinter}
                archiveId={archiveId}
                selectedPlate={selectedPlate}
                isMultiPlate={isMultiPlate}
                manualMappings={manualMappings}
                onManualMappingChange={setManualMappings}
              />
            )}

            {/* Print options */}
            {(mode === 'reprint' || selectedPrinter) && (
              <PrintOptionsPanel options={printOptions} onChange={setPrintOptions} />
            )}

            {/* Schedule options - only for queue modes */}
            {mode !== 'reprint' && (
              <ScheduleOptionsPanel options={scheduleOptions} onChange={setScheduleOptions} />
            )}

            {/* Error message */}
            {(reprintMutation.isError || addToQueueMutation.isError || updateQueueMutation.isError) && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-sm text-red-400">
                {((reprintMutation.error || addToQueueMutation.error || updateQueueMutation.error) as Error)?.message ||
                  'Failed to complete operation'}
              </div>
            )}

            {/* Actions */}
            <div className={`flex gap-3 ${mode === 'reprint' ? '' : 'pt-2'}`}>
              <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="flex-1"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {modalConfig.loadingText}
                  </>
                ) : (
                  <>
                    <SubmitIcon className="w-4 h-4" />
                    {modalConfig.submitText}
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// Re-export types for convenience
export type { PrintModalProps, PrintModalMode } from './types';
