let generate_unsafe = require('babel-generator').default;
let { parse, parseExpression } = require('@babel/parser');
let { namedTypes: t } = require('ast-types');
let { zip, isEqual, omit, isObject, range } = require('lodash');

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

let remove_keys = (object) => {
  let unnecessary_keys = [
    'start',
    'end',
    'loc',
    '__clone',
    'trailingComments',
    'leadingComments',
  ];
  return omit(object, unnecessary_keys);
};

let container_nodes = {
  ExpressionStatement: {
    type: 'ExpressionStatement',
    get: (x) => x.expression,
  },
};

let get_contained_node = (node) => {
  if (container_nodes[node.type]) {
    return container_nodes[node.type].get(node);
  } else {
    return node;
  }
};

let is_placeholder = (_node) => {
  let node = get_contained_node(_node);
  return node.type === 'Identifier' && node.name.startsWith('$$placeholder_');
};

let get_placeholder = (node_template, placeholders) => {
  if (is_placeholder(node_template)) {
    let placeholder_id = get_contained_node(node_template).name;
    let placeholder_description = placeholders[placeholder_id];
    return placeholder_description;
  } else {
    return null;
  }
};

let is_primitive = (x) => !isObject(x);

let match_subtemplate = ({ template: _template, node }) => {
  if (typeof _template === 'function') {
    let x = (template.expression`${_template('basic')}`).match(node);
    return {
      mismatches: [],
      areas: x.areas.basic,
    }
  } else {
    if (typeof _template.match === 'function') {
      return _template.match(node);
    } else {
      let t = {
        ..._template,
        name: 'basic',
      };
      let x = (template.expression`${t}`).match(node);
      return {
        mismatches: [],
        areas: x.areas.basic,
      }
    }
  }
}

