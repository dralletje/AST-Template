let { namedTypes: t } = require('ast-types');
let { omit } = require('lodash');

let container_nodes = {
  ExpressionStatement: {
    type: 'ExpressionStatement',
    get: (x) => x.expression,
  },
  ObjectProperty: {
    type: 'ObjectProperty',
    get: (property) => property.shorthand && property.key,
  },
  JSXExpressionContainer: {
    type: 'JSXExpressionContainer',
    get: (container) =>
      container.type === 'StringLiteral' ? container : container.expression,
    wrap: (expression) => {
      if (!t.Expression.check(expression)) {
        // prettier-ignore
        throw new Error(`Trying to wrap non-expression (${expression.type}) into JSXExpressionContainer`);
      }

      return {
        type: 'JSXExpressionContainer',
        expression: expression,
      };
    },
  },
  JSXAttribute: {
    type: 'JSXAttribute',
    get: (container) => container.value == null && container.name,
  },
};

let get_contained_node = (node) => {
  let container_type = container_nodes[node.type];
  if (container_type) {
    let value = container_type.get(node);
    if (value) {
      return {
        ...value,
        astemplate_wrap: container_type.wrap,
        astemplate_get: container_type.get,
      };
    } else {
      return node;
    }
  } else {
    return node;
  }
};

let is_placeholder = (_node) => {
  if (_node == null) {
    return false;
  }
  let node = get_contained_node(_node);
  return (
    (node.type === 'Identifier' || node.type === 'JSXIdentifier') &&
    node.name.startsWith('$$placeholder_')
  );
};

let get_placeholder = (node_template, placeholders) => {
  if (is_placeholder(node_template)) {
    let placeholder_node = get_contained_node(node_template);
    let placeholder_id = placeholder_node.name;
    let placeholder_description = placeholders[placeholder_id];
    return {
      wrap: placeholder_node.astemplate_wrap || ((x) => x),
      get: placeholder_node.astemplate_get || ((x) => x),
      ...placeholder_description,
    };
  } else {
    return null;
  }
};

let REPEAT_TYPE = Symbol('Repeat a part a certain number of times');
let EITHER_TYPE = Symbol('Matches one of multiple subtemplates');

let remove_keys = (object) => {
  let unnecessary_keys = [
    'start',
    'end',
    'loc',
    '__clone',
    'trailingComments',
    'leadingComments',
    'innerComments',
    'comments',
    'extra',
  ];
  return omit(object, unnecessary_keys);
};

module.exports = { is_placeholder, get_placeholder, REPEAT_TYPE, EITHER_TYPE, remove_keys }
