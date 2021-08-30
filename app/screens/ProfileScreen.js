import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../styles/colors";

const ProfileScreen = () => {
  return (
    <View style={styles.appContainer}>
      <View style={styles.header}>
        <Text style={styles.appTitle}>profile</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: COLORS.beige,
    padding: 35,
    paddingTop: 40,
  },
  header: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: -10,
  },
  appTitle: {
    fontFamily: "Righteous_400Regular",
    fontSize: 50,
    textAlign: "left",
    color: COLORS.black,
  },
});

export default ProfileScreen;
