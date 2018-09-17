let { template, minivaluate } = require('../app.js');

it('should match a stock', () => {
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

    async function sunriseDiamonds(job) {
      let response = await fetch(
        'http://www.sunrisediamonds.com.hk/inventory/Wgc.json'
      );
      let diamonds = await response.json();


      return flow([
        iterate.filter(x => x.Lab === 'GIA'),
        iterate.map((diamond) => {
          let cert_number = diamond['Certi No.'];
          let image_url =
            (diamond['Other IMG'] || '').includes('viewimg')
            ? \`https://www.sunrisediamonds.com.hk/img/\${cert_number}/PR.jpg\`
            : diamond['Other IMG']

          return {
            certificate_number: diamond['Certi No.'],
            carats: Number(diamond.Cts),

            supplier_name: 'sunrisediamonds', // TODO Check this
            supplier_stockId: diamond['Ref. No'],

            price: Number(diamond['Net Amt($)']),
            discount: Number(diamond['Disc(%)']),
            image: image_url,
            v360: diamond['Other Video'],
          };
        }),
      ])(diamonds)
    }

    module.exports = sunriseDiamonds;
  `;

  let definition_template = template.statements`
    ${template.many('import_functions', template.Statement)}

    async function ${template.Identifier('fetch_fn')}(job) {
      ${template.many('fetch_functions', template.Statement)}

      return flow([
        ${template.many('flow_functions', template.Expression)},
      ])(${template.Identifier('rows_variable')})
    }

    module.exports = ${template.Identifier('fetch_fn')};
  `;

  expect(definition_template.match(simple_definition)).toMatchSnapshot();
});
