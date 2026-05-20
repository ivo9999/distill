"use client";

import { useState, useEffect } from "react";

interface DeviceType {
  isMobile: boolean;
  isDesktop: boolean;
  isTouchDevice: boolean;
}

/**
 * Hook to detect device type for disabling keyboard shortcuts on mobile/tablet devices.
 * Uses multiple signals: touch capability, screen size, and user agent as fallback.
 */
export function useDeviceType(): DeviceType {
  const [deviceType, setDeviceType] = useState<DeviceType>({
    isMobile: false,
    isDesktop: true,
    isTouchDevice: false,
  });

  useEffect(() => {
    const checkDeviceType = () => {
      // Check touch capability
      const isTouchDevice =
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0;

      // Check screen size (mobile breakpoint)
      const isSmallScreen = window.innerWidth < 768;

      // Check user agent as fallback for tablets with keyboards
      const mobileUserAgent = /Mobile|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

      // Consider mobile if: small screen OR (touch device AND mobile user agent)
      // This allows desktop touch screens to still use shortcuts
      const isMobile = isSmallScreen || (isTouchDevice && mobileUserAgent);

      setDeviceType({
        isMobile,
        isDesktop: !isMobile,
        isTouchDevice,
      });
    };

    checkDeviceType();

    // Re-check on resize (for responsive testing and orientation changes)
    window.addEventListener("resize", checkDeviceType);
    return () => window.removeEventListener("resize", checkDeviceType);
  }, []);

  return deviceType;
}

/**
 * Detects if the user is on macOS for showing the correct modifier key (Cmd vs Ctrl).
 */
export function useIsMac(): boolean {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMac(
      typeof navigator !== "undefined" &&
        /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
    );
  }, []);

  return isMac;
}
