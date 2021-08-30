import React from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../styles/colors";
import BackButton from "./BackButton";

const Header = ({ title, backbutton, navigation }) => {
  if (backbutton) {
    return (
      <View style={styles.headerContainer}>
        <SafeAreaView style={styles.header}>
          <BackButton navigation={navigation} />
          <Text style={styles.appTitle}>{title}</Text>
        </SafeAreaView>
      </View>
    );
  } else {
    return (
      <SafeAreaView style={styles.headerNoBackButton}>
        <Text style={styles.appTitle}>{title}</Text>
      </SafeAreaView>
    );
  }
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    paddingHorizontal: 50,
    marginBottom: 30,
    alignItems: "center",
  },
  headerNoBackButton: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "flex-end",
    paddingHorizontal: 35,
    marginBottom: 30,
    alignItems: "center",
  },
  appTitle: {
    fontFamily: "Righteous_400Regular",
    fontSize: 30,
    alignSelf: "center",
    textAlign: "right",
    color: COLORS.black,
  },
});

export default Header;
