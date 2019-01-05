/**
 *  Copyright (c) 2016-present, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

/**
 * Example jscodeshift transformer. Simply reverses the names of all
 * identifiers.
 */
let path = require('path');

let is_variable = (path) => {
  return path.name !== 'property' || path.parentPath.node.computed === true;
}

let is_empty_import = (path) => {
  return path.specifiers.length === 0;
}

let get_relative_path = (from, to) => {
  let folder_relative = path.relative(path.dirname(from), path.dirname(to));
  if (folder_relative.startsWith('.')) {
    return `${folder_relative}/${path.basename(to)}`;
  } else {
    return path.normalize(`./${folder_relative}/${path.basename(to)}`);
  }
}

function transformer(file, api, { export_path, export_name, replacement, imports, source_path }) {
  let relative_path_to_idk = file.path || source_path || '/app/src/main.js'; // Latter is for testing
  let current_file_path = path.join(process.cwd(), relative_path_to_idk);

  // file_relative is used to check the imports, it will be like '../utils/observables'
  let file_relative = get_relative_path(current_file_path, export_path);

  let j = api.jscodeshift;
  let { statement, expression } = api.jscodeshift.template;

  // j.find`
  //   ${j.Expression('e')}(import {  })
  // `

  let import_found_as = null;

  let f1 = j(file.source)
    .find(j.ImportDeclaration)
    .forEach((import_path) => {
      let source_path = (import_path.node.source.value);

      let possible_path = path.join(path.dirname(current_file_path), source_path);
      let possible_paths = [
        `${possible_path}`,
        `${possible_path}.js`,
        `${possible_path}.json`,
      ]
      if (!possible_paths.includes(export_path)) {
        return;
      }

      let matching_import_index = import_path.node.specifiers.findIndex(
        (x) => x.imported.name === export_name
      );

      if (matching_import_index === -1) {
        return;
      }
      let matching_import = import_path.get('specifiers').get(matching_import_index);

      if (matching_import == null) {
        return;
      }

      if (import_found_as != null) {
        throw new Error(`This is weird: '${import_found_as}'`);
      }


      import_found_as = {
        local_name: matching_import.node.local.name,
        start: matching_import.node.local.start,
        end: matching_import.node.local.end,
      };
    })
    .toSource();

  if (import_found_as == null) {
    // Not imported... nothing to do here
    return file.source;
  }

  let { local_name, start, end } = import_found_as;

  let usage_found = false;

  let with_replacements = j(f1)
    .find(j.Identifier)
    .forEach((identifier_path) => {
      if (identifier_path.node.name !== local_name) {
        return; // Not our variable
      }

      if (!is_variable(identifier_path)) {
        return;
      }

      if (identifier_path.name !== 'callee') {
        return; // Only have functions calls right now, warn or error in this case
      }

      let call_path = identifier_path.parentPath;

      let bindings = identifier_path.scope.lookup(local_name).getBindings()[local_name];

      if (bindings == null) {
        return;
      }
      let binding = bindings[bindings.length - 1];

      if (start === binding.node.start && end === binding.node.end) {
        usage_found = true;
        j(call_path).replaceWith(
          replacement(expression, call_path.node.arguments)
        );
      }
    })
    .toSource();

  if (usage_found === false) {
    return file.source;
  }

  let imports_to_add = imports;

  console.log(`imports_to_add:`, imports_to_add)

  // let with_imports j(with_replacements)
  //   .find()
  return with_replacements;
}

module.exports = transformer;
