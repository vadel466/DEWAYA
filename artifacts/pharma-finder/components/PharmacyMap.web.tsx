import React, { useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";

interface Pharmacy {
  id: string;
  name: string;
  nameAr: string | null;
  address: string;
  addressAr: string | null;
  lat: number | null;
  lon: number | null;
  distance?: number | null;
}

interface PharmacyMapProps {
  pharmacies: Pharmacy[];
  userLat: number | null;
  userLon: number | null;
  language: string;
}

export function PharmacyMap({ pharmacies, userLat, userLon, language }: PharmacyMapProps) {
  const containerRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const isRTL = language === "ar";
    const defaultLat = userLat ?? 18.0858;
    const defaultLon = userLon ?? -15.9785;
    const zoom = userLat ? 15 : 13;

    const markers = pharmacies
      .filter((p) => p.lat && p.lon)
      .map((p, i) => {
        const label = isRTL ? (p.nameAr || p.name) : p.name;
        const addr = isRTL ? (p.addressAr || p.address) : p.address;
        const gmapsUrl = `https://maps.google.com/?q=${p.lat},${p.lon}`;
        const isFirst = i === 0;
        const bg = isFirst ? "#1BB580" : "#0A7EA4";
        const linkLabel = isRTL ? "افتح في خرائط غوغل ↗" : "Ouvrir dans Google Maps ↗";
        return `L.marker([${p.lat}, ${p.lon}], {
          icon: L.divIcon({
            html: '<div style="background:${bg};color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35)">${i + 1}</div>',
            iconSize: [28, 28], iconAnchor: [14, 14], className: ''
          })
        }).addTo(map).bindPopup('<div style="font-family:sans-serif;min-width:160px;direction:${isRTL ? "rtl" : "ltr"}"><b style="font-size:13px;color:#222">${label.replace(/'/g, "\\'")}</b><br/><span style="font-size:11px;color:#666">${addr.replace(/'/g, "\\'")}</span><br/><a href="${gmapsUrl}" target="_blank" style="font-size:11px;color:#0A7EA4;font-weight:600;text-decoration:none;display:inline-block;margin-top:5px">${linkLabel}</a></div>');`;
      })
      .join("\n");

    const userMarker = userLat && userLon
      ? `L.circleMarker([${userLat}, ${userLon}], {
          color: '#fff', fillColor: '#1BB580', fillOpacity: 1, radius: 10, weight: 3
        }).addTo(map).bindPopup('<div style="font-family:sans-serif;font-weight:600;color:#1BB580">${isRTL ? "📍 موقعك الحالي" : "📍 Votre position"}</div>');`
      : "";

    const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map{height:100%;margin:0;padding:0;font-family:sans-serif}
  .leaflet-container{border-radius:0}
  .leaflet-popup-content-wrapper{border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.15)}
  .leaflet-popup-content{margin:10px 14px}
</style>
</head><body>
<div id="map"></div>
<script>
var map = L.map('map',{zoomControl:true}).setView([${defaultLat},${defaultLon}],${zoom});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
  attribution:'&copy; <a href="https://openstreetmap.org/copyright">OSM</a>',
  maxZoom:19
}).addTo(map);
${userMarker}
${markers}
</script>
</body></html>`;

    const iframe = document.createElement("iframe");
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    iframe.srcdoc = html;
    iframe.sandbox = "allow-scripts allow-popups allow-same-origin";

    while (containerRef.current.firstChild) {
      containerRef.current.removeChild(containerRef.current.firstChild);
    }
    containerRef.current.appendChild(iframe);
  }, [pharmacies, userLat, userLon, language]);

  return <View ref={containerRef} style={styles.map} />;
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
    minHeight: 400,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#e8f4f8",
  },
});