let compare_node = (
  _node_template,
  _node_filled_in,
  placeholders,
  path = []
) => {
  // First case is easy, this is to compare primitives.
  // If they match, nice
  // If they don't, we have a mismatch
  if (!isObject(_node_template) || !isObject(_node_filled_in)) {
    if (_node_template === _node_filled_in) {
      return { areas: {}, mismatches: [] };
    } else {
      console.log(`_node_template:`, _node_template);
      console.log(`_node_filled_in:`, _node_filled_in);
      return {
        areas: {},
        mismatches: [{ message: 'Not equal' }],
      };
    }
  }

  // We strip all the bloat (like line numers and locations) from the nodes,
  // because these will never be equal (or mostly never, we don't care about them anyway)
  let node_template = remove_keys(_node_template);
  let node_filled_in = remove_keys(_node_filled_in);

  // console.log(`node_template:`, node_template)
  // console.log(`node_filled_in:`, node_filled_in)

  // If the node we look at is a placeholder, we need to store the value we are currently at
  //
  if (is_placeholder(node_template)) {
    let {
      // map_fn allows for extra checks and simplification
      map_fn = (x) => x,
      type,
      name,
    } = get_placeholder(node_template, placeholders);

    // TODO Maybe REPEAT_TYPE optional should be useful here if seomthing could be undefined?
    if (type === REPEAT_TYPE) {
      throw new Error(`Repeat used in a non-array place`);
    }

    // TODO `map_fn` should be able to return mismatches as well,
    // .... and those should be added to the `mismatches` property returned

    if (!type.check(node_filled_in)) {
      throw new Error(
        `Type '${type}' does not match '${generate(node_filled_in)}'`
      );
    }

    let result = map_fn(node_filled_in, (template_sub, filled_sub) => {
      // TODO I'm not entirely sure if this `placeholders` is the right one to pass on,
      // .... it seems like this would not contain the "sub placeholders" that we actually care about
      return match_ast(template_sub, filled_sub, placeholders);
    });

    return {
      areas: {
        [name]: result,
      },
      mismatches: [],
    };
  }

  // Now for the deeper equality check, we check if the keys match up.
  // If they don't, no reason to look further: Those are different
  if (!isEqual(Object.keys(node_template), Object.keys(node_filled_in))) {
    return {
      areas: {},
      mismatches: [
        {
          message: 'Different keys!',
          path,
          keys_template: Object.keys(node_template),
          keys_filled_in: Object.keys(node_filled_in),
        },
      ],
    };
  }

  if (node_template.type == null) {
    if (isEqual(node_template, node_filled_in)) {
      return { areas: {}, mismatches: [] };
    } else {
      console.log(`node_template:`, node_template)
      throw new Error(`'node_template' has type null?`);
    }
  }

  // Same thing about the types, if those don't match we are done
  if (node_template.type !== node_filled_in.type) {
    throw new Error(
      `Node type '${node_template.type}' does not equal '${
        node_filled_in.type
      }'`
    );
  }

  let areas = {};
  let mismatches = [];

  // For every key, we are going to check if it is equal
  // This is where stuff gets tricky, because if we encounter an array in here,
  // we can be in for a heck of a ride with optionals/repeats
  // But you will see that later in this block
  for (let [key, template_value] of Object.entries(node_template)) {
    let filled_in_value = node_filled_in[key];

    // THIS, is where the real magic begins (at least, for now)
    // If it is an array, I need to check if this array contains any placeholder identifiers.
    //   If it contains a placeholder identifier, I need to check if it is a REPEAT_TYPE, because
    //     If it is actually a REPEAT_TYPE, I need to try out the possible combinations that this
    //     could work out it, and find one that does. So "giving" more elements to the repeat placeholder
    //     until it matches the template (or runs out)
    if (Array.isArray(template_value)) {
      // Figure out all the repeat placeholders in this array.
      // For now, we assume just one (to make things easy)
      let repeat_placeholders = template_value.filter(
        (x) =>
          is_placeholder(x) &&
          get_placeholder(x, placeholders).type === REPEAT_TYPE
      );
      // let repeat_placeholder =
      //   repeat_placeholders[0] != null
      //     ? get_placeholder(repeat_placeholders[0], placeholders)
      //     : null;

      // If there are no repeat placeholders, the length of the template and the real value should match.
      // I'm just doing this as a shortcut for my brain, in the final result this should work automatically
      if (repeat_placeholders.length === 0) {
        if (template_value.length !== filled_in_value.length) {
          throw new Error(`Not same array lengths, and no repeats inside`)
        }
      }

      if (repeat_placeholders.length > 1) {
        throw new Error('Not yet!');
      }

      let template_length_without_repeat = template_value.length - 1;
      let repeat_length =
        filled_in_value.length - template_length_without_repeat;

      // Now I need to figure out how to match the template with repeat, to the real thing.
      // One thing I figured, is I can see how much is before the repeat, and how much is after.
      // Because from these, I know exactly how many there should be.
      let index = -1;
      for (let temp_sub of template_value) {
        index = index + 1;

        let fill_sub = filled_in_value[index];
        // console.log(`index:`, index)
        // console.log(`generate(temp_sub):`, generate(temp_sub))
        // console.log(`generate(fill_sub):`, generate(fill_sub))
        if (
          is_placeholder(temp_sub) &&
          get_placeholder(temp_sub, placeholders).type === REPEAT_TYPE
        ) {
          let repeat = get_placeholder(temp_sub, placeholders);

          let results = [];

          if (repeat_length > repeat.max) {
            throw new Error(
              `Repeat is required more often than max (${repeat_length} > ${
                repeat.max
              })`
            );
          }
          if (repeat_length < repeat.min) {
            throw new Error(
              `Repeat is required less often than min (${repeat_length} > ${
                repeat.max
              })`
            );
          }

          for (let i of range(index, index + repeat_length)) {
            let result = match_subtemplate({
              template: repeat.subtemplate,
              node: filled_in_value[i],
            });
            // TODO Check for mismatch!
            results.push(result.areas);
          }
          areas = {
            ...areas,
            [repeat.name]: results,
          };
          index = index - 1 + repeat_length;
        } else {
          // Just compare the two values in the array on these indexes
          try {
            let result = compare_node(temp_sub, fill_sub, placeholders, [
              ...path,
              {
                key: `${key}.${index}`,
                template_value: generate(temp_sub),
                filled_in_value: generate(fill_sub),
              },
            ]);

            // Warn by multiple areas
            areas = {
              ...areas,
              ...result.areas,
            };
            mismatches = [...mismatches, ...result.mismatches];
          } catch (err) {
            err.message = `${path}${key}.${index}: ${err.message}`
            throw err;
          }
        }
      }
    } else {
      if (key === 'extra') {
        continue;
      }

      // If the value is not an array, that means it is a "normal" object or primitive.
      // in which case, we can compare them with `compare_node`, which is great.
      let sub_path = [
        ...path,
        {
          key,
          template_value: generate(template_value),
          filled_in_value: generate(filled_in_value),
        },
      ];

      let result = compare_node(
        template_value,
        filled_in_value,
        placeholders,
        sub_path
      );
      // TODO Warn if there are multiple areas in result?
      areas = {
        ...areas,
        ...result.areas,
      };
      mismatches = [...mismatches, ...result.mismatches];
    }
  }

  return {
    areas: areas,
    mismatches: mismatches,
  };
};

