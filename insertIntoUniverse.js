const { headers, userId } = require("./userInfo");

const NEW_CHARACTER_ID = "60f50eb8e714990008c13193";

const copyNewCharacter = async (universeId, moduleId) => {
  // console.log("Copying New Character");
  const copyNewCharacterQuery = {
    operationName: "CopyCharacter",
    variables: {
      characterId: "60f50eb8e714990008c13193",
      userId,
      universeId: universeId,
      activeModuleId: moduleId,
    },
    query:
      "mutation CopyCharacter($characterId: String, $userId: String, $gameId: String, $removeTemplateFields: Boolean, $copyUniverseTemplate: Boolean, $identifyingNumber: Int, $universeId: String, $isPreMade: Boolean, $name: String, $concept: String, $activeModuleId: String) {\n  copyCharacter(\n    characterId: $characterId\n    userId: $userId\n    gameId: $gameId\n    removeTemplateFields: $removeTemplateFields\n    copyUniverseTemplate: $copyUniverseTemplate\n    identifyingNumber: $identifyingNumber\n    universeId: $universeId\n    isPreMade: $isPreMade\n    name: $name\n    concept: $concept\n    activeModuleId: $activeModuleId\n  ) {\n    _id\n    system {\n      key\n    }\n    systemKey\n    abilityScores {\n      name\n      value\n      die\n    }\n    armorClass\n    armorType\n    bonusActions {\n      title\n      body\n    }\n    specialAbilities {\n      title\n      body\n    }\n    classes {\n      class\n      level\n      description\n    }\n    imageUri\n    name\n    proficiencies {\n      name\n      type\n    }\n    proficiencyBonus\n    race\n    skills {\n      _id\n      name\n      abilityName\n      description\n      proficient\n      doubleProficiency\n      level\n      roll\n      bonus\n      value\n      training\n    }\n    speed\n    movementModes {\n      mode\n      distance\n    }\n    initiativeBonus\n    spellcastingAbility\n    spellFilters\n    spellSlots {\n      max\n      remaining\n    }\n    spells {\n      spellId\n      spellcastingAbilityOverride\n      isPrepared\n    }\n    textBlocks {\n      _id\n      textBlocks {\n        _id\n        body\n        title\n        subtitle\n      }\n      title\n      subtitle\n    }\n    tagBlocks {\n      title\n      tags\n    }\n    user {\n      _id\n    }\n    copper\n    silver\n    electrum\n    gold\n    platinum\n    items {\n      _id\n      name\n      description\n      weight\n      quantity\n      isEquipped\n      isDeleted\n      properties\n    }\n    age\n    height\n    weight\n    eyes\n    skin\n    hair\n    alignment\n    isBackstoryPublic\n    isDeleted\n    size\n    type\n    typeTags\n    damageVulnerabilities {\n      damageType\n      condition\n    }\n    damageResistances {\n      damageType\n      condition\n    }\n    damageImmunities {\n      damageType\n      condition\n    }\n    conditionImmunities\n    challengeRating\n    senses {\n      name\n      distance\n    }\n    hitDice\n    legendary\n    description\n    trackers {\n      name\n      value\n      max\n      color\n      type\n      category\n      _id\n      sortOrder\n      readOnly\n    }\n  }\n}",
  };
  let resp = await fetch("https://app.alchemyrpg.com/api/graphql", {
    method: "POST",
    headers,
    body: JSON.stringify(copyNewCharacterQuery),
  });
  resp = await resp.json();
  return resp.data.copyCharacter._id;
};

const addResourse = async (characterId, moduleId) => {
  // console.log("Adding the chacater to module");
  const addResourceQuery = {
    operationName: "AddResourceToMarketplaceItem",
    variables: {
      resource: `arn:character:${characterId}`,
      marketplaceItemId: moduleId,
    },
    query:
      "mutation AddResourceToMarketplaceItem($marketplaceItemId: ID!, $resource: String!) {\n  addResourceToMarketplaceItem(\n    marketplaceItemId: $marketplaceItemId\n    resource: $resource\n  ) {\n    _id\n    name\n    imageUri\n    isPublished\n    resources\n    publisher\n    creator {\n      _id\n    }\n  }\n}",
  };
  await fetch("https://app.alchemyrpg.com/api/graphql", {
    method: "POST",
    headers,
    body: JSON.stringify(addResourceQuery),
  });
};

