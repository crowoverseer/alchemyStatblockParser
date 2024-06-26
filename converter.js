/**
 * Alchemy NPC parser
 * @author Leonid Ponomarev aka Atrill
 */

const spellDb = require("./spells");

const ABILITY_REGEX =
  /STR[\s]*(?<str>\d+)[\s()\+\-\d–]*?DEX[\s]*(?<dex>\d+)[\s()\+\-\d–]*?CON[\s]*(?<con>\d+)[\s()\+\-\d–]*?INT[\s]*(?<int>\d+)[\s()\+\-\d–]*?WIS[\s]*(?<wis>\d+)[\s()\+\-\d–]*?CHA[\s]*(?<cha>\d+)/gi;
const RETURN = "[r]";
const DOUBLE_RETURN = "[rr]";

let publicDescr = false;
let insertIntoUniverse = false;
let universeId, moduleId;
let source = [];

const npc = {
  proficiencies: [],
  textBlocks: [],
  race: "NPC",
  isNPC: true,
};

// Get command line parameters
if (process.argv.length < 3) {
  console.log("USAGE: node converter [options?] [soucefile] > result.json");
  console.log("  p - public description");
  console.log("  u universeId moduleId - insert into universe");
  return;
}
let sourcefile = process.argv[process.argv.length - 1];
process.argv.forEach((arg) => {
  switch (arg) {
    case "p":
      publicDescr = true;
      break;
    case "u":
      insertIntoUniverse = true;
      break;
    default:
      if (insertIntoUniverse && !universeId) {
        universeId = arg;
      } else if (insertIntoUniverse && universeId && !moduleId) {
        moduleId = arg;
      }
  }
});

const findAndShift = (pattern, group) => {
  let found = "";
  source = source.reduce((acc, line) => {
    if (found) {
      acc.push(line);
      return acc;
    }
    found = pattern.exec(line);
    if (!found) {
      acc.push(line);
    } else {
      // console.log(found)
      found = group
        ? Array.isArray(group)
          ? found.groups
          : found.groups[group]
        : found[0];
    }
    return acc;
  }, []);
  return found ?? (Array.isArray(group) && {});
};
const find = (pattern, group) => {
  for (let i = 0; i < source.length; i++) {
    const found = pattern.exec(source[i]);
    if (found) {
      // console.log( found )
      return group
        ? Array.isArray(group)
          ? found.groups
          : found.groups[group]
        : found[0];
    }
  }
  return "" ?? (Array.isArray(group) && {});
};
const findLineNumber = (pattern, shift = false) => {
  for (let i = 0; i < source.length; i++) {
    if (pattern.test(source[i])) {
      if (shift) {
        source.splice(i, 1);
      }
      return i;
    }
  }
  return -1;
};
const capitalize = (text) =>
  text
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const getProfByChallenge = (challenge) =>
  Math.floor(2 + ((Number(challenge) || 1) - 1) / 4);

const getAbilityBonusByScore = (score = 10) => Math.floor((score - 10) / 2);

const getAbilityBonus = (ability) =>
  getAbilityBonusByScore(
    npc.abilityScores.find((abilItem) => abilItem.name === ability).value
  );

/// ============ PARSERS ===============

const prepareSource = () => {
  let descriptionPassed = false;
  descriptionRegexp = /^(Description|About)/i;

  source = source.filter((line) => {
    if (!descriptionPassed && descriptionRegexp.test(line)) {
      descriptionPassed = true;
    }
    if (descriptionPassed) {
      return true;
    }
    return line.length;
  });
};

const parseName = () => {
  const name = source.shift();
  npc.name = capitalize(name.toLowerCase()).replace(" Of ", " of ");
};

const removeProficiency = () => {
  findAndShift(/^Proficiency/i);
};

const parseSizeAndType = () => {
  const regexp = /^(Tiny|Small|Medium|Large|Huge|Gargantuan).*,/;
  let npctypeline = find(regexp);
  if (!npctypeline) {
    return;
  }
  const [size, npctype] = npctypeline.split(",")[0].split(" ");
  npc.size = capitalize(size);
  npc.type = capitalize(npctype);
};

const parseAlignment = () => {
  let alignment =
    findAndShift(
      /(lawful|neutral|chaotic|unaligned|any)\s?(good|evil|neutral|alignment)?/i
    ) ?? "neutral";
  npc.alignment = capitalize(alignment.trim());
};