let match_ast = (template_ast, filled_ast, placeholders) => {
  let { mismatches, areas } = compare_node(
    template_ast.program || template_ast,
    filled_ast.program || filled_ast,
    placeholders
  );

  for (let [key, placeholder] of Object.entries(placeholders)) {
    let node = areas[placeholder.name];
    if (node == null && placeholder.type !== REPEAT_TYPE) {
      throw new Error(`Unmatched placeholder '${placeholder.name}'`);
    }
  }

  return {
    mismatches,
    areas,
  };
};

let generate_placeholders = (text, nodes) => {
  let next_placeholder_id = 0;
  let placeholders = {};

  let source = zip(text, nodes)
    .map(([text, node]) => {
      if (node) {
        let name = `$$placeholder_${next_placeholder_id}`;
        placeholders[name] = node;

        next_placeholder_id = next_placeholder_id + 1;
        return `${text}${name}`;
      }
      return text;
    })
    .join('');

  return { placeholders, source };
};

let expression = (text, ...nodes) => {
  let { placeholders, source } = generate_placeholders(text, nodes);
  let template_ast = parseExpression(source);

  return {
    match: (compare_source) => {
      let ast_filled_in =
        typeof compare_source === 'string'
          ? parseExpression(compare_source)
          : compare_source;
      return match_ast(template_ast, ast_filled_in, placeholders);
    },
    ast: template_ast,
  };
};

let statements = (text, ...nodes) => {
  let { placeholders, source } = generate_placeholders(text, nodes);
  let template_ast = parse(source);

  return {
    match: (compare_source) => {
      let ast_filled_in = parse(compare_source);
      return match_ast(template_ast, ast_filled_in, placeholders);
    },
    ast: template_ast,
  };
};

let REPEAT_TYPE = Symbol('Repeat a part a certain number of times');
let template = {
  expression: expression,
  statements: statements,

  optional: (name, subtemplate) => {
    return {
      type: REPEAT_TYPE,
      name: name,
      min: 0,
      max: 1,
      subtemplate: subtemplate,
    };
  },

  repeat: (name, min, max, subtemplate) => {
    return {
      type: REPEAT_TYPE,
      name: name,
      min: min,
      max: max,
      subtemplate: subtemplate,
    };
  },

  many: (name, subtemplate) => {
    return {
      type: REPEAT_TYPE,
      name: name,
      min: 0,
      max: Infinity,
      subtemplate: subtemplate,
    };
  },

  Expression: (name, { scope } = { scope: null }) => {
    return {
      type: t.Expression,
      name,
      map_fn: scope != null ? (x) => minivaluate(x, scope) : (x) => generate(x),
    };
  },
  Statement: (name, { scope } = { scope: null }) => {
    return {
      type: t.Statement,
      name,
      map_fn: x => generate(x),
    };
  },
  Identifier: (name) => {
    return {
      type: t.Identifier,
      title: 'Identifier',
      name,
      map_fn: (x) => x.name,
    };
  },
  String: (name) => {
    return { type: t.StringLiteral, name, map_fn: (x) => x.value };
  },
  Object: (name, property_rules) => {
    return {
      type: t.ObjectExpression,
      name,
      map_fn: (object) => {
        return {
          mismatches: [],
          value: object.properties.map((property) => {
            let key_match = match_subtemplate({
              template: property_rules.key,
              node: property.key
            });
            let value_match = match_subtemplate({
              template: property_rules.value,
              node: property.value,
            });
            return {
              key: key_match.areas,
              value: value_match.areas,
            };
          }),
        };
      },
    };
  },
};

let minivaluate = (expression, scope) => {
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

  throw new Error(
    `Couldn't parse '${generate(expression)}' (${expression.type})`
  );
};

module.exports = { minivaluate, template };
