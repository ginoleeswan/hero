import React, { useState } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { COLORS } from "../styles/colors";
import Carousel from "react-native-snap-carousel";

const api = {
  key: "4204884039587685",
};

const HomeScreen = ({ navigation }) => {
  const [popularCards, setPopularCards] = useState({
    activeIndex: 0,
    carouselItems: [
      {
        title: "Iron Man",
        id: "346",
        image: require("../assets/images/ironman.jpg"),
      },
      {
        title: "Spider Man",
        id: "620",
        image: require("../assets/images/spiderman.jpg"),
      },
      {
        title: "Captain America",
        id: "149",
        image: require("../assets/images/captain-america.jpg"),
      },
      {
        title: "Thor",
        id: "659",
        image: require("../assets/images/thor.jpg"),
      },
      {
        title: "Hulk",
        id: "332",
        image: require("../assets/images/hulk.jpg"),
      },
      {
        title: "Loki",
        id: "414",
        image: require("../assets/images/loki.jpg"),
      },
    ],
  });

  function search(item) {
    fetch(`https://superheroapi.com/api/${api.key}/${item.id}/`)
      .then((res) => {
        if (res.status === 404) {
          throw new Error("I didn't find this hero. Please try again!");
        } else {
          return res.json();
        }
      })

      .then((result) => {
        console.log(result.name);
        navigation.navigate("Character", { hero: result, image: item.image });
      });
  }

  const handlePress = (item) => {
    console.log(`Pressed ${item.title}`);
  };

  const _renderItem = ({ item }) => {
    return (
      <Pressable
        activeOpacity={0.8}
        onPress={() => {
          // navigation.navigate("Search");
          // handlePress(item);
          search(item);
        }}
        // key={index}
        style={{
          backgroundColor: "floralwhite",
          borderRadius: 20,
          height: 300,
          // padding: 30,
          marginLeft: 5,
          marginRight: 5,
          shadowColor: "#000",

          shadowOffset: {
            width: 0,
            height: 6,
          },
          shadowOpacity: 0.39,
          shadowRadius: 8.3,

          elevation: 13,
        }}
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
            bottom: 0,
            padding: 20,
            width: "100%",
            justifyContent: "center",
            // backgroundColor: COLORS.navy,
            // opacity: 0.5,
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

  return (
    <View style={styles.appContainer}>
      <SafeAreaView>
        <View style={styles.header}>
          <View>
            <Text style={styles.appTitle}>hero</Text>
            <Text style={{ ...styles.p, fontSize: 9, marginTop: -8, left: 3 }}>
              the Superhero Encyclopedia
            </Text>
          </View>
        </View>
        <View style={styles.popularContainer}>
          <Text
            style={{ ...styles.h4, marginBottom: 20, paddingHorizontal: 20 }}
          >
            Popular
          </Text>
          {/* <View
            style={{ flex: 1, flexDirection: "row", justifyContent: "center" }}
          > */}
          <Carousel
            // layout={"default"}
            //   ref={ref => this.carousel = ref}
            data={popularCards.carouselItems}
            // firstItem={0}
            sliderWidth={380}
            itemWidth={260}
            renderItem={_renderItem}
            loop={true}
            inactiveSlideShift={-24}
            inactiveSlideOpacity={0.5}
            // onSnapToItem={(index) => setPopularCards({ activeIndex: index })}
          />
          {/* </View> */}
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
    fontFamily: "Nunito_900Black",
    fontSize: 28,
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
    paddingHorizontal: 20,
  },
  appTitle: {
    fontFamily: "Righteous_400Regular",
    fontSize: 60,
    textAlign: "left",
    color: COLORS.black,
  },
  popularContainer: {
    justifyContent: "space-around",
    alignItems: "flex-start",
  },
});

export default HomeScreen;
