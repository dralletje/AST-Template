let { fill_in_template, template } = require('../astemplate.js');
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

it.only('should fill in a teomplate with a either and a repeat on an expression', () => {
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
