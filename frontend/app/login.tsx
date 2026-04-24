import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../src/AuthContext";
import { theme, shadow } from "../src/theme";

export default function Login() {
  const router = useRouter();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setErr("");
    if (!email.trim() || !password) {
      setErr("Email and password are required");
      return;
    }
    if (mode === "register" && !name.trim()) {
      setErr("Name is required");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await register(email.trim(), password, name.trim());
      router.replace("/(tabs)");
    } catch (e: any) {
      setErr(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const scrollContent = (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.brandWrap}>
        <View style={styles.logo}>
          <Ionicons name="pulse" size={32} color={theme.primary} />
        </View>
        <Text style={styles.brand}>NeuroScan AI</Text>
        <Text style={styles.tagline}>
          Early neurological risk screening in your pocket.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, mode === "login" && styles.tabActive]}
            onPress={() => setMode("login")}
            testID="auth-tab-login"
          >
            <Text
              style={[
                styles.tabText,
                mode === "login" && styles.tabTextActive,
              ]}
            >
              Log In
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === "register" && styles.tabActive]}
            onPress={() => setMode("register")}
            testID="auth-tab-register"
          >
            <Text
              style={[
                styles.tabText,
                mode === "register" && styles.tabTextActive,
              ]}
            >
              Sign Up
            </Text>
          </TouchableOpacity>
        </View>

        {mode === "register" && (
          <View style={styles.field}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              testID="register-name-input"
              style={styles.input}
              placeholder="Jane Doe"
              placeholderTextColor={theme.textMuted}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            testID="login-email-input"
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={theme.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            testID="login-password-input"
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={theme.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        {err ? (
          <Text style={styles.err} testID="auth-error-message">
            {err}
          </Text>
        ) : null}

        <TouchableOpacity
          testID="login-submit-button"
          style={styles.cta}
          onPress={submit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.ctaText}>
                {mode === "login" ? "Log In" : "Create Account"}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          This app provides preliminary screening only and is not a
          substitute for medical diagnosis.
        </Text>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {Platform.OS !== "web" ? (
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            {scrollContent}
          </TouchableWithoutFeedback>
        ) : (
          scrollContent
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  scroll: { flexGrow: 1, padding: 24, justifyContent: "center" },
  brandWrap: { alignItems: "center", marginBottom: 32 },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    ...shadow,
  },
  brand: {
    fontSize: 32,
    fontWeight: "800",
    color: theme.textMain,
    letterSpacing: -0.5,
  },
  tagline: {
    marginTop: 8,
    fontSize: 15,
    color: theme.textMuted,
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 22,
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.border,
    ...shadow,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: theme.bg,
    borderRadius: 999,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 999,
  },
  tabActive: { backgroundColor: theme.surface, ...shadow },
  tabText: { fontSize: 14, fontWeight: "600", color: theme.textMuted },
  tabTextActive: { color: theme.textMain },
  field: { marginBottom: 16 },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.textMuted,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.bg,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.textMain,
    borderWidth: 1,
    borderColor: theme.border,
  },
  err: {
    color: theme.danger,
    fontSize: 13,
    marginBottom: 12,
    textAlign: "center",
  },
  cta: {
    marginTop: 8,
    backgroundColor: theme.primary,
    borderRadius: 999,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  disclaimer: {
    marginTop: 16,
    fontSize: 11,
    color: theme.textMuted,
    textAlign: "center",
    lineHeight: 16,
  },
});
