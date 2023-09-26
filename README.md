# alchemyStatblockParser
Alchemy stat block parser

Usage: node converter.js Source.txt > NPC.json

Check source.txt for example.

Features:
- Parsing spells
- Parsing actions with saving throws, attack and damage rolls
- Calculates skills
- Parsing reactions
- Parsing descriptions (with about or description separator)

Possible abiliies formats:

```
STR
10 (+0)
DEX
10 (+0)
CON
10 (+0)
INT
10 (+0)
WIS
10 (+0)
CHA
10 (+0)
```

```
STR DEX CON
10 (+0) 10 (+0) 10 (+0)
INT
10 (+0)
WIS
10 (+0)
CHA
10 (+0)
```

```
STR DEX CON INT WIS CHA
10 (+0) 10 (+0) 10 (+0) 10 (+0) 10 (+0) 10 (+0)
```
