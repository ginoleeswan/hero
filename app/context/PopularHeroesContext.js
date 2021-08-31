import React, { useState, createContext } from "react";

export const PopularHeroesContext = createContext();

export const PopularHeroesProvider = (props) => {
  const [popularHeroes, setPopularHeroes] = useState([
    {
      title: "Spider-Man",
      id: "620",
      publisher: "Marvel Comics",
      image: require("../assets/images/spiderman.jpg"),
    },
    {
      title: "Iron Man",
      id: "346",
      publisher: "Marvel Comics",
      image: require("../assets/images/ironman.jpg"),
    },
    {
      title: "Batman",
      id: "70",
      publisher: "DC Comics",
      image: require("../assets/images/batman.jpg"),
    },
    {
      title: "Superman",
      real_name: "Clark Kent",
      id: "644",
      publisher: "DC Comics",
      image: require("../assets/images/superman.jpg"),
    },
    {
      title: "Joker",
      id: "370",
      publisher: "DC Comics",
      image: require("../assets/images/joker.jpg"),
    },
    {
      title: "Captain America",
      id: "149",
      publisher: "Marvel Comics",
      image: require("../assets/images/captain-america.jpg"),
    },
    {
      title: "Wonder Woman",
      id: "720",
      publisher: "DC Comics",
      image: require("../assets/images/wonder-woman.jpg"),
    },
    {
      title: "Wolverine",
      id: "717",
      publisher: "Marvel Comics",
      image: require("../assets/images/wolverine.jpg"),
    },
    {
      title: "Thor",
      id: "659",
      publisher: "Marvel Comics",
      image: require("../assets/images/thor.jpg"),
    },
    {
      title: "Hulk",
      id: "332",
      publisher: "Marvel Comics",
      image: require("../assets/images/hulk.jpg"),
    },
    {
      title: "Deadpool",
      id: "213",
      publisher: "Marvel Comics",
      image: require("../assets/images/deadpool.jpg"),
    },
    {
      title: "Hawkeye",
      id: "313",
      publisher: "Marvel Comics",
      image: require("../assets/images/hawkeye.jpg"),
    },
    {
      title: "Loki",
      id: "414",
      publisher: "Marvel Comics",
      image: require("../assets/images/loki.jpg"),
    },
    {
      title: "Venom",
      id: "687",
      publisher: "Marvel Comics",
      image: require("../assets/images/venom.jpeg"),
    },
    {
      title: "Star Lord",
      id: "630",
      publisher: "Marvel Comics",
      image: require("../assets/images/star-lord.jpg"),
    },
    {
      title: "Black Panther",
      id: "106",
      publisher: "Marvel Comics",
      image: require("../assets/images/black-panther.jpg"),
    },
    {
      title: "Ant Man",
      id: "30",
      publisher: "Marvel",
      image: require("../assets/images/ant-man.jpg"),
    },
  ]);

  return (
    <PopularHeroesContext.Provider value={[popularHeroes, setPopularHeroes]}>
      {props.children}
    </PopularHeroesContext.Provider>
  );
};
