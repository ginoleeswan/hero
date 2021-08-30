import React from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../styles/colors";

const HomeScreen = () => {
  return (
    <View style={styles.appContainer}>
      <SafeAreaView>
        <View style={styles.header}>
          <View>
            <Text style={styles.appTitle}>hero</Text>
            <Text style={{ ...styles.p, fontSize: 7, marginTop: -8, left: 3 }}>
              the Superhero Encyclopedia
            </Text>
          </View>
        </View>
        <View style={styles.popularContainer}>
          <Text style={styles.h4}>Popular</Text>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "flex-start",
    backgroundColor: COLORS.beige,
    padding: 20,
    // paddingTop: 40,
  },
  h4: {
    fontFamily: "Nunito_900Black",
    fontSize: 20,
    textAlign: "left",
    color: COLORS.black,
  },
  p: {
    fontFamily: "Nunito_400Regular",
    fontSize: 15,
    textAlign: "left",
    color: COLORS.black,
  },
  header: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  appTitle: {
    fontFamily: "Righteous_400Regular",
    fontSize: 50,
    textAlign: "left",
    color: COLORS.black,
  },
  popularContainer: {
    justifyContent: "space-around",
    alignItems: "flex-start",
  },
});

export default HomeScreen;
