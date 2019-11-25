let { fill_in_template, template } = require('../ast-template.js');
let generate = require('babel-generator').default;

it('should fill in a simple template', () => {
  let definition_template = template.statements`
    let ${template.Identifier('var')} = ${template.String('string')}
  `;

  expect(
    generate(
      fill_in_template(definition_template, {
        var: template.expression`variable`,
        string: template.expression`"String"`,
      })
    ).code
  ).toMatchSnapshot();
});

it('should fill in a template with a repeat', () => {
  let definition_template = template.statements`
    ${template.many(
      'statements',
      template.statements`
        let ${template.Identifier('var')} = ${template.String('string')}
      `
    )}
  `;

  expect(
    generate(
      fill_in_template(definition_template, {
        statements: [
          {
            var: template.expression`variable`,
            string: template.expression`"String"`,
          },
          {
            var: template.expression`variable2`,
            string: template.expression`"String2"`,
          },
        ],
      })
    ).code
  ).toMatchSnapshot();
});

it('should fill in a template with a either', () => {
  let definition_template = template.statements`
    ${template.either('statement', [
      template.statements`
        let ${template.Identifier('var')} = ${template.String('string')}
      `,
      template.statements`
        let ${template.Identifier('var')} = ${template.Expression('expression')}
      `,
    ])}
  `;

  expect(
    generate(
      fill_in_template(definition_template, {
        statement: {
          var: template.expression`variable`,
          string: template.expression`"String"`,
        },
      })
    ).code
  ).toMatchSnapshot();
  expect(
    generate(
      fill_in_template(definition_template, {
        statement: {
          var: template.expression`variable`,
          expression: template.expression`10`,
        },
      })
    ).code
  ).toMatchSnapshot();
});

it('should fill in a template with a either and a repeat', () => {
  let definition_template = template.statements`
    ${template.many(
      'statements',
      template.either(null, [
        template.statements`
          let ${template.Identifier('var')} = ${template.String('string')}
        `,
        template.statements`
          let ${template.Identifier('var')} = ${template.Expression('expression')}
        `,
      ])
    )}
  `;

  expect(
    generate(
      fill_in_template(definition_template, {
        statements: [{
          var: template.expression`variable`,
          string: template.expression`"String"`,
        }, {
          var: template.expression`variable`,
          expression: template.expression`10`,
        }],
      })
    ).code
  ).toMatchSnapshot();
});

it('should fill in a template with a either and a repeat on an expression', () => {
  let definition_template = template.statements`
    return [
      ${template.many(
        'statements',
        template.either(null, [
          template.expression`
            ${template.String('string')}
          `,
          template.statements`
            ${template.Expression('expression')}
          `,
        ])
      )}
    ];
  `;

  expect(
    generate(
      fill_in_template(definition_template, {
        statements: [{
          string: template.expression`"String"`,
        }, {
          expression: template.expression`10`,
        }],
      })
    ).code
  ).toMatchSnapshot();
});

it('should fill in anonymous many', () => {
  let definition_template = template.statements`
    ${template.many(
      'statements',
      template.Statement
    )}
  `;

  expect(
    generate(
      fill_in_template(definition_template, {
        statements: [
          template.expression`"String"`,
          template.expression`10`,
        ],
      })
    ).code
  ).toMatchSnapshot();
});

it('should fill in a function expression', () => {
  let definition_template = template.statements`
    let x = ${template.$function_expression('fn')};
  `;

  expect(
    generate(
      fill_in_template(definition_template, {
        fn: template.expression`(x) => {
          return x * 2
        }`
      })
    ).code
  ).toMatchSnapshot();
});

it('should fill in a single entry into an object as expression', () => {
  let definition_template = template.expression`{
    ${template.Expression('x')}
  }`;

  expect(
    generate(
      fill_in_template(definition_template, {
        x: template.entry`key: 10`.ast,
      })
    ).code
  ).toMatchSnapshot();
});

it.skip('should fill in a single entry into an object', () => {
  let definition_template = template.expression`{
    ${template.entry`
      ${template.Identifier('key')}: ${template.Expression('value')},
    `}
  }`;

  expect(
    generate(
      fill_in_template(definition_template, {
        key: template.expression`keyyy`,
        value: template.expression`10000`,
      })
    ).code
  ).toMatchSnapshot();
});

it('should fill in statements', () => {
  let definition_template = template.statements`
    ${template.many(
      'statements',
      template.Statement
    )}
  `;

  expect(
    generate(
      fill_in_template(definition_template, {
        statements: template.statements`
          console.log('#1');
          console.log('#2');
        `,
      })
    ).code
  ).toMatchSnapshot();
})

it('should fill in object entries', () => {
  let definition_template = template.statements`
    let x = {
      ${template.many('entries', template.entry`
        ${template.Identifier('key')}: ${template.Expression('value')},
      `)}
    }
  `;

  expect(
    generate(
      fill_in_template(definition_template, {
        entries: [{
          key: template.expression`key`,
          value: template.expression`10`,
        }, {
          key: template.expression`key2`,
          value: template.expression`12`,
        }]
      })
    ).code
  ).toMatchSnapshot();
});
