let { template, minivaluate } = require('../app.js');

it('should minivaluate some expression', () => {
  expect(minivaluate(template.expression`'Hey'`.ast)).toEqual('Hey');
  expect(minivaluate(template.expression`80 + 90`.ast)).toEqual(80 + 90);
  expect(minivaluate(template.expression`'He' + 'y'`.ast)).toEqual('Hey');
  expect(minivaluate(template.expression`{ id: 10 }`.ast)).toEqual({ id: 10 });
});

it('should match a simple sequelize definition', () => {
  let scope = {
    DataTypes: {
      UUID: 'UUID',
      UUIDV4: 'UUIDV4',
      STRING: 'STRING',
      DECIMAL: 'DECIMAL',
    },
  };
  let simple_definition = `
    module.exports = (sequelize, DataTypes) => {
      const Price = sequelize.define(
        'Price',
        {
          id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: DataTypes.UUIDV4,
            allowNull: false,
            autoIncrement: false,
          },
          shape: DataTypes.STRING,
          color: DataTypes.STRING,
          clarity: DataTypes.STRING,
          lowSize: DataTypes.DECIMAL,
          highSize: DataTypes.DECIMAL,
          caratPrice: DataTypes.DECIMAL, // TODO Use integers (javascript decimals are broken (0.1 + 0.2 !== 0.3))
          date: DataTypes.STRING,
        },
      );

      return Price;
    };
  `;

  let definition_template = template.statements`
    module.exports = (sequelize, DataTypes) => {
      const ${template.Identifier('model')} = sequelize.define(
        ${template.String('model_name')},
        ${template.Object('model_definition', {
          key: template.expression`${template.Identifier('property')}`,
          value: template.expression`${template.Expression('type_description', {
            scope: scope,
          })}`,
        })}
      );

      return ${template.Identifier('model')};
    };
  `;

  expect(definition_template.match(simple_definition)).toMatchSnapshot();
});

it.only('should match a definition with optionals', () => {
  let simple_definition = `
    let result = { id: 'hey' };
    // result.name = 'Cool';
    module.exports = result;
  `;

  let definition_template = template.statements`
    let ${template.Identifier('var')} = ${template.Object('value', {
      key: template.expression`${template.Identifier('property')}`,
      value: template.expression`${template.String('type_description')}`,
    })};

    ${template.repeat('optional_found', 0, 1, template.expression`${template.Expression('type_description')}`)}

    module.exports = ${template.Identifier('var')};
  `;

  expect(definition_template.match(simple_definition)).toMatchSnapshot();
});
