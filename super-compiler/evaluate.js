let { flattenDeep } = require('lodash');

// let is_dependency_for_express = () => {
//   for (let [name, object] of Object.entries(condition)) {
//     if ()
//   }
// }

let is_relevant = (condition, reference) => {
  for (let [name, object] of Object.entries(condition)) {
    if (object === reference) {
      return true;
    }

    if (typeof object === 'object' && object != null) {
      if (is_relevant(object, reference)) {
        return true;
      }
    }
  }

  return false;
}

let take = (place, conditions) => {
  console.log(`place:`, place);
  let relevant_assertions = conditions.filter(condition => is_relevant(condition, place));
  console.log(`relevant_assertions:`, relevant_assertions);
  return relevant_assertions;
}

let make_two_way_graph = (conditions) => {
  let previous = Symbol('Start');
  let nodes = [];
  for (let condition of conditions) {
    console.log(`condition:`, condition)
  }

}

let evaluate = (context, conditions) => {
  console.log(`conditions:`, conditions)
  let flat_conditions = flattenDeep(conditions);

  let assertions = [];

  for (let condition of flat_conditions) {
    console.log(`condition:`, condition);

    if (condition.type === 'Assert') {
      assertions.push(condition);
    }

    if (condition.type === 'Jump') {
      if (condition.to === context.jump_return) {
        return take(condition.with, assertions);
      }
      throw new Error('Unknown jump');
    }
  }
}

module.exports = { evaluate };
