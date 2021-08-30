import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../styles/colors";

const HomeScreen = () => {
  return (
    <View style={styles.appContainer}>
      <View style={styles.header}>
        <View>
          <Text style={styles.appTitle}>hero</Text>
          <Text style={{ ...styles.p, fontSize: 7, marginTop: -8, left: 3 }}>
            the Superhero Encyclopedia
          </Text>
        </View>
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
    padding: 30,
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
  p: {
    fontFamily: "Nunito_400Regular",
    fontSize: 15,
    textAlign: "left",
    color: COLORS.black,
  },
});

export default HomeScreen;
