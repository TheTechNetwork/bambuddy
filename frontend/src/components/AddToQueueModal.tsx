import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, X, AlertCircle, Power, Hand, Check, AlertTriangle, Circle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../api/client';
import type { PrintQueueItemCreate } from '../api/client';
import { Card, CardContent } from './Card';
import { Button } from './Button';
import { useToast } from '../contexts/ToastContext';

// Bambu Lab filament color mapping by tray_id_name (subset of most common)
const BAMBU_COLORS: Record<string, string> = {
  'A00-W1': 'Jade White', 'A00-Y2': 'Sunflower Yellow', 'A00-R0': 'Red', 'A00-K0': 'Black',
  'A00-G1': 'Bambu Green', 'A00-B3': 'Cobalt Blue', 'A00-D0': 'Gray', 'A00-D3': 'Dark Gray',
  'A01-W2': 'Ivory White', 'A01-R1': 'Scarlet Red', 'A01-G1': 'Grass Green', 'A01-B3': 'Marine Blue',
  'G02-W0': 'White', 'G02-K0': 'Black', 'G02-R0': 'Red', 'G02-D0': 'Gray', 'G02-B0': 'Blue',
  'B00-W0': 'White', 'B00-K0': 'Black', 'B00-R0': 'Red',
};

// Fallback color codes
const COLOR_CODE_FALLBACK: Record<string, string> = {
  'W0': 'White', 'W1': 'Jade White', 'K0': 'Black', 'R0': 'Red', 'B0': 'Blue',
  'G0': 'Green', 'G1': 'Green', 'Y0': 'Yellow', 'Y2': 'Yellow', 'D0': 'Gray',
  'D1': 'Silver', 'D3': 'Dark Gray', 'A0': 'Orange', 'P0': 'Purple', 'N0': 'Brown',
};

// Get color name from Bambu tray_id_name or hex
function getColorName(trayIdName: string | null | undefined, hexColor: string): string {
  // Try exact Bambu lookup first
  if (trayIdName && BAMBU_COLORS[trayIdName]) {
    return BAMBU_COLORS[trayIdName];
  }
  // Try color code fallback (e.g., "A00-Y2" -> "Y2")
  if (trayIdName) {
    const parts = trayIdName.split('-');
    if (parts.length >= 2 && COLOR_CODE_FALLBACK[parts[1]]) {
      return COLOR_CODE_FALLBACK[parts[1]];
    }
  }
  // Fall back to hex-based name
  return hexToColorName(hexColor);
}

// Convert hex color to basic color name using HSL
function hexToColorName(hex: string | null | undefined): string {
  if (!hex || hex.length < 6) return 'Unknown';
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const rNorm = r / 255, gNorm = g / 255, bNorm = b / 255;
    if (max === rNorm) h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6;
    else if (max === gNorm) h = ((bNorm - rNorm) / d + 2) / 6;
    else h = ((rNorm - gNorm) / d + 4) / 6;
  }
  h = h * 360;

  if (l < 0.15) return 'Black';
  if (l > 0.85) return 'White';
  if (s < 0.15) {
    if (l < 0.4) return 'Dark Gray';
    if (l > 0.6) return 'Light Gray';
    return 'Gray';
  }
  if (h < 15 || h >= 345) return 'Red';
  if (h < 45) return 'Orange';
  if (h < 70) return 'Yellow';
  if (h < 150) return 'Green';
  if (h < 200) return 'Cyan';
  if (h < 260) return 'Blue';
  if (h < 290) return 'Purple';
  if (h < 345) return 'Pink';
  return 'Unknown';
}

interface AddToQueueModalProps {
  archiveId: number;
  archiveName: string;
  onClose: () => void;
}

