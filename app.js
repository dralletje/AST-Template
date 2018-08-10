let generate_unsafe = require('babel-generator').default;
let { parse, parseExpression } = require('@babel/parser');
let { namedTypes: t } = require('ast-types');
let { zip, isEqual, fromPairs, omit } = require('lodash');

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

let compare_node = (
  _node_template,
  _node_filled_in,
  placeholders,
  path = []
) => {
  if (
    typeof _node_template !== 'object' ||
    typeof _node_filled_in !== 'object'
  ) {
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
  let node_template = remove_keys(_node_template);
  let node_filled_in = remove_keys(_node_filled_in);

  if (node_template.type === 'Identifier') {
    if (node_template.name.startsWith('$$placeholder_')) {
      let placeholder_id = node_template.name;
      let placeholder = placeholders[placeholder_id];

      // TODO Not sure if something with REPEAT should happen here

      let map_fn = placeholder.map_fn || ((x) => x);
      return {
        areas: {
          [placeholder.name]: map_fn(node_filled_in, (template_sub, filled_sub) => {
            return match_ast(template_sub, filled_sub, placeholders);
          }),
        },
        mismatches: [],
      };
    }
  }

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

  if (
    node_template.type == null ||
    node_template.type !== node_filled_in.type
  ) {
    return {
      areas: null,
      mismatches: [{ message: 'Different types!', path }],
    };
  }

  let areas = {};
  let mismatches = [];

  for (let [key, template_value] of Object.entries(node_template)) {
    let filled_in_value = node_filled_in[key];

    if (Array.isArray(template_value)) {
      let index = -1;
      for (let temp_sub of template_value) {
        index = index + 1;

        let fill_sub = filled_in_value[index];
        // console.log(`index:`, index)
        // console.log(`generate(temp_sub):`, generate(temp_sub))
        // console.log(`generate(fill_sub):`, generate(fill_sub))
        if (
          temp_sub.type === 'ExpressionStatement' &&
          temp_sub.expression.type === 'Identifier' &&
          temp_sub.expression.name.startsWith(`$$placeholder_`)
        ) {
          let placeholder_id = temp_sub.expression.name;
          let placeholder = placeholders[placeholder_id];
          let map_fn = placeholder.map_fn || ((x) => x);

          if (placeholder.type === REPEAT_TYPE) {
            try {
              areas = {
                ...areas,
                [placeholder.name]: match_ast(temp_sub, fill_sub, placeholders),
              };
              continue;
            } catch (err) {
              console.log(`err:`, err);
              index = index - 1;
              continue;
            }
          } else {
            areas = {
              ...areas,
              [placeholder.name]: map_fn(fill_sub, (template_sub, filled_sub) => {
                return match_ast(template_sub, filled_sub, placeholders);
              }),
            };
          }
        }

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
        continue;
      }
      continue;
    }

    let sub_path = [
      ...path,
      {
        key,
        template_value: generate(template_value),
        filled_in_value: generate(filled_in_value),
      },
    ];

    if (typeof template_value !== 'object' || template_value == null) {
      if (template_value !== filled_in_value) {
        mismatches = [
          ...mismatches,
          { message: 'Different values', path: sub_path },
        ];
        continue;
      } else {
        continue;
      }
    }

    let result = compare_node(
      template_value,
      filled_in_value,
      placeholders,
      sub_path
    );
    // Warn by multiple areas
    areas = {
      ...areas,
      ...result.areas,
    };
    mismatches = [...mismatches, ...result.mismatches];
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
      throw new Error(`Unmatched placeholder '${placeholder.name}'`)
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

  repeat: (name, min, max, subtemplate) => {
    return {
      type: REPEAT_TYPE,
      name: name,
      min: min,
      max: max,
      subtemplate: subtemplate,
    };
  },

  Expression: (name, { scope } = { scope: null }) => {
    return {
      type: t.Expression,
      name,
      map_fn: scope != null ? (x) => minivaluate(x, scope) : (x) => x,
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
            let key_match = property_rules.key.match(property.key);
            let value_match = property_rules.value.match(property.value);
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
