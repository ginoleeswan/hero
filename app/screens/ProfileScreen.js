import React from "react";
import { Dimensions, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../styles/colors";

const ProfileScreen = () => {
  return (
    <SafeAreaView style={styles.appContainer}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />
      <View style={styles.header}>
        <Text style={styles.appTitle}>profile</Text>
      </View>
      <View style={styles.footer}>
        <Text style={styles.p}>Designed by Gino Lee Swanepoel</Text>
        <Text style={styles.p}>in React Native</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    justifyContent: "space-between",
    // alignItems: "center",
    backgroundColor: COLORS.beige,
  },
  p: {
    fontFamily: "Flame-Regular",
    fontSize: 15,
    textAlign: "left",
    color: COLORS.black,
  },
  header: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
  },
  appTitle: {
    fontFamily: "Righteous_400Regular",
    fontSize: 50,
    textAlign: "left",
    color: COLORS.black,
  },
  footer: {
    top: Platform.OS === "ios" ? -60 : -100,
    // top: Dimensions.get("window").height - 900,
    paddingHorizontal: 15,
  },
});

export default ProfileScreen;