export function AddToQueueModal({ archiveId, archiveName, onClose }: AddToQueueModalProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [printerId, setPrinterId] = useState<number | null>(null);
  const [scheduleType, setScheduleType] = useState<'asap' | 'scheduled' | 'manual'>('asap');
  const [scheduledTime, setScheduledTime] = useState('');
  const [requirePreviousSuccess, setRequirePreviousSuccess] = useState(false);
  const [autoOffAfter, setAutoOffAfter] = useState(false);
  const [showFilamentMapping, setShowFilamentMapping] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Manual slot overrides: slot_id (1-indexed) -> globalTrayId
  const [manualMappings, setManualMappings] = useState<Record<number, number>>({});

  const { data: printers } = useQuery({
    queryKey: ['printers'],
    queryFn: () => api.getPrinters(),
  });

  // Fetch filament requirements from the archived 3MF
  const { data: filamentReqs } = useQuery({
    queryKey: ['archive-filaments', archiveId],
    queryFn: () => api.getArchiveFilamentRequirements(archiveId),
  });

  // Fetch printer status when a printer is selected
  const { data: printerStatus } = useQuery({
    queryKey: ['printer-status', printerId],
    queryFn: () => api.getPrinterStatus(printerId!),
    enabled: !!printerId,
  });

  // Set default printer if only one available
  useEffect(() => {
    if (printers?.length === 1 && !printerId) {
      setPrinterId(printers[0].id);
    }
  }, [printers, printerId]);

  // Clear manual mappings when printer changes
  useEffect(() => {
    setManualMappings({});
  }, [printerId]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Helper to normalize color format (API returns "RRGGBBAA", 3MF uses "#RRGGBB")
  const normalizeColor = (color: string | null | undefined): string => {
    if (!color) return '#808080';
    const hex = color.replace('#', '').substring(0, 6);
    return `#${hex}`;
  };

  // Helper to format slot label for display
  const formatSlotLabel = (amsId: number, trayId: number, isHt: boolean, isExternal: boolean): string => {
    if (isExternal) return 'External';
    const letter = String.fromCharCode(65 + (amsId >= 128 ? amsId - 128 : amsId));
    if (isHt) return `HT-${letter}`;
    return `AMS-${letter} Slot ${trayId + 1}`;
  };

  // Calculate global tray ID for MQTT command
  const getGlobalTrayId = (amsId: number, trayId: number, isExternal: boolean): number => {
    if (isExternal) return 254;
    return amsId * 4 + trayId;
  };

  // Build a list of all loaded filaments from printer's AMS/HT/External
  const loadedFilaments = useMemo(() => {
    const filaments: Array<{
      type: string;
      color: string;
      colorName: string;
      amsId: number;
      trayId: number;
      isHt: boolean;
      isExternal: boolean;
      label: string;
      globalTrayId: number;
    }> = [];

    printerStatus?.ams?.forEach((amsUnit) => {
      const isHt = amsUnit.tray.length === 1;
      amsUnit.tray.forEach((tray) => {
        if (tray.tray_type) {
          const color = normalizeColor(tray.tray_color);
          filaments.push({
            type: tray.tray_type,
            color,
            colorName: getColorName(tray.tray_id_name, color),
            amsId: amsUnit.id,
            trayId: tray.id,
            isHt,
            isExternal: false,
            label: formatSlotLabel(amsUnit.id, tray.id, isHt, false),
            globalTrayId: getGlobalTrayId(amsUnit.id, tray.id, false),
          });
        }
      });
    });

    if (printerStatus?.vt_tray?.tray_type) {
      const color = normalizeColor(printerStatus.vt_tray.tray_color);
      filaments.push({
        type: printerStatus.vt_tray.tray_type,
        color,
        colorName: getColorName(printerStatus.vt_tray.tray_id_name, color),
        amsId: -1,
        trayId: 0,
        isHt: false,
        isExternal: true,
        label: 'External',
        globalTrayId: 254,
      });
    }

    return filaments;
  }, [printerStatus]);

  // Compare required filaments with loaded filaments
  const filamentComparison = useMemo(() => {
    if (!filamentReqs?.filaments || filamentReqs.filaments.length === 0) return [];

    const normalizeColorForCompare = (color: string | undefined): string => {
      if (!color) return '';
      return color.replace('#', '').toLowerCase().substring(0, 6);
    };

    const colorsAreSimilar = (color1: string | undefined, color2: string | undefined, threshold = 40): boolean => {
      const hex1 = normalizeColorForCompare(color1);
      const hex2 = normalizeColorForCompare(color2);
      if (!hex1 || !hex2 || hex1.length < 6 || hex2.length < 6) return false;

      const r1 = parseInt(hex1.substring(0, 2), 16);
      const g1 = parseInt(hex1.substring(2, 4), 16);
      const b1 = parseInt(hex1.substring(4, 6), 16);
      const r2 = parseInt(hex2.substring(0, 2), 16);
      const g2 = parseInt(hex2.substring(2, 4), 16);
      const b2 = parseInt(hex2.substring(4, 6), 16);

      return Math.abs(r1 - r2) <= threshold &&
             Math.abs(g1 - g2) <= threshold &&
             Math.abs(b1 - b2) <= threshold;
    };

    const usedTrayIds = new Set<number>(Object.values(manualMappings));

    return filamentReqs.filaments.map((req) => {
      const slotId = req.slot_id || 0;

      // Check if there's a manual override for this slot
      if (slotId > 0 && manualMappings[slotId] !== undefined) {
        const manualTrayId = manualMappings[slotId];
        const manualLoaded = loadedFilaments.find((f) => f.globalTrayId === manualTrayId);

        if (manualLoaded) {
          const typeMatch = manualLoaded.type?.toUpperCase() === req.type?.toUpperCase();
          const colorMatch = normalizeColorForCompare(manualLoaded.color) === normalizeColorForCompare(req.color) ||
                            colorsAreSimilar(manualLoaded.color, req.color);

          let status: 'match' | 'type_only' | 'mismatch' | 'empty';
          if (typeMatch && colorMatch) {
            status = 'match';
          } else if (typeMatch) {
            status = 'type_only';
          } else {
            status = 'mismatch';
          }

          return {
            ...req,
            loaded: manualLoaded,
            hasFilament: true,
            typeMatch,
            colorMatch,
            status,
            isManual: true,
          };
        }
      }

      // Auto-match
      const exactMatch = loadedFilaments.find(
        (f) => !usedTrayIds.has(f.globalTrayId) &&
               f.type?.toUpperCase() === req.type?.toUpperCase() &&
               normalizeColorForCompare(f.color) === normalizeColorForCompare(req.color)
      );
      const similarMatch = !exactMatch && loadedFilaments.find(
        (f) => !usedTrayIds.has(f.globalTrayId) &&
               f.type?.toUpperCase() === req.type?.toUpperCase() &&
               colorsAreSimilar(f.color, req.color)
      );
      const typeOnlyMatch = !exactMatch && !similarMatch && loadedFilaments.find(
        (f) => !usedTrayIds.has(f.globalTrayId) &&
               f.type?.toUpperCase() === req.type?.toUpperCase()
      );
      const loaded = exactMatch || similarMatch || typeOnlyMatch || undefined;

      if (loaded) {
        usedTrayIds.add(loaded.globalTrayId);
      }

      const hasFilament = !!loaded;
      const typeMatch = hasFilament;
      const colorMatch = !!exactMatch || !!similarMatch;

      let status: 'match' | 'type_only' | 'mismatch' | 'empty';
      if (exactMatch || similarMatch) {
        status = 'match';
      } else if (typeOnlyMatch) {
        status = 'type_only';
      } else {
        status = 'mismatch';
      }

      return {
        ...req,
        loaded,
        hasFilament,
        typeMatch,
        colorMatch,
        status,
        isManual: false,
      };
    });
  }, [filamentReqs, loadedFilaments, manualMappings]);

  // Build AMS mapping array
  const amsMapping = useMemo(() => {
    if (filamentComparison.length === 0) return undefined;

    const maxSlotId = Math.max(...filamentComparison.map((f) => f.slot_id || 0));
    if (maxSlotId <= 0) return undefined;

    const mapping = new Array(maxSlotId).fill(-1);

    filamentComparison.forEach((f) => {
      if (f.slot_id && f.slot_id > 0) {
        mapping[f.slot_id - 1] = f.loaded?.globalTrayId ?? -1;
      }
    });

    return mapping;
  }, [filamentComparison]);

  const hasFilamentReqs = filamentReqs?.filaments && filamentReqs.filaments.length > 0;

  const addMutation = useMutation({
    mutationFn: (data: PrintQueueItemCreate) => api.addToQueue(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      showToast('Added to print queue');
      onClose();
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to add to queue', 'error');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!printerId) {
      showToast('Please select a printer', 'error');
      return;
    }

    const data: PrintQueueItemCreate = {
      printer_id: printerId,
      archive_id: archiveId,
      require_previous_success: requirePreviousSuccess,
      auto_off_after: autoOffAfter,
      manual_start: scheduleType === 'manual',
      ams_mapping: amsMapping,
    };

    if (scheduleType === 'scheduled' && scheduledTime) {
      data.scheduled_time = new Date(scheduledTime).toISOString();
    }

    addMutation.mutate(data);
  };

  // Get minimum datetime (now + 1 minute)
  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1);
    return now.toISOString().slice(0, 16);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-bambu-dark-tertiary">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-bambu-green" />
              <h2 className="text-xl font-semibold text-white">Schedule Print</h2>
            </div>
            <button
              onClick={onClose}
              className="text-bambu-gray hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Archive name */}
            <div>
              <label className="block text-sm text-bambu-gray mb-1">Print Job</label>
              <p className="text-white font-medium truncate">{archiveName}</p>
            </div>

            {/* Printer selection */}
            <div>
              <label className="block text-sm text-bambu-gray mb-1">Printer</label>
              {printers?.length === 0 ? (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  No printers configured
                </div>
              ) : (
                <select
                  className="w-full px-3 py-2 bg-bambu-dark border border-bambu-dark-tertiary rounded-lg text-white focus:border-bambu-green focus:outline-none"
                  value={printerId || ''}
                  onChange={(e) => setPrinterId(e.target.value ? Number(e.target.value) : null)}
                  required
                >
                  <option value="">Select printer...</option>
                  {printers?.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Filament Mapping Section */}
            {printerId && hasFilamentReqs && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowFilamentMapping(!showFilamentMapping)}
                  className="flex items-center gap-2 text-sm text-bambu-gray hover:text-white transition-colors w-full"
                >
                  <Circle className="w-4 h-4" fill={filamentComparison.some(f => f.status === 'mismatch') ? '#f97316' : filamentComparison.some(f => f.status === 'type_only') ? '#facc15' : '#00ae42'} stroke="none" />
                  <span>Filament Mapping</span>
                  {filamentComparison.some(f => f.status === 'mismatch') ? (
                    <span className="text-xs text-orange-400">(Type not found)</span>
                  ) : filamentComparison.some(f => f.status === 'type_only') ? (
                    <span className="text-xs text-yellow-400">(Color mismatch)</span>
                  ) : (
                    <span className="text-xs text-bambu-green">(Ready)</span>
                  )}
                  {showFilamentMapping ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
                </button>

                {showFilamentMapping && (
                  <div className="mt-2 bg-bambu-dark rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-bambu-gray">Click to change slot assignment</span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!printerId) return;
                          setIsRefreshing(true);
                          try {
                            await api.refreshPrinterStatus(printerId);
                            await new Promise((r) => setTimeout(r, 500));
                            await queryClient.refetchQueries({ queryKey: ['printer-status', printerId] });
                          } finally {
                            setIsRefreshing(false);
                          }
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 text-xs rounded border border-bambu-gray/30 hover:border-bambu-gray hover:bg-bambu-dark-tertiary transition-colors text-bambu-gray hover:text-white"
                        disabled={isRefreshing}
                      >
                        <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                        <span>Re-read</span>
                      </button>
                    </div>
                    {filamentComparison.map((item, idx) => (
                      <div
                        key={idx}
                        className="grid items-center gap-2 text-xs"
                        style={{ gridTemplateColumns: '16px 1fr auto 1fr 16px' }}
                      >
                        <span title={`Required: ${item.color}`}>
                          <Circle className="w-3 h-3" fill={item.color} stroke={item.color} />
                        </span>
                        <span className="text-white truncate">
                          {item.type} <span className="text-bambu-gray">({item.used_grams}g)</span>
                        </span>
                        <span className="text-bambu-gray">→</span>
                        <select
                          value={item.loaded?.globalTrayId ?? ''}
                          onChange={(e) => {
                            const slotId = item.slot_id || 0;
                            if (slotId > 0) {
                              const value = e.target.value;
                              if (value === '') {
                                setManualMappings((prev) => {
                                  const next = { ...prev };
                                  delete next[slotId];
                                  return next;
                                });
                              } else {
                                setManualMappings((prev) => ({
                                  ...prev,
                                  [slotId]: parseInt(value, 10),
                                }));
                              }
                            }
                          }}
                          className={`flex-1 px-2 py-1 rounded border text-xs bg-bambu-dark-secondary focus:outline-none focus:ring-1 focus:ring-bambu-green ${
                            item.status === 'match'
                              ? 'border-bambu-green/50 text-bambu-green'
                              : item.status === 'type_only'
                              ? 'border-yellow-400/50 text-yellow-400'
                              : 'border-orange-400/50 text-orange-400'
                          } ${item.isManual ? 'ring-1 ring-blue-400/50' : ''}`}
                          title={item.isManual ? 'Manually selected' : 'Auto-matched'}
                        >
                          <option value="" className="bg-bambu-dark text-bambu-gray">
                            -- Select slot --
                          </option>
                          {loadedFilaments.map((f) => (
                            <option
                              key={f.globalTrayId}
                              value={f.globalTrayId}
                              className="bg-bambu-dark text-white"
                            >
                              {f.label}: {f.type} ({f.colorName})
                            </option>
                          ))}
                        </select>
                        {item.status === 'match' ? (
                          <Check className="w-3 h-3 text-bambu-green" />
                        ) : item.status === 'type_only' ? (
                          <span title="Same type, different color">
                            <AlertTriangle className="w-3 h-3 text-yellow-400" />
                          </span>
                        ) : (
                          <span title="Filament type not loaded">
                            <AlertTriangle className="w-3 h-3 text-orange-400" />
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Schedule type */}
            <div>
              <label className="block text-sm text-bambu-gray mb-2">When to print</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`flex-1 px-2 py-2 rounded-lg border text-sm flex items-center justify-center gap-1.5 transition-colors ${
                    scheduleType === 'asap'
                      ? 'bg-bambu-green border-bambu-green text-white'
                      : 'bg-bambu-dark border-bambu-dark-tertiary text-bambu-gray hover:text-white'
                  }`}
                  onClick={() => setScheduleType('asap')}
                >
                  <Clock className="w-4 h-4" />
                  ASAP
                </button>
                <button
                  type="button"
                  className={`flex-1 px-2 py-2 rounded-lg border text-sm flex items-center justify-center gap-1.5 transition-colors ${
                    scheduleType === 'scheduled'
                      ? 'bg-bambu-green border-bambu-green text-white'
                      : 'bg-bambu-dark border-bambu-dark-tertiary text-bambu-gray hover:text-white'
                  }`}
                  onClick={() => setScheduleType('scheduled')}
                >
                  <Calendar className="w-4 h-4" />
                  Scheduled
                </button>
                <button
                  type="button"
                  className={`flex-1 px-2 py-2 rounded-lg border text-sm flex items-center justify-center gap-1.5 transition-colors ${
                    scheduleType === 'manual'
                      ? 'bg-bambu-green border-bambu-green text-white'
                      : 'bg-bambu-dark border-bambu-dark-tertiary text-bambu-gray hover:text-white'
                  }`}
                  onClick={() => setScheduleType('manual')}
                >
                  <Hand className="w-4 h-4" />
                  Queue Only
                </button>
              </div>
            </div>

            {/* Scheduled time input */}
            {scheduleType === 'scheduled' && (
              <div>
                <label className="block text-sm text-bambu-gray mb-1">Date & Time</label>
                <input
                  type="datetime-local"
                  className="w-full px-3 py-2 bg-bambu-dark border border-bambu-dark-tertiary rounded-lg text-white focus:border-bambu-green focus:outline-none"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  min={getMinDateTime()}
                  required
                />
              </div>
            )}

            {/* Require previous success */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="requirePrevious"
                checked={requirePreviousSuccess}
                onChange={(e) => setRequirePreviousSuccess(e.target.checked)}
                className="rounded border-bambu-dark-tertiary bg-bambu-dark text-bambu-green focus:ring-bambu-green"
              />
              <label htmlFor="requirePrevious" className="text-sm text-bambu-gray">
                Only start if previous print succeeded
              </label>
            </div>

            {/* Auto power off */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoOffAfter"
                checked={autoOffAfter}
                onChange={(e) => setAutoOffAfter(e.target.checked)}
                className="rounded border-bambu-dark-tertiary bg-bambu-dark text-bambu-green focus:ring-bambu-green"
              />
              <label htmlFor="autoOffAfter" className="text-sm text-bambu-gray flex items-center gap-1">
                <Power className="w-3.5 h-3.5" />
                Power off printer when done
              </label>
            </div>

            {/* Help text */}
            <p className="text-xs text-bambu-gray">
              {scheduleType === 'asap'
                ? 'Print will start as soon as the printer is idle.'
                : scheduleType === 'scheduled'
                ? 'Print will start at the scheduled time if the printer is idle. If busy, it will wait until the printer becomes available.'
                : 'Print will be staged but won\'t start automatically. Use the Start button to release it to the queue.'}
            </p>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={addMutation.isPending || !printerId || printers?.length === 0}
              >
                {addMutation.isPending ? 'Adding...' : 'Add to Queue'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
