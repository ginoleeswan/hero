import React, { useState, createContext } from "react";

export const VillainsContext = createContext();

export const VillainsProvider = (props) => {
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
  ]);

  return (
    <VillainsContext.Provider value={[villains, setVillains]}>
      {props.children}
    </VillainsContext.Provider>
  );
};
