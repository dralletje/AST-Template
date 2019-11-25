let generate_unsafe = require('babel-generator').default;

let generate = (ast) => {
  try {
    if (Array.isArray(ast)) {
      return ast.map(generate);
    }
    return generate_unsafe(ast).code;
  } catch (err) {
    return ast;
  }
};

let minivaluate = (_expression, scope) => {
  let expression = _expression.ast || _expression;

  if (expression.type === 'Identifier') {
    // Variable!!
    let val = scope[expression.name];
    if (val == null) {
      throw new Error(`Not found '${val}'`);
    }
    return val;
  }
  if (expression.type === 'MemberExpression') {
    let object = minivaluate(expression.object, scope);
    let property = expression.property.name;
    return object[property];
  }

  if (expression.type === 'ObjectExpression') {
    let obj = {};

    for (let property of expression.properties) {
      // precondition(property.key.type === 'Identifier');
      // precondition(property.computed === false)
      obj[property.key.name] = minivaluate(property.value, scope);
    }
    return obj;
  }

  if (expression.type === 'StringLiteral') {
    return expression.value;
  }
  if (expression.type === 'NumericLiteral') {
    return expression.value;
  }
  if (expression.type === 'BooleanLiteral') {
    return expression.value;
  }

  let numberic_operators = ['+', '-', '*', '/'];
  if (expression.type === 'BinaryExpression') {
    let right = minivaluate(expression.right, scope);
    let left = minivaluate(expression.left, scope);

    if (typeof right !== typeof left) {
      throw new Error(
        `Trying to operate on '${typeof right}' and '${typeof left}' in '${generate()}'`
      );
    }
    let type = typeof right;

    if (expression.operator === '+') {
      if (type === 'string') {
        return left + right;
      }
      if (type === 'number') {
        return left + right;
      }
    }
  }

  console.log(`expression:`, expression)
  throw new Error(
    `Couldn't parse '${generate(expression)}' (${expression.type})`
  );
};

module.exports = { minivaluate };
