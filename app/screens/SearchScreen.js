import React, { useContext, useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  KeyboardAvoidingView,
  ScrollView,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Image,
  Dimensions,
  StatusBar,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../styles/colors";
import { Avatar, colors, SearchBar } from "react-native-elements";
import { HeroesContext } from "../context/HeroesContext";
import * as Progress from "react-native-progress";
import { LinearGradient } from "expo-linear-gradient";

const apiComicVine = {
  key: "02dbe748c04865c7601c8c67ffb9a0e95438bbf1",
};

const api = {
  key: "4204884039587685",
};

let comicPicture = null;
let summary = null;
let firstIssue = null;
let firstIssueURL = null;
let publisher = null;

const SearchScreen = ({ navigation }) => {
  const [query, setQuery] = useState("");
  const [XMen, popularHeroes, villains] = useContext(HeroesContext);
  const [heroNames, setHeroNames] = useState([]);
  const [filteredHeroNames, setFilteredHeroNames] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchHeroes = async () => {
    try {
      setLoadingSearch(true);
      const response = await fetch(
        "https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/all.json"
      );
      const herojson = await response.json();

      setHeroNames(herojson);
      // heroNames.forEach((hero) => {
      //   console.log(hero.name);
      // });
      setLoadingSearch(false);
    } catch (error) {
      console.error(error);
      setLoadingSearch(false);
    }
  };

  const renderFooter = () => {
    if (!loadingSearch) return null;

    return (
      <View
        style={{
          paddingVertical: 20,
          borderTopWidth: 1,
          borderColor: "#CED0CE",
        }}
      >
        <ActivityIndicator animating size="large" />
      </View>
    );
  };

  const renderSeparator = () => {
    return (
      <View
        style={{
          height: 1,
          width: "86%",
          backgroundColor: COLORS.navy,
          borderRadius: 50,
          marginLeft: "7%",
        }}
      />
    );
  };

  const handleSearch = (text) => {
    const formattedQuery = text.toLowerCase();
    const data = heroNames.filter((item) => {
      // return contains(name, formattedQuery);
      return item.name.toLowerCase().includes(formattedQuery);
    });
    setFilteredHeroNames(data);
    setQuery(text);
    // this.setState({ data, query: text })
  };

  const search = async (item) => {
    try {
      setLoading(true);
      const searchResponse = await fetch(
        `https://superheroapi.com/api/${api.key}/${item.id}/`,
        {
          method: "GET",
        }
      );
      // console.log(item.biography.fullName);
      // const realName = item.biography.fullName.text();
      const characterResponse = await fetch(
        `https://comicvine.gamespot.com/api/characters/?api_key=${apiComicVine.key}&filter=name:${item.name},publisher:${item.biography.publisher},real_name:${item.biography.fullName},origin:${item.appearance.race}&field_list=deck,publisher,first_appeared_in_issue&format=json`,
        {
          method: "GET",
        }
      );
      const hero = await searchResponse.json();
      const characterInfo = await characterResponse.json();
      // console.log(characterInfo);
      {
        characterInfo.results[0].deck == undefined
          ? (summary = "no summary")
          : (summary = characterInfo.results[0].deck);
      }
      // summary = characterInfo.results[0].deck;
      firstIssue = characterInfo.results[0].first_appeared_in_issue;
      publisher = characterInfo.results[0].publisher.name;
      const firstComicResponse = await fetch(
        `https://comicvine.gamespot.com/api/issue/4000-${firstIssue.id}/?api_key=${apiComicVine.key}&format=json`,
        {
          method: "GET",
        }
      );
      const firstComicInfo = await firstComicResponse.json();
      // console.log(firstComicInfo);
      firstIssueURL = firstComicInfo.results.image.original_url;
      navigation.navigate("Character", {
        hero: hero,
        image: { uri: item.images.lg },
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
      Alert.alert("Sorry!", "Hero Not Found");
    }
  };

  useEffect(() => {
    fetchHeroes();
    setLoading(false);
  }, []);

  return (
    <View style={styles.appContainer}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />
      <SafeAreaView>
        <View style={styles.header}>
          <Text style={styles.appTitle}>search</Text>
        </View>
        {/* <KeyboardAvoidingView
          style={{
            paddingHorizontal: 15,
            marginBottom: -20,
            zIndex: 5,
            backgroundColor: "transparent",
          }}
        > */}
        <SearchBar
          placeholder="Search..."
          onChangeText={handleSearch}
          value={query}
          containerStyle={styles.inputContainer}
          inputContainerStyle={styles.input}
          inputStyle={styles.inputText}
          searchIcon={{ size: 25 }}
          round={true}
        />
        {/* </KeyboardAvoidingView> */}
        <FlatList
          removeClippedSubviews={true}
          initialNumToRender={3}
          style={{
            width: "100%",
            marginTop: 20,
            paddingTop: 10,
            height: Platform.OS === "ios" ? 580 : 590,
          }}
          data={
            filteredHeroNames && filteredHeroNames.length > 0
              ? filteredHeroNames
              : heroNames
          }
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => search(item)}>
              <View
                style={{
                  flexDirection: "row",
                  padding: 10,
                  paddingHorizontal: 15,
                  alignItems: "center",
                  // backgroundColor: COLORS.navy,
                  // marginBottom: 15,
                  // marginHorizontal: 10,
                  borderRadius: 15,
                }}
              >
                <Avatar
                  rounded
                  source={{ uri: item.images.md }}
                  size="medium"
                  containerStyle={{
                    marginRight: 13,
                    borderColor: COLORS.navy,
                    borderWidth: 2,
                  }}
                />
                {/* <Image
                  source={{ uri: item.images.sm }}
                  style={{ width: "100%", height: 90, borderRadius: 10 }}
                /> */}
                <Text
                  style={{
                    ...styles.p,
                    fontFamily: "Flame-Regular",
                    color: COLORS.navy,
                    // position: "absolute",
                    // left: 10,
                  }}
                >
                  {item.name}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id.toString()}
          ItemSeparatorComponent={renderSeparator}
          ListFooterComponent={renderFooter}
          // ListHeaderComponent={}
        />
        <LinearGradient
          colors={[COLORS.beige, "#ffffff00"]}
          style={styles.scrollGradient}
          locations={[0, 1]}
          pointerEvents={"none"}
        />
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
            </View>
          </Modal>
        ) : null}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    width: "100%",
    backgroundColor: COLORS.beige,
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
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  appTitle: {
    fontFamily: "Righteous_400Regular",
    fontSize: 50,
    textAlign: "left",
    color: COLORS.navy,
  },
  inputContainer: {
    width: "95%",
    marginBottom: -25,
    left: 8,
    paddingHorizontal: 5,

    height: 50,
    backgroundColor: COLORS.navy,
    // borderColor: COLORS.black,
    justifyContent: "center",
    alignItems: "center",
    // borderWidth: 2,
    borderRadius: 20,
    zIndex: 2,
  },
  input: {
    backgroundColor: "transparent",
    width: "100%",
    borderColor: COLORS.navy,
    borderWidth: 2,
    borderRadius: 20,
  },
  inputText: {
    fontFamily: "Nunito_400Regular",
    fontSize: 16,
    color: COLORS.beige,
  },
  loading: {
    top: -20,
  },
  scrollGradient: {
    position: "absolute",
    top: Platform.OS === "ios" ? 160 : 140,
    left: 0,
    width: "100%",
    height: 40,
    zIndex: 1,
  },
});

export default SearchScreen;
