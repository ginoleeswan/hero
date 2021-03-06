import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { HeroesProvider } from "./app/context/HeroesContext";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";

import { NavigationContainer } from "@react-navigation/native";
import AppLoading from "expo-app-loading";
import {
  useFonts,
  Nunito_400Regular,
  Nunito_700Bold,
  Nunito_900Black,
} from "@expo-google-fonts/nunito";

import { Righteous_400Regular } from "@expo-google-fonts/righteous";
import { HomeNavigation } from "./app/navigation/HomeNavigation";

export default function App() {
  let [fontsLoaded] = useFonts({
    "FlameSans-Regular": require("./app/assets/fonts/FlameSans-Regular.ttf"),
    "Flame-Regular": require("./app/assets/fonts/Flame-Regular.ttf"),
    "Flame-Bold": require("./app/assets/fonts/Flame-Bold.ttf"),
    Nunito_400Regular,
    Nunito_700Bold,
    Nunito_900Black,
    Righteous_400Regular,
  });

  if (!fontsLoaded) {
    return <AppLoading />;
  } else {
    return (
      <SafeAreaProvider>
        <HeroesProvider>
          <NavigationContainer>
            <HomeNavigation />
          </NavigationContainer>
        </HeroesProvider>
      </SafeAreaProvider>
    );
  }
}
