let { template } = require('../app.js');
let { minivaluate } = require('../minivaluate.js');

it('should minivaluate some expression', () => {
  expect(minivaluate(template.expression`'Hey'`.ast)).toEqual('Hey');
  expect(minivaluate(template.expression`80 + 90`.ast)).toEqual(80 + 90);
  expect(minivaluate(template.expression`'He' + 'y'`.ast)).toEqual('Hey');
  expect(minivaluate(template.expression`{ id: 10 }`.ast)).toEqual({ id: 10 });
});

it('should minivaluate expression that uses scope', () => {
  let scope = {
    DataTypes: {
      UUID: 'UUID',
      UUIDV4: 'UUIDV4',
      STRING: 'STRING',
      DECIMAL: 'DECIMAL',
    },
  };
  expect(minivaluate(template.expression`DataTypes.UUID`, scope)).toEqual('UUID');
  expect(minivaluate(template.expression`DataTypes.UUIDV4`, scope)).toEqual('UUIDV4');
  expect(minivaluate(template.expression`DataTypes.STRING`, scope)).toEqual('STRING');
  expect(minivaluate(template.expression`DataTypes.DECIMAL`, scope)).toEqual('DECIMAL');
});

it('should minivaluate an object expression', () => {
  let scope = {
    DataTypes: {
      UUID: 'UUID',
      UUIDV4: 'UUIDV4',
      STRING: 'STRING',
      DECIMAL: 'DECIMAL',
    },
  };

  let object = template.expression`{
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
    allowNull: false,
    autoIncrement: false,
  }`;

  expect(minivaluate(object, scope)).toEqual({
    type: 'UUID',
    primaryKey: true,
    defaultValue: 'UUIDV4',
    allowNull: false,
    autoIncrement: false,
  });
})

it('should match a simple sequelize definition', () => {
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
          key: template.Identifier,
          value: template.Expression,
        })}
      );

      return ${template.Identifier('model')};
    };
  `;

  expect(definition_template.match(simple_definition)).toMatchSnapshot();
});

it('should match a definition with optionals', () => {
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

    ${template.optional('optional_found', template.Expression)}

    module.exports = ${template.Identifier('var')};
  `;

  expect(definition_template.match(simple_definition)).toMatchSnapshot();
});

it('should match a definition with provided optionals', () => {
  let simple_definition = `
    let result = { id: 'hey' };
    result.name = 'Cool';
    module.exports = result;
  `;

  let definition_template = template.statements`
    let ${template.Identifier('var')} = ${template.Object('value', {
      key: template.Identifier,
      value: template.String,
    })};

    ${template.optional('optional_found', template.Statement)}

    module.exports = ${template.Identifier('var')};
  `;

  expect(definition_template.match(simple_definition)).toMatchSnapshot();
});

it('should match a single key: value entry', () => {
  let simple_definition = `
    let result = { id: 'hey' };
    // result.name = 'Cool';
    module.exports = result;
  `;

  let definition_template = template.statements`
    let ${template.Identifier('var')} = {
      // Only one though :(
      ${template.Identifier('key')}: ${template.String('type_description')}
    }

    module.exports = ${template.Identifier('var')};
  `;

  expect(definition_template.match(simple_definition)).toMatchSnapshot();
});


it('should match multiple expression', () => {
  let simple_definition = `
  let x = 10;
  let y = Math.random();
  let z = x * y;

  module.exports = z;
  `;

  let definition_template = template.statements`
  ${template.many('expressions', template.Statement)}

  module.exports = ${template.Identifier('var')};
  `;

  expect(definition_template.match(simple_definition)).toMatchSnapshot();
});


// TODO HARD
it.skip('should match a repeated single key: value entry', () => {
  let simple_definition = `
    let result = {
      id: 'hey',
      xd: 'jo',
      fp: 'hi',
    };
    module.exports = result;
  `;

  let definition_template = template.statements`
    let ${template.Identifier('var')} = {
      // Only one though :(
      ${template.many('entries', template.not_even_sure`
        ${template.Identifier('key')}: ${template.String('type_description')}
      `)}
    }

    module.exports = ${template.Identifier('var')};
  `;

  expect(definition_template.match(simple_definition)).toMatchSnapshot();
});


// TODO HARD
it.skip('should make sense of this?', () => {
  let simple_definition = `
    module.exports = 10;
    module.exports = 12;
  `;

  let definition_template = template.statements`
    ${template.optional('expression', template.Expression)}
    module.exports = ${template.Identifier('var')};
    ${template.optional('expression', template.expression`${template.Expression('type_description')}`)}
  `;

  expect(definition_template.match(simple_definition)).toMatchSnapshot();
});
