# AS-Template

### TODO
[ ] Even nicer error message
[ ] `template.Either([...])` or `template.Or([...])`
    Match any of the provided subtemplates,
    have some way to identify which one it has matched maybe? Initially without nested repeats I'd say
[ ] Multiple `template.Repeat` possible on one array
[ ] Check on computation order instead of ast order
    So one problem I am finding is that there is no nice way to capture both `object.property` and `object.property()`, I think that it should be possible with something like `template.Applied(\`object.property\`)`. So this would find `object.property` and things that are wrapped around it. This gets closer to Ultimate Compiler territory
