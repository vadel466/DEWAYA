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

    const defaultLat = userLat ?? 18.0735;
    const defaultLon = userLon ?? -15.9582;

    const markers = pharmacies
      .filter((p) => p.lat && p.lon)
      .map((p, i) => {
        const label = language === "ar" ? (p.nameAr || p.name) : p.name;
        const addr = language === "ar" ? (p.addressAr || p.address) : p.address;
        return `L.marker([${p.lat}, ${p.lon}], {
          icon: L.divIcon({
            html: '<div style="background:#0A7EA4;color:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${i + 1}</div>',
            iconSize: [26, 26], iconAnchor: [13, 13], className: ''
          })
        }).addTo(map).bindPopup('<b>${label.replace(/'/g, "\\'")}</b><br/>${addr.replace(/'/g, "\\'")}');`;
      })
      .join("\n");

    const userMarker = userLat && userLon
      ? `L.circleMarker([${userLat}, ${userLon}], {
          color: '#1BB580', fillColor: '#1BB580', fillOpacity: 0.9, radius: 9,
          weight: 3
        }).addTo(map).bindPopup('${language === "ar" ? "موقعك الحالي" : "Votre position"}');`
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
</style>
</head><body>
<div id="map"></div>
<script>
var map = L.map('map',{zoomControl:true}).setView([${defaultLat},${defaultLon}],13);
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

    while (containerRef.current.firstChild) {
      containerRef.current.removeChild(containerRef.current.firstChild);
    }
    containerRef.current.appendChild(iframe);
  }, [pharmacies, userLat, userLon, language]);

  return <View ref={containerRef} style={styles.map} />;
}

const styles = StyleSheet.create({
  map: {
    height: 240,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#e8f4f8",
  },
});
