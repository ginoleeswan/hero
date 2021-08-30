import React from "react";
import { StyleSheet, View, Text, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Header from "../components/Header";
import { COLORS } from "../styles/colors";

const CharacterScreen = ({ route, navigation }) => {
  const { hero, image } = route.params;

  return (
    <View style={styles.appContainer}>
      <Header title={""} backbutton={true} navigation={navigation} />
      <Image source={image} style={styles.heroImage} />
      <LinearGradient
        colors={["#ffffff00", COLORS.beige]}
        style={styles.bottomFade}
        locations={[0.3, 1]}
      />
      <View style={styles.heroInfoContainer}>
        <View style={styles.heroTitleContainer}>
          <Text style={styles.heroTitle}>{hero.name}</Text>
          <Text style={styles.p}>{hero.biography["full-name"]}</Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {/* <Text style={styles.h4}>Real Name:</Text> */}
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={styles.h4}>Publisher:</Text>
          <Text style={styles.p}>{hero.biography.publisher}</Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <Text style={styles.h4}>First Appearence:</Text>
          <Text style={styles.p}>{hero.biography["first-appearance"]}</Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <Text style={styles.h4}>Place of Birth:</Text>
          <Text style={styles.p}>{hero.biography["place-of-birth"]}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "flex-start",
    backgroundColor: COLORS.beige,
    // padding: 20,
    // paddingTop: 40,
  },
  h4: {
    fontFamily: "Nunito_900Black",
    fontSize: 15,
    textAlign: "left",
    color: COLORS.black,
  },
  p: {
    fontFamily: "Nunito_400Regular",
    fontSize: 15,
    textAlign: "left",
    color: COLORS.black,
    flexWrap: "wrap",
  },
  heroTitle: {
    fontFamily: "Righteous_400Regular",
    fontSize: 35,
    textAlign: "left",
    opacity: 0.8,
    color: COLORS.black,
    // marginBottom: 10,
  },
  heroImage: {
    position: "absolute",
    top: -160,
    left: 0,
    zIndex: -1,
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  bottomFade: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: -1,
    width: "100%",
    height: 500,
  },
  heroTitleContainer: {
    marginBottom: 10,
  },
  heroInfoContainer: {
    position: "absolute",
    width: "100%",
    top: 350,
    left: 0,
    padding: 20,
  },
});

export default CharacterScreen;
