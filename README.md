# AS-Template

### TODO
[ ] Even nicer error message
[x] `template.Either([...])` or `template.Or([...])`
    Match any of the provided subtemplates,
    have some way to identify which one it has matched maybe? Initially without nested repeats I'd say
[x] Multiple `template.Repeat` possible on one array
[ ] Check on computation order instead of ast order
    So one problem I am finding is that there is no nice way to capture both `object.property` and `object.property()`, I think that it should be possible with something like `template.Applied(\`object.property\`)`. So this would find `object.property` and things that are wrapped around it. This gets closer to Ultimate Compiler territory
[ ] Make standard way for AST that is predictable
    - `let obj = { property: 'value' }` to `let obj = { ['property']: 'value' }` (Always computed property)
    - `let obj = { property }` to `let obj = { ['property']: property }` (Never shorthand)
    - `<tag>child</tag>` to `<tag children={'child'} />` (Always self-closing)
    - `"Hey"` to `'hey'` (or `\`hey\``?)
    - etc
[ ] Merge slowly with PARSE for a kind of program tree, so I can match actual values
    eg. `let obj = {}; obj.x = 10;` matches `let obj = { x: 10 }`
    Only needs to happen inside the file, maaaaaybe later across files.
    So first only pure, later local mutations, slowly expanding.
