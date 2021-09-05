import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import HomeScreen from "../screens/HomeScreen";
import { COLORS } from "../styles/colors";
import ProfileScreen from "../screens/ProfileScreen";
import SearchScreen from "../screens/SearchScreen";

const Tab = createBottomTabNavigator();

const NavBar = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size, style }) => {
          let iconName;

          if (route.name === "Discover") {
            iconName = focused ? "layers" : "layers-outline";
          } else if (route.name === "Profile") {
            iconName = focused ? "person" : "person-outline";
          } else if (route.name === "Search") {
            iconName = focused ? "search" : "search-outline";
          } else if (route.name === "History") {
            iconName = focused ? "receipt" : "receipt-outline";
          }

          // You can return any component that you like here!
          if (route.name === "Discover" || route.name === "Profile") {
            return (
              <View style={{ position: "absolute", top: "50%" }}>
                <Ionicons
                  name={iconName}
                  size={size}
                  color={color}
                  containerStyle={{ textAlignVertical: "center" }}
                />
              </View>
            );
          } else if (route.name === "Search") {
            return (
              <TouchableOpacity
                style={{
                  position: "absolute",
                  top: -30,
                  width: 70,
                  height: 70,
                  justifyContent: "center",
                  alignItems: "center",
                  borderRadius: 70,
                  borderColor: "grey",
                  borderWidth: 1,
                  backgroundColor: COLORS.navy,
                  ...styles.shadow,
                }}
                onPress={() => navigation.navigate("Search")}
              >
                <Ionicons
                  name={iconName}
                  size={size}
                  color={COLORS.beige}
                  containerStyle={{ textAlignVertical: "center" }}
                />
              </TouchableOpacity>
            );
          }
        },

        tabBarActiveTintColor: COLORS.beige,
        tabBarInactiveTintColor: "gray",
        tabBarLabel: ({ focused }) => {
          if (route.name === "Discover" || route.name === "Profile") {
            return focused ? (
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: "Nunito_700Bold",
                  top: 15,
                  color: COLORS.beige,
                }}
              >
                {route.name}
              </Text>
            ) : (
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: "Nunito_700Bold",
                  top: 15,
                  color: "gray",
                }}
              >
                {route.name}
              </Text>
            );
          }
        },
        // tabBarShowLabel: false,
        tabBarLabelStyle: { fontFamily: "Nunito_700Bold", top: 15 },
        headerTitleAlign: "center",

        tabBarStyle: {
          position: "absolute",
          flex: 1,
          alignSelf: "center",
          bottom: 0,
          //   left: 20,
          //   right: 20,
          elevation: 0,
          padding: 0,
          backgroundColor: COLORS.black,
          borderWidth: 0,
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          height: 70,
          // ...styles.shadow,
        },
      })}
    >
      <Tab.Screen name="Discover" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  shadow: {
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.5,
    elevation: 5,
  },
});

export default NavBar;
