import { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
  submenu?: ContextMenuItem[];
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<number | null>(null);
  const submenuTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('scroll', handleScroll, true);
      if (submenuTimeoutRef.current) {
        clearTimeout(submenuTimeoutRef.current);
      }
    };
  }, [onClose]);

  // Adjust position to keep menu in viewport
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      if (x + rect.width > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 8;
      }
      if (y + rect.height > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 8;
      }

      menuRef.current.style.left = `${adjustedX}px`;
      menuRef.current.style.top = `${adjustedY}px`;
    }
  }, [x, y]);

  const handleMouseEnterSubmenu = (index: number) => {
    if (submenuTimeoutRef.current) {
      clearTimeout(submenuTimeoutRef.current);
      submenuTimeoutRef.current = null;
    }
    setActiveSubmenu(index);
  };

  const handleMouseLeaveSubmenu = () => {
    submenuTimeoutRef.current = window.setTimeout(() => {
      setActiveSubmenu(null);
    }, 150);
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] bg-bambu-dark-secondary border border-bambu-dark-tertiary rounded-lg shadow-xl py-1"
      style={{ left: x, top: y }}
    >
      {items.map((item, index) => {
        if (item.divider) {
          return <div key={index} className="my-1 border-t border-bambu-dark-tertiary" />;
        }

        const hasSubmenu = item.submenu && item.submenu.length > 0;

        return (
          <div
            key={index}
            className="relative"
            onMouseEnter={() => hasSubmenu && handleMouseEnterSubmenu(index)}
            onMouseLeave={() => hasSubmenu && handleMouseLeaveSubmenu()}
          >
            <button
              onClick={() => {
                if (hasSubmenu) {
                  // Toggle submenu on click as well
                  setActiveSubmenu(activeSubmenu === index ? null : index);
                } else if (!item.disabled) {
                  item.onClick();
                  onClose();
                }
              }}
              disabled={item.disabled}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                item.disabled
                  ? 'text-bambu-gray cursor-not-allowed'
                  : item.danger
                  ? 'text-red-400 hover:bg-red-400/10'
                  : 'text-white hover:bg-bambu-dark-tertiary'
              } ${hasSubmenu && activeSubmenu === index ? 'bg-bambu-dark-tertiary' : ''}`}
            >
              {item.icon && <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">{item.icon}</span>}
              <span className="flex-1">{item.label}</span>
              {hasSubmenu && <ChevronRight className="w-4 h-4 text-bambu-gray" />}
            </button>
            {/* Submenu */}
            {hasSubmenu && activeSubmenu === index && (
              <div
                className="absolute left-full top-0 ml-1 min-w-[160px] bg-bambu-dark-secondary border border-bambu-dark-tertiary rounded-lg shadow-xl py-1 overflow-hidden max-h-[300px] overflow-y-auto z-[60]"
                onMouseEnter={() => {
                  if (submenuTimeoutRef.current) {
                    clearTimeout(submenuTimeoutRef.current);
                    submenuTimeoutRef.current = null;
                  }
                }}
                onMouseLeave={() => handleMouseLeaveSubmenu()}
              >
                {item.submenu!.map((subItem, subIndex) => (
                  <button
                    key={subIndex}
                    onClick={() => {
                      if (!subItem.disabled) {
                        subItem.onClick();
                        onClose();
                      }
                    }}
                    disabled={subItem.disabled}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                      subItem.disabled
                        ? 'text-bambu-gray cursor-not-allowed'
                        : subItem.danger
                        ? 'text-red-400 hover:bg-red-400/10'
                        : 'text-white hover:bg-bambu-dark-tertiary'
                    }`}
                  >
                    {subItem.icon && <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">{subItem.icon}</span>}
                    {subItem.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
