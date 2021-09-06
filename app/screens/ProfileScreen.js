import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../styles/colors";

const ProfileScreen = () => {
  return (
    <View style={styles.appContainer}>
      <SafeAreaView>
        <View style={styles.header}>
          <Text style={styles.appTitle}>profile</Text>
        </View>
        <View style={styles.footer}>
          <Text style={styles.p}>Designed by Gino Lee Swanepoel</Text>
          <Text style={styles.p}>in React Native</Text>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    // justifyContent: "space-around",
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
    position: "absolute",
    bottom: -600,
    left: 15,
  },
});

export default ProfileScreen;
