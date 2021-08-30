import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { COLORS } from "../styles/colors";

const BackButton = ({ navigation: { goBack } }) => {
  return (
    <TouchableOpacity onPress={() => goBack()} style={styles.button}>
      <Icon name="chevron-back" style={styles.backIcon}></Icon>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 60,
    height: 60,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,

    elevation: 5,
  },
  backIcon: {
    color: COLORS.yellow,
    fontSize: 40,
    textAlign: "center",
    // marginLeft: 1,
  },
});

export default BackButton;