const parseAC = () => {
  // Armor Class 20 (plate, shield)
  const { ac, type } =
    findAndShift(
      /^Armor Class.*?\(.*?(?<ac>\d+)/i, // alternate armor class
      "ac"
    ) ||
    findAndShift(/^Armor Class\s?(?<ac>\d+)\s*\(?(?<type>[^,\)]*)/i, [
      "ac",
      "type",
    ]);
  npc.armorClass = Number(ac);
  npc.armorType = type ? capitalize(type) : "--";
};

const parseHPAndXP = () => {
  const { hitDice, hp } = findAndShift(
    /Hit Points\s?(?<hp>\d+)\s\(?(?<hitDice>.*?)\)?$/i,
    ["hp", "hitDice"]
  );
  const xp = find(/Challenge.*?\((?<xp>[\d,]+)\s?XP\)/i, "xp").replace(",", "");

  if (hp === undefined) {
    console.error("HP not found");
    process.exit(1);
  }

  npc.hitDice = hitDice;
  npc.trackers = [
    {
      category: "experience",
      color: "Yellow",
      max: Number(xp),
      name: "XP",
      type: "Bar",
      value: Number(xp),
    },
    {
      category: "health",
      color: "Green",
      max: Number(hp),
      name: "HP",
      type: "Bar",
      value: Number(hp),
    },
  ];
};

const parseSpeed = () => {
  //Speed 30 ft., climb 30ft.
  const speedline = findAndShift(/Speed\s?(?<speeds>.*)$/i, "speeds");
  const speeds = speedline
    .split(/\s?ft\.,?\s?/)
    .map((speed) => speed.trim())
    .filter(Boolean);

  const movementModes = [];
  let gotWalk = false,
    defaultSpeed = "";
  speeds.forEach((speedStr, idx) => {
    let [mode, speed] = speedStr.split(" ");
    if (!speed) {
      speed = mode;
      mode = "Walking";
    }
    movementModes.push({
      mode: capitalize(mode),
      distance: Number(speed),
    });
    if (
      !gotWalk &&
      (/(Walk|Walking)/i.test(mode) || idx == speeds.length - 1)
    ) {
      gotWalk = true;
      defaultSpeed = speed;
    }
  });
  npc.speed = Number(defaultSpeed);
  npc.movementModes = movementModes;
};

const parseAbilityScores = () => {
  const { str, dex, con, int, wis, cha } = findAndShift(ABILITY_REGEX, [
    "str",
    "dex",
    "con",
    "int",
    "wis",
    "cha",
  ]);
  npc.abilityScores = [
    {
      name: "str",
      value: Number(str),
    },
    {
      name: "dex",
      value: Number(dex),
    },
    {
      name: "con",
      value: Number(con),
    },
    {
      name: "int",
      value: Number(int),
    },
    {
      name: "wis",
      value: Number(wis),
    },
    {
      name: "cha",
      value: Number(cha),
    },
  ];
};

const parseChallenge = () => {
  const challenge = findAndShift(
    /Challenge\s*(rating)?\s*?(?<challenge>[\d\/]+)\s*?\(([\d,]+)\s?XP\)/i,
    "challenge"
  );
  npc.challengeRating = challenge;
  const prof = getProfByChallenge(npc.challengeRating);
  npc.proficiencyBonus = prof;
};

const parseSavingThrows = () => {
  //Saving ThrowsStr +0, Dex +3, Con +2, Int +1, Wis +2, Cha +0
  const { strt, dext, cont, intt, wist, chat } = findAndShift(
    /Saving Throws\s*?((Str\s?\+?)(?<strt>[\d-]+))?,?\s*?((Dex\s?\+?)(?<dext>[\d-]+))?,?\s*?((Con\s?\+?)?(?<cont>[\d-]+))?,?\s*?((Int\s?\+?)?(?<intt>[\d-]+))?,?\s*?((Wis\s?\+?)?(?<wist>[\d-]+))?,?\s*?((Cha\s?\+?)?(?<chat>[\d-]+))?\s*?$/i,
    ["strt", "dext", "cont", "intt", "wist", "chat"]
  );
  const calculatedThrows = {
    strt: getAbilityBonus("str"),
    dext: getAbilityBonus("dex"),
    cont: getAbilityBonus("con"),
    intt: getAbilityBonus("int"),
    wist: getAbilityBonus("wis"),
    chat: getAbilityBonus("cha"),
  };
  // checking the difference
  if (calculatedThrows.strt < strt) {
    npc.proficiencies.push({
      name: "Strength",
      type: "save",
    });
  }
  if (calculatedThrows.dext < dext) {
    npc.proficiencies.push({
      name: "Dexterity",
      type: "save",
    });
  }
  if (calculatedThrows.cont < cont) {
    npc.proficiencies.push({
      name: "Constitution",
      type: "save",
    });
  }
  if (calculatedThrows.intt < intt) {
    npc.proficiencies.push({
      name: "Intelligence",
      type: "save",
    });
  }
  if (calculatedThrows.wist < wist) {
    npc.proficiencies.push({
      name: "Wisdom",
      type: "save",
    });
  }
  if (calculatedThrows.chat < chat) {
    npc.proficiencies.push({
      name: "Charisma",
      type: "save",
    });
  }
};

const createSkillProficiencies = (profarr) => {
  const skillAbilityTable = {
    Acrobatics: "dex",
    "Animal Handling": "wis",
    Arcana: "int",
    Athletics: "str",
    Deception: "cha",
    History: "int",
    Insight: "wis",
    Intimidation: "cha",
    Investigation: "int",
    Medicine: "wis",
    Nature: "int",
    Perception: "wis",
    Performance: "cha",
    Persuasion: "cha",
    Religion: "int",
    "Sleight of Hand": "dex",
    Stealth: "dex",
    Survival: "wis",
  };

  const result = [];

  Object.keys(skillAbilityTable).forEach((skillName) => {
    const abName = skillAbilityTable[skillName];
    const skillProf = {
      abilityName: abName,
      name: skillName,
      proficient:
        getAbilityBonus(abName) <
        Number(
          (profarr.find((skill) => skill.name == skillName) || {}).value || -10
        ),
    };
    result.push(skillProf);
  });

  return result;
};

// no double proficiencty implemented
const parseSkills = () => {
  // SkillsPerception +4, Stealth +5,
  const skillsrow = findAndShift(/^Skills(?<skillsrow>.*)/i, "skillsrow") || "";
  const profarr = skillsrow.split(",").reduce((acc, skill) => {
    skill = skill.trim();
    if (skill) {
      skill = skill.split(" ");
      let value = Number(skill.pop());
      const name = skill.join(" ");
      acc.push({ name, value });
    }
    return acc;
  }, []);
  npc.skills = createSkillProficiencies(profarr);
};

const parseSenses = () => {
  // Senses darkvision 60 ft., passive Perception 14
  // const perception = Number( find(
  //   /passive\s?Perception\s?(?<perception>\d+)/i,
  //   'perception'
  // ) || ( 10 + getAbilityBonus('wis') ) )

  const sensesline = findAndShift(
    /Senses\s?(?<senses>.*?)(passive|$)/i,
    "senses"
  );
  if (sensesline) {
    const senseRegexp = /(?<name>.*?)\s?(?<value>\d+)/i;
    const senses = sensesline.split(",");
    if (senses.length > 1) {
      senses.pop(); // deleting last ,
    }
    const sensesObjectsArray = senses
      .map((sense) => {
        const regResult = senseRegexp.exec(sense.trim());
        try {
          return {
            distance: Number(regResult.groups["value"]),
            name: capitalize(regResult.groups["name"]),
          };
        } catch (err) {}
      })
      .filter((sense) => sense);
    if (sensesObjectsArray.length) {
      npc.senses = sensesObjectsArray;
    }
  }
};

const parseLanguages = () => {
  // Languages Common, Draconic
  const languagesrow = findAndShift(
    /Languages\s?:?(?<languages>.*)$/i,
    "languages"
  );
  if (languagesrow) {
    const languages = languagesrow.split(",");
    languages.forEach((language) => {
      if (language !== "—" && language !== "-") {
        npc.proficiencies.push({
          name: capitalize(language.trim()),
          type: "language",
        });
      }
    });
  }
};

const parseConditionImmunities = () => {
  const immunitiesLine = findAndShift(
    /^Condition\sImmunities\s?(?<immunities>.*)$/i,
    "immunities"
  );
  if (!immunitiesLine) return;
  const immunities = immunitiesLine
    .split(",")
    .map((immunity) => capitalize(immunity.trim()));
  npc.conditionImmunities = immunities;
};

const parseDescription = () => {
  let descriptionSeparatorPos = findLineNumber(/^(Description|About)/i, true);
  if (descriptionSeparatorPos < 0) {
    return;
  }

  const description = source.slice(descriptionSeparatorPos).join("\n");
  source.splice(descriptionSeparatorPos);
  npc.description = description;

  if (publicDescr) {
    npc.isBackstoryPublic = true;
  }
};

const parseResistances = () => {
  //Damage Resistances Cold, Fire; Bludgeoning from nonmagial attacks
  const resistanceLine = findAndShift(
    /^Damage\sResistances\s?(?<resistances>.*?)$/i,
    "resistances"
  );
  if (!resistanceLine) return;
  let damageResistancesResult = [];
  resistanceLine.split(";").forEach((resBlock) => {
    const [resistances, condition = ""] = resBlock.split("from");
    resistances.split(",").forEach((resistance) => {
      damageResistancesResult.push({
        condition: condition.trim(),
        damageType: capitalize(resistance.trim().replace(/\s?and\s?/, "")),
      });
    });
  });
  npc.damageResistances = damageResistancesResult;
};

const parseImmunities = () => {
  //Damage Immunities Cold, Fire; Bludgeoning from nonmagial attacks
  const immunityLine = findAndShift(
    /^Damage\sImmunities\s?(?<immunities>.*?)$/i,
    "immunities"
  );
  if (!immunityLine) return;
  let damageImmunitiesResult = [];
  immunityLine.split(";").forEach((immBlock) => {
    const [immunities, condition = ""] = immBlock.split("from");
    immunities.split(",").forEach((immunity) => {
      damageImmunitiesResult.push({
        condition: condition.trim(),
        damageType: capitalize(immunity.trim().replace(/\s?and\s?/, "")),
      });
    });
  });
  npc.damageImmunities = damageImmunitiesResult;
};

const parseVulnerabilities = () => {
  //Damage Vulnerabilities Cold, Fire; Bludgeoning from nonmagial attacks
  const vulnerabilityLine = findAndShift(
    /^Damage\sVulnerabilities\s?(?<vulnerabilities>.*?)$/i,
    "vulnerabilities"
  );
  if (!vulnerabilityLine) return;
  let damageVulnerabilitiesResult = [];
  vulnerabilityLine.split(";").forEach((vulBlock) => {
    const [vulnerabilities, condition = ""] = vulBlock.split("from");
    vulnerabilities.split(",").forEach((vulnerability) => {
      damageVulnerabilitiesResult.push({
        condition: condition.trim(),
        damageType: capitalize(vulnerability.trim().replace(/\s?and\s?/, "")),
      });
    });
  });
  npc.damageVulnerabilities = damageVulnerabilitiesResult;
};

let knownSpells = [];
let spellSlots = [];
let knownSlots = [];
const SPELL_SLOTS_SAMPLE = [
  {
    max: 0,
    remaining: 0,
  },
  {
    max: 0,
    remaining: 0,
  },
  {
    max: 0,
    remaining: 0,
  },
  {
    max: 0,
    remaining: 0,
  },
  {
    max: 0,
    remaining: 0,
  },
  {
    max: 0,
    remaining: 0,
  },
  {
    max: 0,
    remaining: 0,
  },
  {
    max: 0,
    remaining: 0,
  },
  {
    max: 0,
    remaining: 0,
  },
];
const fillNPCSpells = () => {
  if (!knownSpells.length) {
    return;
  }
  if (knownSlots.length) {
    spellSlots = SPELL_SLOTS_SAMPLE;
  }
  npc.spells = [];
  knownSpells.forEach((spellName) => {
    let found = false;
    for (let i = 0; i < spellDb.length; i++) {
      const rgx = new RegExp(
        spellName
          .replace(/\(.*?\)/gi, "")
          .replace(" ", "\\s")
          .replace("'", "\\'")
          .replace("’", "'"),
        "i"
      );
      if (rgx.test(spellDb[i].name)) {
        const {
          name,
          castingTime,
          components,
          description,
          duration,
          level,
          range,
          savingThrow,
          school,
          tags,
          damage,
          higherLevelDescription,
          higherLevels,
        } = spellDb[i];
        npc.spells.push({
          name,
          castingTime,
          components,
          description,
          duration,
          level,
          range,
          savingThrow,
          school,
          tags,
          damage,
          higherLevelDescription,
          higherLevels,
        });
        // if some info about slots is exists, but not complete
        if (level && knownSlots.length) {
          if (knownSlots[level]) {
            spellSlots[level - 1].max = spellSlots[level - 1].remaining =
              knownSlots[level];
          } else {
            spellSlots[level - 1].max = spellSlots[level - 1].remaining++;
          }
        }
        found = true;
        break;
      }
    }
    if (!found) {
      console.error("ERROR: spell not found:", spellName);
      process.exit(1);
    }
  });
  if (spellSlots.length) {
    npc.spellSlots = spellSlots;
  }
};

const parseSpellListAt = (listIdx) => {
  const isSpellListPattern =
    "^(At\\swill|\\d\\s?\\/\\s?day|\\d(nd|st|rd|th)\\s?(-|–)\\s?\\s*level|Cantrips|\\d(nd|st|rd|th)\\s?(-|–)\\s?\\d(nd|st|rd|th)\\s*level|\\d(nd|st|rd|th)\\s+level)";
  const isSpellListRegexp = new RegExp(isSpellListPattern, "i");
  // 1st–3rd level: (2 3rd-level slots): arms of Hadar, dispel magic
  // Cantrips (at will): chill touch, eldritch blast, mage hand
  // At will: detect magic, disguise self, mage armor
  // 2nd level (3 slots):
  const spellForLevelRegexps = [
    /^(?<slotlevel>\d)(nd|st|rd|th)[\s-]+level:?\s+\((?<slotcount>\d+)\s+slots?\)\s*:?\s*(?<spells>.*)/i,
    new RegExp(
      isSpellListPattern.concat(
        ".*?:\\s*\\((?<slotcount>\\d+)\\s*(?<slotlevel>\\d+).*?\\)\\s*:\\s*(?<spells>.*)"
      )
    ),
    new RegExp(isSpellListPattern.concat(".*?:\\s*(?<spells>.*)")),
  ];
  let result = [];
  let cursor = listIdx;
  while (isSpellListRegexp.test(source[cursor])) {
    for (let i = 0; i < spellForLevelRegexps.length; i++) {
      const regResult = spellForLevelRegexps[i].exec(source[cursor]);
      if (regResult) {
        const { slotcount, slotlevel, spells } = regResult.groups;
        // console.error( "Found spells:", spells )
        if (slotlevel) {
          knownSlots[Number(slotlevel)] = Number(slotcount);
        }
        result.push(spells);
        spells
          .replace(/\(.*?\)/gi, "")
          .split(",")
          .forEach((spell) => {
            knownSpells.push(
              spell
                .replace(/\(.*\)/i, "")
                .replace("*", "")
                .trim()
            );
          });
        break;
      }
    }
    cursor++;
  }

  return result;
};

const parseSpells = (from = 0, shift = 0) => {
  const innateSpellsTriggerRegexp = /^(Innate\s+Spellcasting|Spellcasting)/i;
  let innateSpellsIndex = -1;
  let spellLists = [];
  for (let i = from; i < source.length; i++) {
    const regRes = innateSpellsTriggerRegexp.exec(source[i]);
    if (regRes) {
      innateSpellsIndex = i;
      const { ability } =
        /(spellcasting\s+ability\s+is)\s*(?<ability>\w+)/.exec(source[i])
          ?.groups || {};
      if (ability) {
        npc.spellcastingAbility = ability.substring(0, 3).toLowerCase();
      }
      spellLists = parseSpellListAt(i + 1);
      break;
    }
  }

  if (spellLists.length) {
    const protectedSpells = source
      .slice(
        innateSpellsIndex,
        innateSpellsIndex + spellLists.length + 1 + shift
      )
      .join(RETURN)
      .replace(/\n/gi, "");
    source.splice(
      innateSpellsIndex,
      spellLists.length + 1 + shift,
      protectedSpells
    );
    parseSpells(innateSpellsIndex + 1); // if some other spellcasting left
  } else {
    fillNPCSpells();
  }
};

const parseReactions = () => {
  let reactionSeparatorPos = -1;
  for (let i = 0; i < source.length; i++) {
    if (/^Reactions/i.test(source[i])) {
      reactionSeparatorPos = i;
      break;
    }
  }
  if (reactionSeparatorPos < 0) {
    return;
  }
  const reactionLines = source.slice(reactionSeparatorPos + 1);
  source.splice(reactionSeparatorPos);
  const reactionRegex = /^(?<title>.+?)\.\s?(?<body>.*)$/i;
  const textBlocks = reactionLines.map((line) => {
    const regResult = reactionRegex.exec(line);
    const reaction = {
      body: regResult.groups["body"]
        .replaceAll(RETURN, "\n")
        .replaceAll(DOUBLE_RETURN, "\n\n"),
      title: `${regResult.groups["title"]} (Reaction)`,
    };
    return reaction;
  });
  npc.textBlocks = [
    {
      textBlocks,
      title: "Abilities",
    },
  ];
};

const parseLedendaryActions = () => {
  const legendaryActionsPos = findLineNumber(/^Legendary\sActions/i, true);
  if (legendaryActionsPos < 1) {
    return;
  }
  let line = "";
  const actionDescription = source.splice(legendaryActionsPos, 1);
  source = [`Legendary Actions. ${actionDescription}`, ...source];
  const actionRegexp = /^(?<name>.+?)\.\s*(?<description>.*)/;
  const legActions = [];
  for (let i = legendaryActionsPos + 1; i < source.length; i++) {
    const regRes = actionRegexp.exec(source[i]);
    if (!regRes) {
      break;
    }
    const { name, description } = regRes.groups;
    source.splice(i, 1, `${name} (Legendary). ${description}`);
  }
};

const parseActions = () => {
  let actionsSeparatorPos = -1;
  for (let i = 0; i < source.length; i++) {
    if (/^actions/i.test(source[i])) {
      actionsSeparatorPos = i;
      break;
    }
  }
  if (actionsSeparatorPos < 0) {
    return;
  }
  const actionsLines = source.slice(actionsSeparatorPos + 1);
  source.splice(actionsSeparatorPos);
  const actionMainRegex = /^(?<name>.+?)\.\s?(?<description>.+)$/;
  // Ranged Weapon Attack: +5 to hit, range 30/120 ft., one target. Hit: 5 (1d4 + 3) bludgeoning damage.
  // Melee or Ranged Weapon Attack: +8 to hit, reach 15 ft. or range 60/240 ft., one target. Hit: 21 (3d10 + 5) piercing damage.
  // Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) piercing damage.
  // DC 13 Dexterity saving throw
  // 14 (4d6) fire damage
  const attackRegex =
    /^(Melee or)?\s*(?<rangeType>(Ranged|Melee))\s(Weapon|Spell)\sAttack:\s?(?<bonus>[+-]\d*).+?,\s?(range|reach)\s?(?<range>[^\sf]+)?/i;
  const damageRegex =
    /\(\s*(?<dice>\d+d\d+)(\s?\+?\s?(?<bonus>\d+))?\s*\)\s*?(?<type>\w+)\s*\s+damage/gi;
  const savingThrowRegex = /DC\s*(?<dc>\d+)\s*(?<ability>\w+)\s*saving\sthrow/i;
  const actions = actionsLines
    .filter((action) => action)
    .map((action, idx) => {
      const actionMainRegexResult = actionMainRegex.exec(action)?.groups;
      if (!actionMainRegexResult) {
        console.error("Error while parsing the action line", action);
        process.exit(1);
      }

      let { name, description, range } = actionMainRegexResult;
      description = description
        .replaceAll(RETURN, "\n")
        .replaceAll(DOUBLE_RETURN, "\n\n");

      if (name && description) {
        let rollsAttack = false;
        let damageRolls = [];
        let savingThrow = {};
        let attack = {
          savingThrow,
        };

        // saving throw
        const savingThrowRegexResult = savingThrowRegex.exec(description);
        if (savingThrowRegexResult) {
          const { dc, ability: abilitySaveFull } =
            savingThrowRegexResult.groups;
          savingThrow = {
            abilityName: abilitySaveFull.substring(0, 3).toUpperCase(),
            difficultyClass: Number(dc),
          };
          rollsAttack = false;
        }

        // parse attack
        const attackRegexResult = attackRegex.exec(description);
        if (attackRegexResult) {
          rollsAttack = true;
          let { rangeType, bonus, range } = attackRegexResult.groups;
          bonus = Number(bonus || 0);
          let additionalBonus = 0;

          // checking ability
          const strBaseAttack =
            getAbilityBonus("str") + getProfByChallenge(npc.challengeRating);
          const dexBaseAttack =
            getAbilityBonus("dex") + getProfByChallenge(npc.challengeRating);
          let ability = "str";
          if (bonus === strBaseAttack) ability = "str";
          const isRanged = rangeType.toUpperCase() === "RANGED";
          const [normalRange, longRange] = (range || ["30/60"]).split("/");
          if (
            bonus === dexBaseAttack &&
            !(strBaseAttack === dexBaseAttack && isRanged === false)
          ) {
            ability = "dex";
          }
          if (bonus !== strBaseAttack && bonus !== dexBaseAttack) {
            console.error("Attack exceeds formula. Adding bonus");
            if (strBaseAttack > dexBaseAttack) {
              ability = "str";
            }
            if (ability === "str" && strBaseAttack < bonus) {
              additionalBonus = bonus - strBaseAttack;
            } else if (ability === "dex" && dexBaseAttack < bonus) {
              additionalBonus = bonus - dexBaseAttack;
            }
          }

          attack = {
            ability,
            ...(additionalBonus ? { bonus: additionalBonus } : {}),
            actionType: "Action",
            crit: 20,
            ...(damageRolls.length ? { damageRolls } : {}),
            isProficient: true,
            isRanged,
            ...(isRanged
              ? { range: Number(normalRange), longRange: Number(longRange) }
              : {}),
            name,
            rollsAttack,
            savingThrow,
          };
        } else {
          rollsAttack = false;
        }

        // damage rolls
        let damageRegexResult = null;
        while ((damageRegexResult = damageRegex.exec(description))) {
          const { dice, bonus = 0, type } = damageRegexResult.groups ?? {};
          damageRolls.push({
            dice,
            type: capitalize(type),
            bonus: Number(bonus),
          });
        }
        if (damageRolls.length) {
          attack.damageRolls = damageRolls;
          if (!rollsAttack) {
            attack = {
              ...attack,
              crit: 20,
              actionType: "Action",
              isProficient: true,
              name,
              savingThrow,
              rollsAttack,
            };
          }
        } else if (savingThrow) {
          attack = {
            ...attack,
            actionType: "Action",
            isProficient: true,
            name,
            savingThrow,
            rollsAttack,
          };
        }

        return {
          name,
          description,
          sortOrder: idx,
          steps: [
            {
              attack: attack,
              journalCommand: {},
              skillCheck: {},
              type:
                damageRolls.length || savingThrow ? "custom-attack" : "message",
              ...(damageRolls.length
                ? {}
                : {
                    journalCommand: {},
                    journalMessage: description,
                  }),
            },
          ],
        };
      }
    });
  // console.error(JSON.stringify(actions, null, 2));
  npc.actions = actions;
};

const parseAbilities = () => {
  findAndShift(/^(SPECIAL )?Traits$/i);
  const abilitiyLines = source.filter((ability) => ability);
  if (!abilitiyLines.length) {
    return;
  }
  const abilityRegex = /^(?<title>.+?)\.\s?(?<body>.*)$/i;
  const textBlocks = abilitiyLines.map((line) => {
    const regResult = abilityRegex.exec(line);
    try {
      const ability = {
        body: regResult.groups["body"]
          .replaceAll(RETURN, "\n")
          .replaceAll(DOUBLE_RETURN, "\n\n"),
        title: regResult.groups["title"],
      };
      return ability;
    } catch (err) {
      console.error("Error while parsing ability line: ", line);
      process.exit(1);
    }
  });
  if (npc.textBlocks.length) {
    npc.textBlocks[0].textBlocks = [
      ...npc.textBlocks[0].textBlocks,
      ...textBlocks,
    ];
  } else {
    npc.textBlocks.push({
      textBlocks,
      title: "Abilities",
    });
  }
};

// fill initiative bonus etc.
const finalFill = () => {
  npc.initiativeBonus = getAbilityBonus("dex");
};

// ================ PARSING BEGINS ===============

// Read the file
const fs = require("fs");
try {
  source = fs.readFileSync(sourcefile, "utf8");
  // merging all ability scores
  try {
    // fix ability line:
    // STR DEX CON
    // 12 (+1) 12 (+1) 13 (+1)
    const brokenAbilityRegexp =
      /STR\s*DEX\s*CON\s*?\n(?<str>\d+)\s*\(.*?\)\s*(?<dex>\d+)\s*\(.*?\)\s*(?<con>\d+)\s*/gi;
    let brokenAbilityResult = brokenAbilityRegexp.exec(source);
    if (brokenAbilityResult && brokenAbilityResult.groups) {
      // console.error("Found broken scores. Fixing");
      const { str, dex, con } = brokenAbilityResult.groups;
      source = source.replaceAll(
        brokenAbilityRegexp,
        `STR\n${str} (+0)\nDEX\n${dex} (+0)\nCON\n${con} `
      );
      // check second half
      const brokenAbilityRegexpHalf2 =
        /INT\nWIS\n*CHA\n*?\n(?<int>\d+)\s*\(.*?\)\n*(?<wis>\d+)\s*\(.*?\)\n*(?<cha>\d+)\s*/gi;
      brokenAbilityResult = brokenAbilityRegexpHalf2.exec(source);
      if (brokenAbilityResult && brokenAbilityResult.groups) {
        // console.error("Second half broken differently. Fixing");
        const { int, wis, cha } = brokenAbilityResult.groups;
        source = source.replaceAll(
          brokenAbilityRegexpHalf2,
          `INT\n${int} (+0)\WIS\n${wis} (+0)\CHA\n${cha} `
        );
      }
    }
    // STR DEX
    // 20 (+5) 10 (+0)
    const brokenAbilityRegexpShort =
      /STR\s*DEX\s*?\n(?<str>\d+)\s*\(.*?\)\s*(?<dex>\d+)\s*\(.*?\)\s*/gi;
    brokenAbilityResult = brokenAbilityRegexpShort.exec(source);
    if (brokenAbilityResult && brokenAbilityResult.groups) {
      // console.error("Found broken scores (short). Fixing");
      const { str, dex } = brokenAbilityResult.groups;
      source = source.replaceAll(
        brokenAbilityRegexpShort,
        `STR\n${str} (+0)\nDEX\n${dex} (+0)\n`
      );
    }
    // STR DEX CON INT
    // 21 (+5) 12 (+1) 20 (+5) 13 (+1)
    const brokenAbilityRegexpLongShort =
      /STR\s*DEX\s*CON\s*INT\s*?\n(?<str>\d+)\s*\(.*?\)\s*(?<dex>\d+)\s*\(.*?\)\s*(?<con>\d+)\s*\(.*?\)\s*(?<int>\d+)\s*\(.*?\)\s*/gi;
    brokenAbilityResult = brokenAbilityRegexpLongShort.exec(source);
    if (brokenAbilityResult && brokenAbilityResult.groups) {
      // console.error("Found broken scores (long short). Fixing");
      const { str, dex, con, int } = brokenAbilityResult.groups;
      source = source.replaceAll(
        brokenAbilityRegexpLongShort,
        `STR\n${str} (+0)\nDEX\n${dex} (+0)\CON\n${con} (+0)\INT\n${int} (+0)\n`
      );
    }
    // STR DEX CON INT WIS CHA
    // 14 (+2)	10 (+0)	12 (+1)	10 (+0)	14 (+2)	6 (–2)
    const brokenAbilityRegexpLong =
      /STR\s*DEX\s*CON\s*INT\s*WIS\s*CHA\s*?\n(?<str>\d+)\s*\(.*?\)\s*(?<dex>\d+)\s*\(.*?\)\s*(?<con>\d+)\s*\(.*?\)\s*(?<int>\d+)\s*\(.*?\)\s*(?<wis>\d+)\s*\(.*?\)\s*(?<cha>\d+)\s*/gi;
    brokenAbilityResult = brokenAbilityRegexpLong.exec(source);
    if (brokenAbilityResult && brokenAbilityResult.groups) {
      const { str, dex, con, int, wis, cha } = brokenAbilityResult.groups;
      source = source.replaceAll(
        brokenAbilityRegexpLong,
        `STR\n${str} (+0)\nDEX\n${dex} (+0)\nCON\n${con} (+0)\nINT\n${int} (+0)\nWIS\n${wis} (+0)\nCHA\n${cha} `
      );
    }
    source = source.replace(
      ABILITY_REGEX,
      ABILITY_REGEX.exec(source)[0].split("\n").join(" ")
    );

    // fix description space
    source = source.replace(/Description\n\n/i, "Description\n");
  } catch (err) {
    console.error("Error while parsing ability scores\n\n", err);
    process.exit(1);
  }
  source = source.split("\n");
} catch (err) {
  console.error(err);
}

prepareSource();
parseName(); // should be first
parseSizeAndType();
removeProficiency();
parseAlignment(); // should be after size and type parsing
parseAC();
parseHPAndXP();
parseSpeed();
parseAbilityScores();
parseChallenge(); // should be after parseAbilityScores parsing
parseSavingThrows();
parseSkills();
parseSenses();
parseLanguages(); // should be after parseAbilityScores parsing
parseConditionImmunities();
parseResistances();
parseImmunities();
parseVulnerabilities();
parseSpells();
parseDescription();
parseReactions();
parseLedendaryActions(); // legendary actions should be last in statblock
parseActions(); // should be after parseDescription and legendary actions
parseAbilities(); // should be last
finalFill();

if (insertIntoUniverse) {
  require("./insertIntoUniverse").insertIntoUniverse(npc, universeId, moduleId);
} else {
  const result = JSON.stringify(npc, null, 2);
  console.log(result);
}
