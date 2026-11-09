import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from "react-native";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";

export function LoginScreen({ route, navigation, onLoginSuccess, onBack }) {
  const { login, signup, loginWithGoogle } = useAuth();
  const [isRegister, setIsRegister] = useState(Boolean(route?.params?.initialRegister));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async () => {
    setErrorMessage("");

    if (!email.trim() || !password.trim()) {
      setErrorMessage("Preencha todos os campos obrigatórios.");
      return;
    }

    if (isRegister && !name.trim()) {
      setErrorMessage("Informe seu nome para realizar o cadastro.");
      return;
    }

    setLoading(true);

    let res;
    if (isRegister) {
      res = await signup(email, password, name);
    } else {
      res = await login(email, password);
    }

    setLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || "Ocorreu um erro. Tente novamente.");
    } else if (onLoginSuccess) {
      onLoginSuccess();
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage("");
    setLoadingGoogle(true);
    const res = await loginWithGoogle();
    setLoadingGoogle(false);
    if (!res.success) {
      setErrorMessage(res.error || "Não foi possível entrar com o Google.");
    } else if (onLoginSuccess) {
      onLoginSuccess();
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {(onBack || (navigation && navigation.canGoBack())) && (
          <TouchableOpacity 
            style={styles.backBtn} 
            onPress={() => {
              if (onBack) onBack();
              else if (navigation && navigation.canGoBack()) navigation.goBack();
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.backBtnText}>← Voltar para o início</Text>
          </TouchableOpacity>
        )}

        {/* Cabeçalho */}
        <View style={styles.header}>
          <Text style={styles.logo}>🍻</Text>
          <Text style={styles.title}>Cervejaria Artesanal</Text>
          <Text style={styles.subtitle}>
            {isRegister 
              ? "Crie sua conta para começar" 
              : "Faça login para continuar"}
          </Text>
        </View>

        {/* Mensagem de erro */}
        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
          </View>
        ) : null}

        {/* Formulário */}
        <View style={styles.card}>
          {isRegister && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nome Completo</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Carlos Oliveira"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={styles.input}
              placeholder="seu.email@exemplo.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Senha</Text>
            <TextInput
              style={styles.input}
              placeholder="Digite sua senha"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity 
            style={styles.mainBtn} 
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.mainBtnText}>
                {isRegister ? "Criar Minha Conta" : "Entrar com E-mail"}
              </Text>
            )}
          </TouchableOpacity>

          {/* Divisor */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Login com Google (direto como estava antes) */}
          <TouchableOpacity 
            style={styles.googleBtn} 
            onPress={handleGoogleLogin}
            disabled={loadingGoogle}
            activeOpacity={0.8}
          >
            {loadingGoogle ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.googleContent}>
                <Text style={styles.googleIcon}>🔴</Text>
                <Text style={styles.googleBtnText}>Entrar com Google</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.switchBtn} 
            onPress={() => {
              setIsRegister(!isRegister);
              setErrorMessage("");
            }}
          >
            <Text style={styles.switchText}>
              {isRegister 
                ? "Já tem uma conta? Clique para entrar" 
                : "Não possui cadastro? Criar nova conta"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  backBtn: {
    alignSelf: "flex-start",
    marginBottom: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  backBtnText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  logo: {
    fontSize: 54,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: colors.primary,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: "center",
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  mainBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  mainBtnText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "bold",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  dividerText: {
    color: colors.textMuted,
    paddingHorizontal: 10,
    fontSize: 12,
  },
  googleBtn: {
    backgroundColor: "#1a1f2c",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  googleContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  googleIcon: {
    fontSize: 16,
  },
  googleBtnText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  switchBtn: {
    marginTop: 18,
    alignItems: "center",
  },
  switchText: {
    color: colors.primary,
    fontSize: 13,
  },
  errorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 13,
  },
});
