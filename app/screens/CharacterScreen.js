import React, { useEffect } from "react";
import { StyleSheet, View, Text, Image, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Header from "../components/Header";
import { COLORS } from "../styles/colors";
import { Divider } from "react-native-elements";

const apiComic = {
  key: "02dbe748c04865c7601c8c67ffb9a0e95438bbf1",
};

const CharacterScreen = ({ route, navigation }) => {
  const {
    hero,
    image,
    publisher,
    comicPicture,
    summary,
    firstIssue,
    firstIssueURL,
  } = route.params;

  let publisherLogo = null;
  let logoShape = null;
  //   let firstIssueID = null;

  if (publisher === "Marvel Comics" || publisher === "Marvel") {
    publisherLogo = require(`../assets/images/Marvel-Logo.jpg`);
    logoShape = styles.publisherLogoRectangle;
  } else if (publisher === "DC Comics") {
    publisherLogo = require(`../assets/images/DC-Logo.png`);
    logoShape = styles.publisherLogoSquare;
  }

  //   if (comicPicture) {
  //     comicPictureURL = require(comicPicture);
  //   }

  function searchComic(firstComic) {
    fetch(
      `https://comicvine.gamespot.com/api/characters/?api_key=${apiComic.key}&sort=deck:desc&filter=name:${hero.name}&format=json`
    )
      .then((res) => {
        if (res.status === 404) {
          throw new Error("I didn't find this hero. Please try again!");
        } else {
          return res.json();
        }
      })

      .then((result) => {
        console.log("====================================");
        console.log("NEW SEARCH");
        console.log("====================================");
        console.log(result.results);
      });
  }

  function searchFirstComic() {
    fetch(
      `https://comicvine.gamespot.com/api/issue/4000-${firstIssue.id}/?api_key=${apiComic.key}&format=json`
    )
      .then((res) => {
        if (res.status === 404) {
          throw new Error("I didn't find this hero. Please try again!");
        } else {
          return res.json();
        }
      })

      .then((result) => {
        console.log("FIRST ISSUE DETAILS");
        console.log(result.results.image.original_url);
        // comicPicture = require(result.results[0].image.original_url);
        // summary = result.results[0].deck;
      });
  }

  //   useEffect(() => {
  //     // console.log(publisherVine);
  //     // searchComic(hero.biography["first-appearance"]);
  //     //   searchFirstComic();
  //   }, []);

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
          <View style={styles.heroHeader}>
            <Text style={{ ...styles.p, marginLeft: 2 }}>
              {hero.biography["full-name"]}
            </Text>
            <Image source={publisherLogo} style={logoShape} />
          </View>
        </View>
        <Divider
          orientation="horizontal"
          width={3}
          style={styles.divider}
          color={COLORS.navy}
        />
        <ScrollView
          style={{ height: 340 }}
          contentContainerStyle={{
            width: "100%",
            paddingBottom: 40,
            marginTop: 5,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Text
            style={{
              ...styles.p,
              fontSize: 12,
              marginBottom: 10,
              lineHeight: 18,
            }}
          >
            {summary}
          </Text>
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
            <Text style={styles.p}>{publisher}</Text>
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
            <Text style={styles.p}>
              {hero.biography["place-of-birth"] === "-"
                ? "Unknown"
                : hero.biography["place-of-birth"]}
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <Text style={styles.h4}>Alignment:</Text>
            <Text style={{ ...styles.p, textTransform: "capitalize" }}>
              {hero.biography.alignment}
            </Text>
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
          <View style={styles.comicPictureContainer}>
            {firstIssueURL ? (
              <Image
                source={{
                  uri: firstIssueURL,
                }}
                style={styles.comicPicture}
              />
            ) : (
              <Text style={styles.h4}>NO PICTURE</Text>
            )}
          </View>
        </ScrollView>
        <LinearGradient
          colors={["#ffffff00", COLORS.beige]}
          style={styles.bottomFadeInfo}
          locations={[0.8, 1]}
          pointerEvents={"none"}
        />
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
    color: COLORS.navy,
  },
  p: {
    fontFamily: "Nunito_400Regular",
    fontSize: 15,
    textAlign: "left",
    color: COLORS.navy,
    flexWrap: "wrap",
  },
  divider: {
    borderRadius: 30,
    marginBottom: 10,
  },
  heroTitle: {
    fontFamily: "Righteous_400Regular",
    fontSize: 35,
    textAlign: "left",
    // opacity: 0.9,
    color: COLORS.navy,
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
  bottomFadeInfo: {
    position: "absolute",
    top: 170,
    left: 20,
    zIndex: 1,
    width: "100%",
    height: 300,
  },
  heroHeader: {
    flexDirection: "row",
    // width: 250,
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroTitleContainer: {
    marginBottom: 10,
  },
  heroInfoContainer: {
    position: "absolute",
    width: "100%",
    top: 340,
    left: 0,
    padding: 20,
  },
  publisherLogoSquare: {
    width: 30,
    left: -2,
    // top: 18,
    height: 30,
    borderRadius: 4,

    resizeMode: "contain",
  },
  publisherLogoRectangle: {
    width: 50,
    left: -2,
    // top: 18,
    height: 30,
    borderRadius: 4,

    resizeMode: "contain",
  },

  comicPictureContainer: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#000",

    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.39,
    shadowRadius: 8.3,

    elevation: 13,
  },
  comicPicture: {
    width: 160,
    height: 240,
    resizeMode: "contain",
  },
});

export default CharacterScreen;
