let { template } = require('../ast-template.js');
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
        {
          ${template.many('model_definition',
            template.entry`
              ${template.Identifier('key')}: ${template.Expression('value')}
            `
          )}
        },
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
    let ${template.Identifier('var')} = {
      ${template.many('value',
        template.entry`
          ${template.Identifier('property')}: ${template.String('type_description')}
        `
      )}
    };

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
    let ${template.Identifier('var')} = {
      ${template.many('value',
        template.entry`
          ${template.Identifier('key')}: ${template.String('value')}
        `
      )}
    }

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

it('should match function call with variable arguments', () => {
  let simple_definition = `
    console.log('Current working directory:', process.cwd());
  `;

  let definition_template = template.statements`
    console.log(${template.many('arguments', template.Expression)});
  `;

  expect(definition_template.match(simple_definition)).toMatchSnapshot();
});

it('should work with multiple repeats', () => {
  let simple_definition = `
    pre_statement();
    pre_statement2();

    my_special_function();

    post_statement();
    post_statement2();
  `;

  let definition_template = template.statements`
    ${template.many('pre', template.Statement)};

    my_special_function();

    ${template.many('post', template.Statement)};
  `;

  expect(definition_template.match(simple_definition)).toMatchSnapshot();
});

it('should not work if the repeats don\'t work', () => {
  let simple_definition = `
    pre_statement();
    pre_statement2();
    post_statement();
    post_statement2();
  `;

  let definition_template = template.statements`
    ${template.many('functions', template.statement`
      my_special_function();
    `)};
  `;

  expect(() => {
    definition_template.match(simple_definition);
  }).toThrow();
});

it('should not work if template does not suffice', () => {
  let simple_definition = `
    matching_statement();
    not_matching_statement();
  `;

  let definition_template = template.statements`
    matching_statement();
  `;

  expect(() => {
    definition_template.match(simple_definition);
  }).toThrow();
});

it('should match a repeated single key: value entry', () => {
  let simple_definition = `
    let result = {
      id: 'hey',
      xd: 'jo',
      fp: 'hi',
    };
  `;

  let definition_template = template.statements`
    let ${template.Identifier('var')} = {
      // Multiple!!!
      ${template.many('entries', template.entry`
        ${template.Identifier('key')}: ${template.String('type_description')}
      `)}
    }
  `;

  try {
    expect(definition_template.match(simple_definition)).toMatchSnapshot();
  } catch (err) {
    // console.log(`err.errors:`, JSON.stringify(err.path, null, 2));
    console.log(`err:`, JSON.stringify(err, null, 2))
    throw err;
  }
});

it('should match objects in any order', () => {
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
      xd: 'jo',
      id: 'hey',
      fp: 'hi',
    }

    module.exports = ${template.Identifier('var')};
  `;

  expect(definition_template.match(simple_definition)).toMatchSnapshot();
});

it('should match a mix between defined and rest entries', () => {
  let simple_definition = `
    let result = {
      fp: 'hi',
      id: 'hey',
      xd: 'jo',
    };
    module.exports = result;
  `;

  let definition_template = template.statements`
    let ${template.Identifier('var')} = {
      // Multiple!!!
      id: ${template.Expression('id')},
      ${template.optional('xd', template.entry`
        xd: ${template.Expression('main')}
      `)},
      ${template.many('entries', template.entry`
        ${template.Identifier('key')}: ${template.String('type_description')}
      `)}
    }

    module.exports = ${template.Identifier('var')};
  `;

  expect(definition_template.match(simple_definition)).toMatchSnapshot();
});

it('should not match shorthand object entries to real object entries', () => {
  let simple_definition = `
    let result = {
      id: 'hey',
    };
    module.exports = result;
  `;

  let definition_template = template.statements`
    let ${template.Identifier('var')} = {
      // Only one though :(
      ${template.Identifier('shorthand')}
    }

    module.exports = ${template.Identifier('var')};
  `;

  expect(() => {
    definition_template.match(simple_definition)
  }).toThrow();
});

it('should be greedy', () => {
  let simple_definition = `
    module.exports = 10;
    module.exports = 12;
  `;

  let definition_template = template.statements`
    ${template.optional('pre_expression', template.Statement)}
    module.exports = ${template.Expression('var')};
    ${template.optional('post_expression', template.Statement)}
  `;

  expect(definition_template.match(simple_definition)).toMatchSnapshot();
});
