
update heroes set
  full_name         = 'Logan',
  gender            = 'Male',
  alignment         = 'neutral',
  race              = 'Mutant',
  eye_color         = 'Brown',
  hair_color        = 'Black',
  height_imperial   = '5''3"',
  height_metric     = '160 cm',
  weight_imperial   = '300 lb',
  weight_metric     = '136 kg',
  occupation        = 'Assassin; Test Subject',
  base              = 'Weapon X Facility, Alberta, Canada',
  group_affiliation = 'Weapon X Program',
  intelligence      = 63,
  strength          = 32,
  speed             = 50,
  durability        = 100,
  power             = 89,
  combat            = 100,
  summary           = 'Abducted by the clandestine Weapon X program, the mutant known as Logan was subjected to the most brutal experiment in history — the forced bonding of indestructible adamantium metal to his skeleton. Stripped of identity and memory, and conditioned as the perfect killing machine, Weapon X eventually broke free of his programming and reclaimed his humanity as Wolverine.',
  description       = 'The man who would become Weapon X was Logan — a mutant with a regenerative healing factor, enhanced animal senses, and retractable bone claws. The secret Weapon X program, run by the enigmatic Professor and his team, selected Logan as their ideal test subject and subjected him to the adamantium bonding process: a procedure so agonising it should have killed him. Only his healing factor kept him alive. Emerging with an adamantium-laced skeleton and claws that could cut through almost anything, he was unleashed as a mindless killing machine — until his feral instincts overwhelmed his conditioning and he escaped into the Canadian wilderness. The story, told in Marvel Comics Presents #72–84, is one of the most celebrated origin arcs in comics history.',
  powers            = array[
    'Regenerative healing factor',
    'Adamantium-laced skeleton',
    'Retractable adamantium claws',
    'Superhuman senses (smell, hearing, sight)',
    'Superhuman agility and reflexes',
    'Resistance to psychic manipulation',
    'Longevity'
  ],
  enriched_at       = now()
where id = '710';
;
