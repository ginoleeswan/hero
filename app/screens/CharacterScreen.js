import React, { useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Image,
  ScrollView,
  Dimensions,
  Platform,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Lightbox from "react-native-lightbox-v2";
import { LinearGradient } from "expo-linear-gradient";
import Header from "../components/Header";
import { COLORS } from "../styles/colors";
import { Divider } from "react-native-elements";
import { AnimatedCircularProgress } from "react-native-circular-progress";
import { Circle } from "react-native-svg";

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

  const activeLightboxProps = {
    resizeMode: "contain",
    marginHorizontal: 20,
    flex: 1,
    width: null,
  };

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
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />
      <SafeAreaView
        style={{ flex: 1, backgroundColor: "transparent" }}
        forceInset={{ top: "always" }}
      >
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
              <Text style={{ ...styles.p, marginLeft: 3, fontSize: 16 }}>
                {hero.biography["full-name"]}
              </Text>
              <Image source={publisherLogo} style={logoShape} />
            </View>
          </View>
          <Divider
            orientation="horizontal"
            width={3}
            style={{ ...styles.divider, marginBottom: 0 }}
            color={COLORS.navy}
          />
          <ScrollView
            style={{ height: 340 }}
            contentContainerStyle={{
              width: "100%",
              paddingBottom: 40,
              marginTop: 10,
            }}
            showsVerticalScrollIndicator={false}
          >
            <Text
              style={{
                ...styles.p,
                fontSize: 12,
                marginBottom: 20,
                lineHeight: 18,
              }}
            >
              {summary}
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "space-around",
                alignItems: "center",
                // backgroundColor: COLORS.grey,
                borderRadius: 20,
                // padding: 10,
                marginBottom: 10,
              }}
            >
              <View
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 5,
                }}
              >
                <AnimatedCircularProgress
                  size={60}
                  width={10}
                  duration={2000}
                  backgroundWidth={8}
                  rotation={-124}
                  arcSweepAngle={250}
                  fill={Number(hero.powerstats.intelligence)}
                  tintColor={COLORS.red}
                  tintColorSecondary={COLORS.green}
                  // onAnimationComplete={() => console.log("onAnimationComplete")}
                  backgroundColor={COLORS.navy}
                  padding={0}
                  lineCap={"round"}
                  // renderCap={({ center }) => (
                  //   <Circle cx={center.x} cy={center.y} r="10" fill="blue" />
                  // )}
                >
                  {(fill) => (
                    <Text
                      style={{
                        ...styles.p,
                        fontFamily: "Flame-Regular",
                        left: 1,
                      }}
                    >
                      {Math.floor(fill)}
                    </Text>
                  )}
                </AnimatedCircularProgress>
                <Text
                  style={{
                    ...styles.p,
                    fontFamily: "Flame-Regular",
                    fontSize: 10,
                    marginTop: -10,
                  }}
                >
                  Intelligence
                </Text>
              </View>
              <View
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 5,
                }}
              >
                <AnimatedCircularProgress
                  size={60}
                  width={10}
                  duration={2000}
                  backgroundWidth={8}
                  rotation={-124}
                  arcSweepAngle={250}
                  fill={Number(hero.powerstats.strength)}
                  tintColor={COLORS.red}
                  tintColorSecondary={COLORS.green}
                  // onAnimationComplete={() => console.log("onAnimationComplete")}
                  backgroundColor={COLORS.navy}
                  padding={0}
                  lineCap={"round"}
                  // renderCap={({ center }) => (
                  //   <Circle cx={center.x} cy={center.y} r="10" fill="blue" />
                  // )}
                >
                  {(fill) => (
                    <Text
                      style={{
                        ...styles.p,
                        fontFamily: "Flame-Regular",
                        left: 1,
                      }}
                    >
                      {Math.floor(fill)}
                    </Text>
                  )}
                </AnimatedCircularProgress>
                <Text
                  style={{
                    ...styles.p,
                    fontFamily: "Flame-Regular",
                    fontSize: 10,
                    marginTop: -10,
                  }}
                >
                  Strength
                </Text>
              </View>
              <View
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 5,
                }}
              >
                <AnimatedCircularProgress
                  size={60}
                  width={10}
                  duration={2000}
                  backgroundWidth={8}
                  rotation={-124}
                  arcSweepAngle={250}
                  fill={Number(hero.powerstats.speed)}
                  tintColor={COLORS.red}
                  tintColorSecondary={COLORS.green}
                  // onAnimationComplete={() => console.log("onAnimationComplete")}
                  backgroundColor={COLORS.navy}
                  padding={0}
                  lineCap={"round"}
                  // renderCap={({ center }) => (
                  //   <Circle cx={center.x} cy={center.y} r="10" fill="blue" />
                  // )}
                >
                  {(fill) => (
                    <Text
                      style={{
                        ...styles.p,
                        fontFamily: "Flame-Regular",
                        left: 1,
                      }}
                    >
                      {Math.floor(fill)}
                    </Text>
                  )}
                </AnimatedCircularProgress>
                <Text
                  style={{
                    ...styles.p,
                    fontFamily: "Flame-Regular",
                    fontSize: 10,
                    marginTop: -10,
                  }}
                >
                  Speed
                </Text>
              </View>
              <View
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 5,
                }}
              >
                <AnimatedCircularProgress
                  size={60}
                  width={10}
                  duration={2000}
                  backgroundWidth={8}
                  rotation={-124}
                  arcSweepAngle={250}
                  fill={Number(hero.powerstats.durability)}
                  tintColor={COLORS.red}
                  tintColorSecondary={COLORS.green}
                  // onAnimationComplete={() => console.log("onAnimationComplete")}
                  backgroundColor={COLORS.navy}
                  padding={0}
                  lineCap={"round"}
                  // renderCap={({ center }) => (
                  //   <Circle cx={center.x} cy={center.y} r="10" fill="blue" />
                  // )}
                >
                  {(fill) => (
                    <Text
                      style={{
                        ...styles.p,
                        fontFamily: "Flame-Regular",
                        left: 1,
                      }}
                    >
                      {Math.floor(fill)}
                    </Text>
                  )}
                </AnimatedCircularProgress>
                <Text
                  style={{
                    ...styles.p,
                    fontFamily: "Flame-Regular",
                    fontSize: 10,
                    marginTop: -10,
                  }}
                >
                  Durability
                </Text>
              </View>
              <View
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 5,
                }}
              >
                <AnimatedCircularProgress
                  size={60}
                  width={10}
                  duration={2000}
                  backgroundWidth={8}
                  rotation={-124}
                  arcSweepAngle={250}
                  fill={Number(hero.powerstats.power)}
                  tintColor={COLORS.red}
                  tintColorSecondary={COLORS.green}
                  // onAnimationComplete={() => console.log("onAnimationComplete")}
                  backgroundColor={COLORS.navy}
                  padding={0}
                  lineCap={"round"}
                  // renderCap={({ center }) => (
                  //   <Circle cx={center.x} cy={center.y} r="10" fill="blue" />
                  // )}
                >
                  {(fill) => (
                    <Text
                      style={{
                        ...styles.p,
                        fontFamily: "Flame-Regular",
                        left: 1,
                      }}
                    >
                      {Math.floor(fill)}
                    </Text>
                  )}
                </AnimatedCircularProgress>
                <Text
                  style={{
                    ...styles.p,
                    fontFamily: "Flame-Regular",
                    fontSize: 10,
                    marginTop: -10,
                  }}
                >
                  Power
                </Text>
              </View>
              <View
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 5,
                }}
              >
                <AnimatedCircularProgress
                  size={60}
                  width={10}
                  duration={2000}
                  backgroundWidth={8}
                  rotation={-124}
                  arcSweepAngle={250}
                  fill={Number(hero.powerstats.combat)}
                  tintColor={COLORS.red}
                  tintColorSecondary={COLORS.green}
                  // onAnimationComplete={() => console.log("onAnimationComplete")}
                  backgroundColor={COLORS.navy}
                  padding={0}
                  lineCap={"round"}
                  // renderCap={({ center }) => (
                  //   <Circle cx={center.x} cy={center.y} r="10" fill="blue" />
                  // )}
                >
                  {(fill) => (
                    <Text
                      style={{
                        ...styles.p,
                        fontFamily: "Flame-Regular",
                        left: 1,
                      }}
                    >
                      {Math.floor(fill)}
                    </Text>
                  )}
                </AnimatedCircularProgress>
                <Text
                  style={{
                    ...styles.p,
                    fontFamily: "Flame-Regular",
                    fontSize: 10,
                    marginTop: -10,
                  }}
                >
                  Combat
                </Text>
              </View>
            </View>

            <View style={styles.heroDetailsContainer}>
              <Text style={{ ...styles.h2 }}>Biography</Text>
              <Divider
                orientation="horizontal"
                width={2}
                inset={true}
                style={styles.divider}
                color={COLORS.navy}
              />
              {Object.entries(hero.biography).map(([key, value, index]) => {
                // console.log(`${key}: ${value}`);

                let str = value.toString();

                if (
                  key != "full-name" &&
                  key != "place-of-birth" &&
                  key != "alter-egos" &&
                  "No alter egos found."
                ) {
                  str = str.replace(/,\s*(?![^()]*\))/g, "\n\u2022 ");
                }

                return (
                  <View
                    key={index}
                    style={{
                      flexDirection: key == "aliases" ? "column" : "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      marginBottom: 5,
                    }}
                  >
                    <Text style={styles.h4}>{key}:</Text>

                    {str.split(`/,[s]*/g, ", "`).map((value) => (
                      <Text
                        style={{ ...styles.p, textTransform: "capitalize" }}
                      >
                        {key != "full-name" &&
                        key != "place-of-birth" &&
                        key != "first-appearance" &&
                        key != "publisher" &&
                        key != "alignment" &&
                        "-"
                          ? "\u2022 " + value
                          : value}
                      </Text>
                    ))}
                  </View>
                );
              })}
            </View>

            <View style={styles.comicPictureContainer}>
              {firstIssueURL ? (
                <Lightbox
                  // renderHeader={() => {
                  //   return (
                  //     <View
                  //       style={{
                  //         justifyContent: "center",
                  //         alignItems: "flex-start",
                  //         paddingHorizontal: 15,
                  //         top: 70,
                  //       }}
                  //     >
                  //       <Text
                  //         style={{ ...styles.heroTitle, color: COLORS.beige }}
                  //       >
                  //         First Issue
                  //       </Text>
                  //     </View>
                  //   );
                  // }}
                  activeProps={activeLightboxProps}
                >
                  <Image
                    source={{
                      uri: firstIssueURL,
                    }}
                    style={styles.comicPicture}
                  />
                </Lightbox>
              ) : (
                <Text style={styles.h4}>NO PICTURE</Text>
              )}
            </View>

            <View style={styles.heroDetailsContainer}>
              <Text style={{ ...styles.h2 }}>Appearence</Text>
              <Divider
                orientation="horizontal"
                width={2}
                inset={true}
                style={styles.divider}
                color={COLORS.navy}
              />
              {Object.entries(hero.appearance).map(([key, value, index]) => {
                // console.log(`${key}: ${value}`);
                const str = value.toString();
                return (
                  <View
                    key={index}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <Text style={styles.h4}>{key}:</Text>
                    <Text style={styles.p}>
                      {str
                        .split(`/,[s]*/g, ", "`)
                        .map((value) =>
                          str.includes(",") ? (
                            <Text>{value.replace(/,(?=[^\s])/g, ", ")}</Text>
                          ) : (
                            <Text>{value}</Text>
                          )
                        )}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.heroDetailsContainer}>
              <Text style={{ ...styles.h2 }}>Work</Text>
              <Divider
                orientation="horizontal"
                width={2}
                inset={true}
                style={styles.divider}
                color={COLORS.navy}
              />
              {Object.entries(hero.work).map(([key, value, index]) => {
                // console.log(`${key}: ${value}`);
                let str = value;

                if (key != "base") {
                  str = str.replace(/,\s*(?![^()]*\))/g, "\n\u2022 ");
                }

                return (
                  <View
                    key={index}
                    style={{
                      flexDirection: key == "base" ? "row" : "column",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      marginBottom: 5,
                    }}
                  >
                    <Text style={styles.h4}>{key}:</Text>

                    {str.split(`/,[s]*/g, ", "`).map((value) => (
                      <Text
                        style={{ ...styles.p, textTransform: "capitalize" }}
                      >
                        {key != "base" && "-" ? "\u2022 " + value : "unknown"}
                      </Text>
                    ))}
                  </View>
                );
              })}
            </View>
            <View style={styles.heroDetailsContainer}>
              <Text style={{ ...styles.h2 }}>Connections</Text>
              <Divider
                orientation="horizontal"
                width={2}
                inset={true}
                style={styles.divider}
                color={COLORS.navy}
              />
              {Object.entries(hero.connections).map(([key, value, index]) => {
                console.log(`${key}: ${value}`);
                const str = value.replace(/,\s*(?![^()]*\))/g, "\n\u2022 ");
                // const firstLetter = str.charAt(0).toUpperCase() + str.slice(1);
                return (
                  <View
                    key={index}
                    style={{
                      // flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      marginBottom: 5,
                    }}
                  >
                    <Text style={styles.h4}>{key}:</Text>

                    {str.split(`/,[s]*/g, ", "`).map((value) => (
                      <Text
                        style={{
                          ...styles.p,
                          textTransform: "capitalize",
                          lineHeight: 24,
                        }}
                      >
                        {"\u2022 " + value}
                      </Text>
                    ))}
                  </View>
                );
              })}
            </View>
          </ScrollView>
          <LinearGradient
            colors={["#ffffff00", COLORS.beige]}
            style={styles.bottomFadeInfo}
            locations={[0.8, 1]}
            pointerEvents={"none"}
          />
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
    // padding: 20,
    // paddingTop: 40,
  },
  h4: {
    fontFamily: "Flame-Regular",
    fontSize: 15,
    textAlign: "left",
    color: COLORS.navy,
    textTransform: "capitalize",
    paddingVertical: 3,
  },
  h2: {
    fontFamily: "Flame-Regular",
    fontSize: 20,
    textAlign: "right",
    color: COLORS.navy,
    textTransform: "capitalize",
    paddingVertical: 3,
  },
  p: {
    fontFamily: "FlameSans-Regular",
    fontSize: 13,
    textAlign: "left",
    color: COLORS.navy,
    flexWrap: "wrap",
    paddingVertical: 3,
  },
  divider: {
    borderRadius: 30,
    marginBottom: 15,
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
    top: Platform.OS === "ios" ? -120 : -150,
    left: 0,
    zIndex: -2,
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
  heroDetailsContainer: {
    marginTop: 10,
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
    marginVertical: 20,
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