let actionSortOrder = 0;
const addAction = async (characterId, action) => {
  const { name, steps, description } = action;
  console.log("Adding action:", name);
  const addActionQuery = {
    operationName: "AddOrUpdateAction",
    variables: {
      action: {
        characterId,
        universeId: null,
        sortOrder: actionSortOrder++,
        name,
        defaultAction: {
          gm: false,
          player: false,
          npc: false,
        },
        steps,
        description,
      },
    },
    query:
      "mutation AddOrUpdateAction($action: ActionInput) {\n  addOrUpdateAction(action: $action) {\n    _id\n    characterId\n    universeId\n    sortOrder\n    name\n    description\n    isDeleted\n    defaultAction {\n      player\n      npc\n      gm\n    }\n    universeName\n    moduleName\n    moduleId\n    steps {\n      type\n      journalMessage\n      journalCommand {\n        command\n        args\n      }\n      diceRoll {\n        dice\n        bonus\n        abilityName\n        skillName\n        type\n      }\n      attack {\n        name\n        rollsAttack\n        ability\n        skill\n        bonus\n        isProficient\n        crit\n        damageRolls {\n          dice\n          type\n          abilityName\n          skillName\n          bonus\n        }\n        isRanged\n        range\n        longRange\n        ammunitionId\n        savingThrow {\n          difficultyClass\n          abilityName\n        }\n        actionType\n        numberOfDice\n        numberOfFaces\n        omitProficiencyBonus\n      }\n      skillCheck {\n        skillName\n        rollModifier\n      }\n      rollTable {\n        tableEntries {\n          resultMin\n          resultMax\n          effect\n        }\n      }\n      sound {\n        uri\n      }\n      dicePool {\n        ability\n        skill\n        bonus\n        numberOfDice\n        numberOfFaces\n        explode\n        successValues\n        failureValues\n        useAbilityAndSkill\n        canReroll\n        rerollValues\n      }\n    }\n  }\n}",
  };
  await fetch("https://app.alchemyrpg.com/api/graphql", {
    method: "POST",
    headers,
    body: JSON.stringify(addActionQuery),
  });
};

const fillTheChatacter = async (character, characterId) => {
  //console.log("Filling the character...");
  const updateCharacterQuery = {
    operationName: "UpdateCharacterFromCharacterSheet",
    variables: {
      characterId: characterId,
      update: character,
    },
    query:
      "mutation UpdateCharacterFromCharacterSheet($characterId: String, $update: CharacterInput, $addToLibrary: Boolean, $overrideUserId: String) {\n  updateCharacter(\n    characterId: $characterId\n    update: $update\n    addToLibrary: $addToLibrary\n    overrideUserId: $overrideUserId\n  ) {\n    _id\n    name\n    race\n    classes {\n      class\n      level\n      description\n    }\n    imageUri\n    abilityScores {\n      name\n      value\n      die\n    }\n    armorClass\n    armorType\n    initiativeBonus\n    speed\n    movementModes {\n      mode\n      distance\n    }\n    proficiencyBonus\n    proficiencies {\n      name\n      type\n    }\n    textBlocks {\n      _id\n      title\n      subtitle\n      textBlocks {\n        _id\n        title\n        subtitle\n        body\n      }\n    }\n    tagBlocks {\n      title\n      tags\n    }\n    skills {\n      _id\n      name\n      abilityName\n      description\n      proficient\n      doubleProficiency\n      level\n      roll\n      bonus\n      value\n      training\n    }\n    age\n    height\n    weight\n    eyes\n    skin\n    hair\n    alignment\n    isBackstoryPublic\n    spellcastingAbility\n    spellFilters\n    spellSlots {\n      max\n      remaining\n    }\n    spells {\n      spellId\n      spellcastingAbilityOverride\n      isPrepared\n    }\n    size\n    type\n    typeTags\n    damageVulnerabilities {\n      damageType\n      condition\n    }\n    damageResistances {\n      damageType\n      condition\n    }\n    damageImmunities {\n      damageType\n      condition\n    }\n    conditionImmunities\n    challengeRating\n    senses {\n      name\n      distance\n    }\n    hitDice\n    legendary\n    description\n    trackers {\n      name\n      value\n      max\n      color\n      type\n      category\n      _id\n      sortOrder\n      readOnly\n    }\n    universeId\n  }\n}",
  };
  let resp = await fetch("https://app.alchemyrpg.com/api/graphql", {
    method: "POST",
    headers,
    body: JSON.stringify(updateCharacterQuery),
  });
  resp = await resp.json();
};

const insertIntoUniverse = async (npc, universeId, moduleId) => {
  const characterId = await copyNewCharacter(universeId, moduleId);
  await addResourse(characterId, moduleId);
  const actions = [...(npc.actions ?? [])];
  delete npc.actions;
  await fillTheChatacter(npc, characterId);
  actions.forEach(async (action) => await addAction(characterId, action));
  console.log(`\n![${npc.name}=type:character](${characterId})`); //![ButtonName=type:character](655dd6bb3946a2aea55ea39c)
};

module.exports = insertIntoUniverse;
