import { motion, AnimatePresence } from 'framer-motion';
import React from 'react';

export function BottomSheet({ isOpen, onClose, title, children }) {
  // Lock background scroll while a sheet is open so the dashboard/workspace
  // behind it can't shift underneath a touch drag on mobile.
  React.useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  // Close on Escape for keyboard/desktop users.
  React.useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
        >
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(28,27,25,0.6)' }}
          />

                    <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", damping: 28, stiffness: 340 }}
            style={{ 
              position: 'relative', 
              width: '100%', 
              maxWidth: '420px', 
              zIndex: 10, 
              margin: 'auto',
              backgroundColor: 'var(--paper)',
              color: 'var(--ink)',
              border: '1px solid var(--line)',
              borderRadius: '12px',
              padding: '22px',
              boxShadow: '0 16px 40px rgba(0,0,0,0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            {title && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: '18px', fontWeight: 600, margin: 0 }}>
                  {title}
                </h3>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--graphite)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' }}
                >
                  ✕
                </motion.button>
              </div>
            )}

            {/* Body Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}