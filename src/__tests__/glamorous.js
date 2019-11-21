let { template: t, match_inside, unparsable } = require('../ast-template.js');

console.log(`unparsable():`, unparsable`call(${['x']})`);

it('should match a static glamorous call', () => {
  let source = `
    let has_border = true;
    let component = glamorous.div({
      backgroundColor: 'black',
      color: 'red',
      border: has_border ? '2px solid black' : 'none',
    })
  `;

  let template = t.expression`
    glamorous.${t.Identifier('tag')}({
      ${t.many('entries',
        t.entry`
          ${t.Identifier('key')}: ${t.Expression('value')},
        `
      )}
    })
  `;

  expect(match_inside(source, template)).toMatchSnapshot();
})

it('should match a glamorous call with props', () => {
  let source = `
    let Card = glamorous.div({
      backgroundColor: 'black',
      color: 'red',
    }, (props) => {
      return {
        backgroundColor: props.backgroundColor,
      }
    });

    let Chart = glamorous.div({
      backgroundColor: 'black',
      color: 'red',
    });
  `;

  let template = t.expression`
    glamorous.${t.Identifier('tag')}(
      {
        ${t.many('entries',
          t.entry`
            ${t.Identifier('key')}: ${t.Expression('value')},
          `
        )}
      },
      ${t.optional('props-function',
        t.expression`(${t.Identifier('prop-arg')}) => {
          return {
            ${t.many('entries',
              t.entry`
                ${t.Identifier('key')}: ${t.Expression('value')},
              `
            )}
          }
        }`
      )}
    )
  `;

  expect(match_inside(source, t)).toMatchSnapshot();
})
