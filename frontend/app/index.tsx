// File: app/index.tsx
import { Redirect } from "expo-router";
import { useAuth } from "../src/AuthContext";
import { View, ActivityIndicator } from "react-native";
import { theme } from "../src/theme";

export default function AppRoot() {
  const { user, isLoading } = useAuth(); // Assuming your AuthContext has an isLoading state

  // Show a loading spinner while checking auth status
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.bg }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // If the user is logged in, send them to the beautiful dashboard in the tabs
  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  // If the user is NOT logged in, send them to the login screen
  return <Redirect href="/login" />;
}