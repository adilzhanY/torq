/** Torq logo — a dumbbell in a rounded clay square. */
import { View } from "react-native";
import { Dumbbell } from "lucide-react-native";

export function Logo({ size = 32, color = "#272d29" }: { size?: number; color?: string }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: color,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Dumbbell size={size * 0.58} color="#faf9f5" strokeWidth={2.6} />
    </View>
  );
}
