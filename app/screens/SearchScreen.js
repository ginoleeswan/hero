import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { COLORS } from "../styles/colors";
import { SearchBar } from "react-native-elements";

const SearchScreen = () => {
  const [search, setSearch] = useState("");

  return (
    <View style={styles.appContainer}>
      <View style={styles.header}>
        <Text style={styles.appTitle}>search</Text>
      </View>
      <ScrollView style={{ width: "100%", marginTop: 20 }}>
        <KeyboardAvoidingView>
          <SearchBar
            placeholder="Type Here..."
            onChangeText={setSearch}
            value={search}
            containerStyle={styles.inputContainer}
            inputContainerStyle={styles.input}
            inputStyle={styles.inputText}
            searchIcon={{ size: 25 }}
            round={true}
          />
        </KeyboardAvoidingView>
      </ScrollView>
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
  inputContainer: {
    width: "100%",
    padding: 0,
    height: 50,
    backgroundColor: "transparent",
    borderColor: COLORS.black,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderRadius: 50,
  },
  input: {
    // backgroundColor: "transparent",
    width: "100%",
    borderColor: COLORS.black,
    borderWidth: 2,
    borderRadius: 50,
  },
  inputText: {
    fontFamily: "Nunito_400Regular",
    fontSize: 16,
    color: COLORS.beige,
  },
});

export default SearchScreen;
