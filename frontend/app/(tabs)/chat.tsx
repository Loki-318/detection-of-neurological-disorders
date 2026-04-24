import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/api";
import { theme, shadow } from "../../src/theme";

type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  created_at: string;
};

const DOCTOR_AVATAR =
  "https://images.unsplash.com/photo-1615177393114-bd2917a4f74a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzV8MHwxfHNlYXJjaHwyfHxwcm9mZXNzaW9uYWwlMjBkb2N0b3IlMjBwb3J0cmFpdHxlbnwwfHx8fDE3NzY1NzM5OTB8MA&ixlib=rb-4.1.0&q=85";

export default function ChatScreen() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    try {
      const h = await api.chatHistory();
      setMessages(h);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    // optimistic user message
    const tempId = `tmp-${Date.now()}`;
    setMessages((m) => [
      ...m,
      {
        id: tempId,
        role: "user",
        text,
        created_at: new Date().toISOString(),
      },
    ]);
    try {
      const res = await api.sendChat(text);
      setMessages((m) => {
        const withoutTmp = m.filter((x) => x.id !== tempId);
        return [...withoutTmp, res.user_message, res.ai_message];
      });
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          text: `⚠️ ${e?.message || "AI service error"}`,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item }: { item: Msg }) => {
    const isUser = item.role === "user";
    return (
      <View
        style={[
          styles.row,
          { justifyContent: isUser ? "flex-end" : "flex-start" },
        ]}
      >
        {!isUser && (
          <Image source={{ uri: DOCTOR_AVATAR }} style={styles.avatarSm} />
        )}
        <View
          style={[
            styles.bubble,
            isUser ? styles.userBubble : styles.aiBubble,
          ]}
          testID={isUser ? "chat-user-bubble" : "chat-ai-bubble"}
        >
          <Text style={isUser ? styles.userText : styles.aiText}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Image source={{ uri: DOCTOR_AVATAR }} style={styles.avatar} />
        <View style={{ flex: 1 }}>
          <Text style={styles.docName}>Dr. Nova</Text>
          <View style={styles.statusRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.docStatus}>AI Medical Assistant · Online</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        style={{ flex: 1 }}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>
                  Ask anything about your neurological health
                </Text>
                <Text style={styles.emptySub}>
                  Dr. Nova can explain your scan results, suggest next steps, and
                  share evidence-based guidance.
                </Text>
              </View>
            }
            testID="chat-message-list"
          />
        )}

        <View style={styles.inputBar}>
          <TextInput
            testID="chat-input"
            style={styles.input}
            placeholder="Type your message…"
            placeholderTextColor={theme.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && { opacity: 0.5 }]}
            onPress={send}
            disabled={!input.trim() || sending}
            testID="chat-send-button"
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons name="arrow-up" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarSm: { width: 32, height: 32, borderRadius: 16, marginRight: 6, alignSelf: "flex-end" },
  docName: { fontSize: 17, fontWeight: "800", color: theme.textMain },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.low },
  docStatus: { fontSize: 12, color: theme.textMuted },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 2 },
  bubble: { maxWidth: "78%", padding: 14, borderRadius: 20 },
  userBubble: {
    backgroundColor: theme.primary,
    borderTopRightRadius: 6,
  },
  aiBubble: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 6,
    borderWidth: 1,
    borderColor: theme.border,
  },
  userText: { color: "#fff", fontSize: 15, lineHeight: 21 },
  aiText: { color: theme.textMain, fontSize: 15, lineHeight: 21 },
  emptyBox: {
    padding: 24,
    backgroundColor: theme.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.border,
    ...shadow,
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.textMain,
    marginBottom: 8,
  },
  emptySub: { fontSize: 14, color: theme.textMuted, lineHeight: 20 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    gap: 8,
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: theme.bg,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.textMain,
    borderWidth: 1,
    borderColor: theme.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
