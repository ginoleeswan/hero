import React, { useState, useContext, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Image,
  Pressable,
  Animated,
  ActivityIndicator,
  Dimensions,
  StatusBar,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../styles/colors";
import Carousel from "react-native-snap-carousel";
import axios from "axios";
import * as Progress from "react-native-progress";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HeroesContext } from "../context/HeroesContext";
import { ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Modal } from "react-native";

const api = {
  key: "4204884039587685",
};
const apiComicVine = {
  key: "02dbe748c04865c7601c8c67ffb9a0e95438bbf1",
};

let comicPicture = null;
let summary = null;
let firstIssue = null;
let firstIssueURL = null;
let publisher = null;

const HomeScreen = ({ navigation }) => {
  const [XMen, popularHeroes, villains] = useContext(HeroesContext);
  const [loading, setLoading] = useState(false);

  const insets = useSafeAreaInsets();

  const scrollY = new Animated.Value(0);
  const translateY = scrollY.interpolate({
    inputRange: [40, 100 + insets.top],
    outputRange: [40, insets.top - 100],
    extrapolate: "clamp",
  });

  const animation = new Animated.Value(0);
  const inputRange = [0, 1];
  const outputRange = [1, 0.8];
  const scale = animation.interpolate({ inputRange, outputRange });

  const onPressIn = () => {
    Animated.spring(animation, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };
  const onPressOut = () => {
    Animated.spring(animation, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
  };

  const search = async (item) => {
    try {
      setLoading(true);
      const searchResponse = await fetch(
        `https://superheroapi.com/api/${api.key}/${item.id}/`
      );
      const characterResponse = await fetch(
        `https://comicvine.gamespot.com/api/characters/?api_key=${apiComicVine.key}&filter=name:${item.title},publisher${item.publisher}&field_list=deck,publisher,first_appeared_in_issue&format=json`
      );
      const hero = await searchResponse.json();
      const characterInfo = await characterResponse.json();
      summary = characterInfo.results[0].deck;
      firstIssue = characterInfo.results[0].first_appeared_in_issue;
      publisher = characterInfo.results[0].publisher.name;
      const firstComicResponse = await fetch(
        `https://comicvine.gamespot.com/api/issue/4000-${firstIssue.id}/?api_key=${apiComicVine.key}&format=json`
      );
      const firstComicInfo = await firstComicResponse.json();
      firstIssueURL = firstComicInfo.results.image.original_url;
      navigation.navigate("Character", {
        hero: hero,
        image: item.image,
        // publisher: item.publisher,
        comicPicture: comicPicture,
        summary: summary,
        firstIssue: firstIssue,
        firstIssueURL: firstIssueURL,
        publisher: publisher,
      });
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const _renderItem = ({ item }) => {
    return (
      <Animated.View
        key={item.id}
        // style={[{ transform: [{ scale }] }]}
      >
        <Pressable
          // unstable_pressDelay={5000}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onPress={() => {
            search(item);
            // console.log(item.id);
          }}
          style={({ pressed }) => [
            styles.heroCard,
            { opacity: pressed ? 0.8 : 1.0 },
          ]}
          // style={styles.heroCard}
        >
          <View
            style={{
              justifyContent: "center",
              alignItems: "center",
              width: "100%",
              height: "100%",
            }}
          >
            <Image
              source={item.image}
              style={{
                width: "100%",
                height: "100%",
                resizeMode: "cover",
                borderRadius: 20,
              }}
            />
          </View>
          <View
            style={{
              flex: 1,
              position: "absolute",
              bottom: -5,
              padding: 20,
              width: "100%",
              justifyContent: "center",
              borderRadius: 20,
            }}
          >
            <Text
              style={{
                ...styles.h4,
                fontSize: 20,
                color: COLORS.beige,
                textShadowColor: "rgba(0, 0, 0, 1)",
                textShadowOffset: { width: -1, height: 1 },
                textShadowRadius: 5,
              }}
            >
              {item.title}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  useEffect(() => {
    setLoading(false);
  }, []);

  return (
    <>
      <View style={styles.appContainer}>
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle="dark-content"
        />
        <SafeAreaView
          style={{
            flex: 1,
            width: Dimensions.get("window").width,
          }}
          forceInset={{ top: "always" }}
        >
          <Animated.View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10,
              height: 100,
              transform: [{ translateY: translateY }],
            }}
          >
            <View style={styles.header}>
              <View style={{ justifyContent: "flex-end" }}>
                <Text style={styles.appTitle}>hero</Text>
                <Text
                  style={{ ...styles.p, fontSize: 7, marginTop: -2, left: -2 }}
                >
                  the Superhero Encyclopedia
                </Text>
              </View>
            </View>
          </Animated.View>
          <ScrollView
            contentContainerStyle={{
              paddingBottom: 80,
              width: Dimensions.get("window").width,
            }}
            onScroll={(e) => {
              scrollY.setValue(e.nativeEvent.contentOffset.y);
            }}
            scrollEventThrottle={6}
          >
            <View style={styles.popularContainer}>
              <Text
                style={{
                  ...styles.h4,
                  marginBottom: 10,
                  paddingHorizontal: 15,
                }}
              >
                Popular
              </Text>

              <Carousel
                data={popularHeroes}
                sliderWidth={380}
                itemWidth={260}
                renderItem={_renderItem}
                loop={true}
                inactiveSlideShift={0}
                inactiveSlideOpacity={Platform.OS === "ios" ? 0.5 : 1}
              />
            </View>
            <View style={styles.heroContainer}>
              <Text
                style={{
                  ...styles.h4,
                  marginBottom: 10,
                  paddingHorizontal: 15,
                }}
              >
                Villains
              </Text>

              <Carousel
                data={villains}
                sliderWidth={380}
                itemWidth={260}
                renderItem={_renderItem}
                loop={true}
                // inactiveSlideShift={-24}
                inactiveSlideOpacity={Platform.OS === "ios" ? 0.5 : 1}
              />
            </View>
            <View style={styles.heroContainer}>
              <Text
                style={{
                  ...styles.h4,
                  marginBottom: 10,
                  paddingHorizontal: 15,
                }}
              >
                X-Men
              </Text>

              <Carousel
                data={XMen}
                sliderWidth={380}
                itemWidth={260}
                renderItem={_renderItem}
                loop={true}
                // inactiveSlideShift={-24}
                inactiveSlideOpacity={Platform.OS === "ios" ? 0.5 : 1}
              />
            </View>
          </ScrollView>
          {/* )} */}
          {/* <LinearGradient
          colors={[COLORS.beige, "#ffffff00"]}
          style={styles.scrollGradient}
          locations={[0, 1]}
          pointerEvents={"none"}
        /> */}
        </SafeAreaView>
      </View>
      {loading === true ? (
        <Modal statusBarTranslucent={true}>
          <View
            style={{
              backgroundColor: COLORS.beige,
              width: "100%",
              height: "100%",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Progress.CircleSnail
              color={[COLORS.navy, COLORS.orange, COLORS.blue]}
              size={80}
              thickness={10}
              style={styles.loading}
              strokeCap={"round"}
            />
            <Text
              style={{
                ...styles.p,
                fontFamily: "Flame-Regular",
                marginTop: -20,
                left: 3,
              }}
            >
              loading...
            </Text>
          </View>
        </Modal>
      ) : null}
    </>
  );
};

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    // height: Dimensions.get("window").height,
    // width: Dimensions.get("window").width,
    justifyContent: "flex-start",
    alignItems: "flex-start",
    backgroundColor: COLORS.beige,
  },
  h4: {
    fontFamily: "Flame-Regular",
    width: "100%",
    fontSize: 28,
    textAlign: "left",
    color: COLORS.navy,
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
    height: 50,
    justifyContent: "flex-end",
    alignItems: "center",
    // marginBottom: 20,
    paddingHorizontal: 20,
  },
  appTitle: {
    fontFamily: "Righteous_400Regular",
    fontSize: 40,
    textAlign: "right",
    color: COLORS.navy,
  },
  popularContainer: {
    justifyContent: "space-around",
    alignItems: "flex-start",
    marginTop: 40,
  },
  heroContainer: {
    width: "100%",
    justifyContent: "space-around",
    alignItems: "flex-start",
  },
  heroCard: {
    borderRadius: 20,
    height: 300,
    marginHorizontal: 5,
    marginBottom: 25,
    marginTop: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.39,
    shadowRadius: 8.3,

    elevation: 13,
  },
  scrollGradient: {
    position: "absolute",
    top: 94,
    left: 0,
    width: "100%",
    height: 200,
  },
  loading: { top: -20 },
});

export default HomeScreen;
