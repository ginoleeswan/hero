import React, { useState, useContext, useEffect } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  Image,
  Pressable,
  Animated,
  ActivityIndicator,
} from "react-native";
import { COLORS } from "../styles/colors";
import Carousel from "react-native-snap-carousel";
import axios from "axios";
import * as Progress from "react-native-progress";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HeroesContext } from "../context/HeroesContext";
import { ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

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
    }
  };

  const _renderItem = ({ item }) => {
    return (
      <Pressable
        activeOpacity={0.8}
        onPress={() => {
          search(item);
        }}
        style={styles.heroCard}
      >
        <View
          style={{
            justifyContent: "center",
            alignItems: "center",
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
    );
  };

  useEffect(() => {
    setLoading(false);
  }, []);

  return (
    <>
      <View style={styles.appContainer}>
        <SafeAreaView style={{ flex: 1 }} forceInset={{ top: "always" }}>
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
            contentContainerStyle={{ paddingBottom: 80 }}
            onScroll={(e) => {
              scrollY.setValue(e.nativeEvent.contentOffset.y);
            }}
            scrollEventThrottle={6}
          >
            <View style={styles.popularContainer}>
              <Text
                style={{
                  ...styles.h4,
                  marginBottom: 20,
                  paddingHorizontal: 20,
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
                inactiveSlideOpacity={0.5}
              />
            </View>
            <View style={styles.heroContainer}>
              <Text
                style={{
                  ...styles.h4,
                  marginBottom: 20,
                  paddingHorizontal: 20,
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
                inactiveSlideOpacity={0.5}
              />
            </View>
            <View style={styles.heroContainer}>
              <Text
                style={{
                  ...styles.h4,
                  marginBottom: 20,
                  paddingHorizontal: 20,
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
                inactiveSlideOpacity={0.5}
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
      {loading && (
        <View
          style={{
            position: "ablsolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: COLORS.beige,
          }}
        >
          <Progress.CircleSnail
            color={[COLORS.navy, COLORS.orange, COLORS.blue]}
            size={80}
            thickness={10}
            style={styles.loading}
            strokeCap={"round"}
          />
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "flex-start",
    backgroundColor: COLORS.beige,
  },
  h4: {
    fontFamily: "Nunito_900Black",
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
    color: COLORS.black,
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
    marginBottom: 20,
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
  loading: {
    position: "absolute",
    top: 300,
    left: 145,
  },
});

export default HomeScreen;
