import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "../screens/HomeScreen";
import NavBar from "./NavBar";
import CharacterScreen from "../screens/CharacterScreen";

const Stack = createNativeStackNavigator();

export const HomeNavigation = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Home" component={NavBar} />
      <Stack.Screen name="Character" component={CharacterScreen} />
    </Stack.Navigator>
  );
};
