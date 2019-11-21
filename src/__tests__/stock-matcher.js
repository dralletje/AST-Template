let { template } = require('../ast-template.js');

it('should match a stock file', () => {
  // let scope = {
  //   DataTypes: {
  //     UUID: 'UUID',
  //     UUIDV4: 'UUIDV4',
  //     STRING: 'STRING',
  //     DECIMAL: 'DECIMAL',
  //   },
  // };
  let simple_definition = `
    let iterate = require('./utils/iterate');
    let { flow } = require('lodash');

    let fetch_stock = async (job) => {
      let response = await fetch(
        '<redacted though it is still in the git history fuck>'
      );
      let diamonds = await response.json();


      return flow([
        iterate.first_is_headers,
        iterate.filter(x => x.Lab === 'GIA'),
        iterate.map((diamond) => {
          let cert_number = diamond['Certificate Number'];
          let image_url =
            (diamond['IMG'] || '').includes('viewimg')
            ? \`<Also redacted but again fuck>\`
            : diamond['IMG']

          return {
            certificate_number: diamond['Certificate Number'],
            carats: Number(diamond['Carats']),

            supplier_name: '<hehehe>', // TODO Check this
            supplier_stockId: diamond['Reference Number'],

            price: Number(diamond['Net Amount $$']),
            discount: Number(diamond['Discount %%']),
            image: image_url,
            v360: diamond['Video'],
          };
        }),
      ])(diamonds)
    }

    module.exports = { fetch_stock };
  `;

  let definition_template = template.statements`
    ${template.many('import_functions', template.either(null, [
      template.statement`let ${template.Pattern('id')} = ${template.Expression('exp')}`,
      template.Statement,
    ]))}

    let ${template.Identifier('fetch_fn')} = async (${template.arguments('arguments')}) => {
      ${template.many('fetch_functions', template.Statement)}

      return flow([
        ${template.many('flow_functions', template.either(null, [
          template.expression`
            iterate.map(${template.function_expression('func')})
          `,
          template.expression`
            iterate.filter(${template.function_expression('func')})
          `,
          template.expression`
            iterate.${template.Identifier('iterate_fn')}(${template.many('inputs', template.Expression)})
          `,
          template.expression`
            iterate.${template.Identifier('iterate_fn')}
          `,
        ]))}
      ])(${template.Identifier('rows_variable')})
    }

    module.exports = ${template.Expression('export')};
  `;

  expect(definition_template.match(simple_definition)).toMatchSnapshot();
});
