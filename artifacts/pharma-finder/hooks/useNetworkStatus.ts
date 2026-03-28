import { useState, useEffect, useCallback } from "react";
import { Platform, AppState, AppStateStatus } from "react-native";

const API_BASE =
  Platform.OS === "web"
    ? "/api"
    : process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
      : "/api";

async function checkConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const resp = await fetch(`${API_BASE}/drug-prices/stats`, {
      method: "HEAD",
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    return resp.ok;
  } catch {
    return false;
  }
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isChecking, setIsChecking] = useState(false);

  const recheck = useCallback(async () => {
    setIsChecking(true);
    const online = await checkConnectivity();
    setIsOnline(online);
    setIsChecking(false);
    return online;
  }, []);

  useEffect(() => {
    recheck();

    if (Platform.OS === "web") {
      const handleOnline  = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener("online",  handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        window.removeEventListener("online",  handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }

    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") recheck();
    });
    const interval = setInterval(recheck, 30_000);

    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [recheck]);

  return { isOnline, isChecking, recheck };
}
