import { useEffect, useRef, useCallback } from "react";
import { Audio } from "expo-av";
import { Platform } from "react-native";

// Bell sounds — alert for admin/pharmacy, soft for user
const ALERT_BELL = require("../assets/sounds/bell-alert.mp3");
const SOFT_BELL = require("../assets/sounds/bell-soft.mp3");

async function loadSound(source: any): Promise<Audio.Sound | null> {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
    });
    const { sound } = await Audio.Sound.createAsync(source, { volume: 1.0 });
    return sound;
  } catch {
    return null;
  }
}

export function useBell() {
  const alertRef = useRef<Audio.Sound | null>(null);
  const softRef = useRef<Audio.Sound | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [a, s] = await Promise.all([
        loadSound(ALERT_BELL),
        loadSound(SOFT_BELL),
      ]);
      if (!mounted) {
        a?.unloadAsync();
        s?.unloadAsync();
        return;
      }
      alertRef.current = a;
      softRef.current = s;
      loadedRef.current = true;
    })();
    return () => {
      mounted = false;
      alertRef.current?.unloadAsync();
      softRef.current?.unloadAsync();
    };
  }, []);

  const playAlertBell = useCallback(async () => {
    if (!alertRef.current) return;
    try {
      await alertRef.current.setPositionAsync(0);
      await alertRef.current.setVolumeAsync(Platform.OS === "web" ? 0.85 : 1.0);
      await alertRef.current.playAsync();
    } catch {}
  }, []);

  const playSoftBell = useCallback(async () => {
    if (!softRef.current) return;
    try {
      await softRef.current.setPositionAsync(0);
      await softRef.current.setVolumeAsync(Platform.OS === "web" ? 0.5 : 0.55);
      await softRef.current.playAsync();
    } catch {}
  }, []);

  return { playAlertBell, playSoftBell };
}
