import React from "react";
import { View, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

type Props = {
  size?: number;
  color?: string;
};

export function CaduceusLogo({ size = 72, color = Colors.primary }: Props) {
  return (
    <View style={[styles.container, { width: size * 1.4, height: size * 1.4, borderRadius: size * 0.7 }]}>
      <View style={[styles.innerCircle, { width: size * 1.1, height: size * 1.1, borderRadius: size * 0.55 }]}>
        <MaterialCommunityIcons name="pill" size={size * 0.55} color={color} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: Colors.accent + "40",
  },
  innerCircle: {
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
});
