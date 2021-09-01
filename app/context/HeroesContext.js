import React, { useState, createContext } from "react";

export const HeroesContext = createContext();

export const HeroesProvider = (props) => {
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
      title: "Doctor Strange",
      id: "226",
      publisher: "Marvel Comics",
      image: require("../assets/images/doctor-strange.jpg"),
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

  const [villains, setVillains] = useState([
    {
      title: "Joker",
      id: "370",
      publisher: "DC Comics",
      image: require("../assets/images/joker.jpg"),
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
      title: "Doctor Doom",
      id: "222",
      publisher: "Marvel Comics",
      image: require("../assets/images/doctor-doom.jpg"),
    },
    {
      title: "Mysterio",
      id: "479",
      publisher: "Marvel Comics",
      image: require("../assets/images/mysterio.jpg"),
    },
    {
      title: "Terminator",
      id: "650",
      publisher: "Dark Horse Comics",
      image: require("../assets/images/terminator.jpeg"),
    },
    {
      title: "Doctor Octopus",
      id: "225",
      publisher: "Marvel Comics",
      image: require("../assets/images/doctor-octopus.jpg"),
    },
    {
      title: "Darth Vader",
      id: "208",
      publisher: "Marvel Comics",
      image: require("../assets/images/darth-vader.jpg"),
    },
    {
      title: "Green Goblin",
      id: "299",
      publisher: "Marvel Comics",
      image: require("../assets/images/green-goblin.jpg"),
    },
    {
      title: "Magneto",
      id: "423",
      publisher: "Marvel Comics",
      image: require("../assets/images/magneto.jpg"),
    },
  ]);

  const [XMen, setXMen] = useState([
    {
      title: "Wolverine",
      id: "717",
      publisher: "Marvel Comics",
      image: require("../assets/images/wolverine.jpg"),
    },
    {
      title: "Cyclops",
      id: "196",
      publisher: "Marvel Comics",
      image: require("../assets/images/cyclops.jpg"),
    },
    {
      title: "Mystique",
      id: "480",
      publisher: "Marvel Comics",
      image: require("../assets/images/mystique.jpg"),
    },
    {
      title: "Storm",
      id: "638",
      publisher: "Marvel Comics",
      image: require("../assets/images/storm.jpg"),
    },
    {
      title: "Beast",
      id: "75",
      publisher: "Marvel Comics",
      image: require("../assets/images/beast.jpg"),
    },
    {
      title: "Rogue",
      id: "567",
      publisher: "Marvel Comics",
      image: require("../assets/images/rogue.jpg"),
    },
    {
      title: "Colossus",
      id: "185",
      publisher: "Marvel Comics",
      image: require("../assets/images/colossus.png"),
    },
    {
      title: "Nightcrawler",
      id: "490",
      publisher: "Marvel Comics",
      image: require("../assets/images/nightcrawler.jpg"),
    },
    {
      title: "Weapon X",
      id: "710",
      publisher: "Marvel Comics",
      image: require("../assets/images/weapon-x.jpg"),
    },
    {
      title: "Gambit",
      id: "274",
      publisher: "Marvel Comics",
      image: require("../assets/images/gambit.jpg"),
    },
  ]);

  return (
    <HeroesContext.Provider value={[XMen, popularHeroes, villains]}>
      {props.children}
    </HeroesContext.Provider>
  );
};
