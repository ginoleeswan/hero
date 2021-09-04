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
  SafeAreaView,
  Alert,
} from "react-native";
import { COLORS } from "../styles/colors";
import { Avatar, colors, SearchBar } from "react-native-elements";
import { HeroesContext } from "../context/HeroesContext";
import * as Progress from "react-native-progress";

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

  const fetchHeroes = () => {
    try {
      setLoadingSearch(true);
      fetch(
        "https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/all.json"
      )
        .then((res) => res.json())
        .then((res) => {
          setHeroNames(res);
          heroNames.forEach((hero) => {
            console.log(hero.name);
          });
        });
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
          width: "90%",
          backgroundColor: COLORS.navy,
          marginLeft: "5%",
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
        `https://superheroapi.com/api/${api.key}/${item.id}/`
      );
      const characterResponse = await fetch(
        `https://comicvine.gamespot.com/api/characters/?api_key=${apiComicVine.key}&filter=name:${item.name},aliases:${item.biography.aliases},publisher:${item.biography.publisher},real_name:${item.biography.fullName},first_appeared_in_issue:${item.biography.firstAppearance},origin:${item.appearance.race}&field_list=deck,publisher,first_appeared_in_issue&format=json`
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
      <SafeAreaView>
        <View style={styles.header}>
          <Text style={styles.appTitle}>search</Text>
        </View>
        <KeyboardAvoidingView style={{ paddingHorizontal: 30 }}>
          <SearchBar
            placeholder="Type Here..."
            onChangeText={handleSearch}
            value={query}
            containerStyle={styles.inputContainer}
            inputContainerStyle={styles.input}
            inputStyle={styles.inputText}
            searchIcon={{ size: 25 }}
            round={true}
          />
        </KeyboardAvoidingView>
        <FlatList
          style={{ width: "100%", marginTop: 20, height: 559 }}
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
                  padding: 16,
                  alignItems: "center",
                }}
              >
                <Avatar
                  rounded
                  source={{ uri: item.images.sm }}
                  size="medium"
                  containerStyle={{ marginRight: 16 }}
                />
                <Text style={styles.p}>{item.name}</Text>
              </View>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id.toString()}
          ItemSeparatorComponent={renderSeparator}
          ListFooterComponent={renderFooter}
          // ListHeaderComponent={}
        />
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
    paddingHorizontal: 30,
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
  loading: {
    position: "absolute",
    top: 200,
    left: 145,
  },
});

export default SearchScreen;
