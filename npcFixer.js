const headers = {
  'Authorization': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2NGViYTZlNThhODE4NTlkZDZlMzRkMWEiLCJyb2xlcyI6W10sInN1YnNjcmlwdGlvbiI6eyJ0eXBlIjoibW9udGhseSIsImVuZERhdGUiOiIyMDIzLTEwLTAxVDIwOjQxOjQ3LjAwMFoiLCJzdGFydERhdGUiOiIyMDIzLTA5LTE3VDIwOjQxOjQ3LjAwMFoiLCJpc0FjdGl2ZSI6dHJ1ZX0sImlhdCI6MTY5NTM3NzM0OH0.3a6zScjmkYUFNliAmoT-klwACTrtXSq0M2DXzJldWj0',
  'Cookie': '_ga=GA1.2.290497252.1693592693; _ga_8YE62F7T7P=GS1.1.1693592692.1.1.1693592710.0.0.0; __stripe_mid=a3a624d4-3f32-403e-8b65-36063e6c9b09d4df35; __stripe_sid=6dd3a1cb-acd8-494a-8d52-87b243e2683c7b3ba0',
  'Content-Type': 'application/json'
}

const fixNPC = (characterId) => fetch('https://app.alchemyrpg.com/api/graphql', {
  method: 'POST',
  headers,
  body: JSON.stringify(
    {
      "operationName":"GetCharacterById",
      "variables":{"characterId":characterId},
      "query":"query GetCharacterById($characterId: String) {\
    characterById(characterId: $characterId) {\
      initiativeBonus\
      }\
    }"}
  )
}).then( resp => {
  console.log( "Status:", resp.status )
  return resp.json()
}).then( resp => {
  const { data: { characterById: {initiativeBonus: parameter} } } = resp;

  console.log( "Parameter:", parameter )
  return parameter
}).then( parameter => {
  let newParameter = Number(parameter) - 10;
  if( newParameter  < -1) {
    console.log("No modification needed")
    return "OK"
  }
  fetch('https://app.alchemyrpg.com/api/graphql', {
    method: 'POST',
    headers,
    body: JSON.stringify(
      {
        "operationName":"UpdateCharacterFromCharacterSheet",
        "variables":{
          "characterId": characterId,
          "update": {
            initiativeBonus: newParameter
          }
        },
        query: "mutation UpdateCharacterFromCharacterSheet($characterId: String, $update: CharacterInput, $addToLibrary: Boolean, $overrideUserId: String) {\
          updateCharacter(\
            characterId: $characterId\
            update: $update\
            addToLibrary: $addToLibrary\
            overrideUserId: $overrideUserId\
          ) {\
            initiativeBonus\
            }\
          }"
      }
    )
  }).then( resp => {
    console.log( "RESULT:", resp.status )
    return resp.json()
  }).then( resp => {
    console.log( resp )
  })
})
.catch(err => {
  console.log("Error:", err)
})

// get NPC List
fetch(
  "https://app.alchemyrpg.com/api/graphql", {
    method: "POST",
    headers,
    body: JSON.stringify( {
        "operationName": "OwnedModules",
        "variables": {
            "input": {
                "universeIds": [
                  "64f8304965234f2f7403aec1", "6260df75b0b47dc841b01d56"
                ]
            }
        },
        "query": "query OwnedModules($input: OwnedModulesInput!) {\n  ownedModules(input: $input) {\n    _id\n    name\n    slug\n    resources\n    universeId\n    imageUri\n    thumbnailUri\n    modulePDF {\n      name\n      uri\n    }\n  }\n}"
    })
}).then( resp => {
  console.log( "Get universe content:", resp.status )
  return resp.json()
}).then( resp => {
  const { data: { ownedModules } } = resp;
  npcRegexp = /arn:character:(?<id>.*)/i;
  ownedModules.forEach(element => {
    const { resources } = element
    resources.forEach( resouce => {
      const regRes = npcRegexp.exec(resouce)
      if( regRes != null ) {
        const { id } = regRes.groups;
        console.log("Fixing:", id );
        fixNPC( id )
      }
    })
  });
})