import { useState, useRef } from 'react';
import { api } from '../../api/client';
import { Camera, CameraOff, Maximize2, RefreshCw, Loader2 } from 'lucide-react';

interface CameraFeedProps {
  printerId: number;
  isConnected: boolean;
}

export function CameraFeed({ printerId, isConnected }: CameraFeedProps) {
  const [streamEnabled, setStreamEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const streamUrl = api.getCameraStreamUrl(printerId, 10);

  const handleToggleStream = () => {
    if (streamEnabled) {
      setStreamEnabled(false);
      setError(null);
    } else {
      setIsLoading(true);
      setError(null);
      setStreamEnabled(true);
    }
  };

  const handleImageLoad = () => {
    setIsLoading(false);
    setError(null);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setError('Failed to load camera stream');
  };

  const handleFullscreen = () => {
    if (imgRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        imgRef.current.requestFullscreen();
      }
    }
  };

  const handleRefresh = () => {
    setStreamEnabled(false);
    setTimeout(() => {
      setIsLoading(true);
      setStreamEnabled(true);
    }, 100);
  };

  return (
    <div className="bg-bambu-dark-secondary rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-bambu-dark-tertiary">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-bambu-gray" />
          <span className="text-sm font-medium">Camera</span>
        </div>
        <div className="flex items-center gap-2">
          {streamEnabled && (
            <>
              <button
                onClick={handleRefresh}
                className="p-1.5 rounded hover:bg-bambu-dark-tertiary text-bambu-gray hover:text-white transition-colors"
                title="Refresh stream"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={handleFullscreen}
                className="p-1.5 rounded hover:bg-bambu-dark-tertiary text-bambu-gray hover:text-white transition-colors"
                title="Fullscreen"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={handleToggleStream}
            disabled={!isConnected}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              streamEnabled
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-bambu-green/20 text-bambu-green hover:bg-bambu-green/30'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {streamEnabled ? 'Stop' : 'Start'}
          </button>
        </div>
      </div>

      <div className="relative aspect-video bg-bambu-dark">
        {!streamEnabled ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-bambu-gray">
            <CameraOff className="w-12 h-12 mb-2" />
            <span className="text-sm">
              {isConnected ? 'Click Start to view camera' : 'Printer not connected'}
            </span>
          </div>
        ) : (
          <>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-bambu-dark">
                <Loader2 className="w-8 h-8 animate-spin text-bambu-green" />
              </div>
            )}
            {error ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400">
                <CameraOff className="w-12 h-12 mb-2" />
                <span className="text-sm">{error}</span>
                <button
                  onClick={handleRefresh}
                  className="mt-2 text-xs text-bambu-green hover:underline"
                >
                  Retry
                </button>
              </div>
            ) : (
              <img
                ref={imgRef}
                src={streamUrl}
                alt="Camera stream"
                className="w-full h-full object-contain"
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
