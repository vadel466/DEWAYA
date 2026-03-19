import React from "react";
import { View, Text, StyleSheet } from "react-native";
import MapView, { Marker, Circle } from "react-native-maps";
import Colors from "@/constants/colors";

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
  const defaultLat = userLat ?? 18.0735;
  const defaultLon = userLon ?? -15.9582;

  const withCoords = pharmacies.filter((p) => p.lat && p.lon);

  return (
    <MapView
      style={styles.map}
      initialRegion={{
        latitude: defaultLat,
        longitude: defaultLon,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      }}
      showsUserLocation={false}
      showsMyLocationButton={false}
    >
      {userLat && userLon && (
        <Circle
          center={{ latitude: userLat, longitude: userLon }}
          radius={80}
          fillColor="rgba(27,181,128,0.35)"
          strokeColor={Colors.accent}
          strokeWidth={2}
        />
      )}
      {withCoords.map((p, i) => (
        <Marker
          key={p.id}
          coordinate={{ latitude: p.lat!, longitude: p.lon! }}
          title={language === "ar" ? (p.nameAr || p.name) : p.name}
          description={language === "ar" ? (p.addressAr || p.address) : p.address}
        >
          <View style={[styles.markerPin, i === 0 && styles.markerPinFirst]}>
            <Text style={styles.markerText}>{i + 1}</Text>
          </View>
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    height: 240,
    borderRadius: 12,
    overflow: "hidden",
  },
  markerPin: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  markerPinFirst: {
    backgroundColor: Colors.accent,
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  markerText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
});
