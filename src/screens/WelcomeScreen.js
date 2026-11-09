import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  StatusBar
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const SLIDES = [
  { id: "1", image: require("../../assets/carrossel_1.jpg") },
  { id: "2", image: require("../../assets/carrossel_2.jpg") },
  { id: "3", image: require("../../assets/carrossel_3.jpg") },
];

export function WelcomeScreen({ navigation, onEnter }) {
  const { user, logout } = useAuth();
  const [activeSlide, setActiveSlide] = useState(0);
  const scrollRef = useRef(null);

  const cardWidth = Math.min(SCREEN_WIDTH - 40, 400);

  // Auto-avanço sutil das imagens
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => {
        const next = (prev + 1) % SLIDES.length;
        if (scrollRef.current) {
          scrollRef.current.scrollTo({
            x: next * cardWidth,
            animated: true,
          });
        }
        return next;
      });
    }, 4000);

    return () => clearInterval(timer);
  }, [cardWidth]);

  const handleScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / cardWidth);
    if (index >= 0 && index < SLIDES.length && index !== activeSlide) {
      setActiveSlide(index);
    }
  };

  const handlePrimaryPress = () => {
    if (user && onEnter) {
      onEnter();
    } else if (navigation) {
      navigation.navigate("Login", { initialRegister: false });
    }
  };

  const handleSecondaryPress = () => {
    if (user) {
      logout();
    } else if (navigation) {
      navigation.navigate("Login", { initialRegister: true });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0c0d0f" />

      <ScrollView 
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Cabeçalho Simples */}
        <View style={styles.header}>
          <Text style={styles.brandIcon}>🍻</Text>
          <Text style={styles.brandTitle}>Cervejaria Artesanal</Text>
          <Text style={styles.brandSubtitle}>Sistema de Gestão & Pedidos</Text>
        </View>

        {/* Carrossel de Fotos Limpo (Sem textos por cima das imagens) */}
        <View style={[styles.carouselBox, { width: cardWidth }]}>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScroll}
            decelerationRate="fast"
            snapToInterval={cardWidth}
            snapToAlignment="center"
          >
            {SLIDES.map((slide) => (
              <View key={slide.id} style={[styles.slideCard, { width: cardWidth }]}>
                <Image 
                  source={slide.image} 
                  style={styles.slideImage} 
                  resizeMode="cover"
                />
              </View>
            ))}
          </ScrollView>

          {/* Indicadores de Página */}
          <View style={styles.paginationRow}>
            {SLIDES.map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.dot,
                  activeSlide === idx ? styles.activeDot : styles.inactiveDot,
                ]}
              />
            ))}
          </View>
        </View>

        {/* Botões de Ação */}
        <View style={[styles.actionsBox, { width: cardWidth }]}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handlePrimaryPress}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>
              {user 
                ? `Continuar como ${user.role === "admin" ? "Administrador" : "Cliente"} →`
                : "Acessar Plataforma"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleSecondaryPress}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryBtnText}>
              {user ? "Sair da Conta" : "Criar Nova Conta"}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerNote}>v1.0 • Cervejaria Artesanal</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0c0d0f",
  },
  container: {
    flexGrow: 1,
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  brandIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.primary,
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  carouselBox: {
    alignItems: "center",
    marginVertical: 12,
  },
  slideCard: {
    height: 280,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#161922",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  slideImage: {
    width: "100%",
    height: "100%",
  },
  paginationRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  activeDot: {
    width: 20,
    backgroundColor: colors.primary,
  },
  inactiveDot: {
    width: 6,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  actionsBox: {
    gap: 12,
    marginTop: 16,
    width: "100%",
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#0c0d0f",
    fontSize: 15,
    fontWeight: "bold",
  },
  secondaryBtn: {
    backgroundColor: "transparent",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(245, 200, 66, 0.35)",
  },
  secondaryBtnText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  footerNote: {
    color: "#475569",
    fontSize: 11,
    marginTop: 16,
  },
});
