// it('should transform this function' () => {
//   let main_code =
//
//   let replace = {
//     file: './source_file',
//     export: 'old_name',
//     replace: 'module.args[0] + module.args[1]',
//   };
// })

const { defineInlineTest } = require('jscodeshift/src/testUtils');
const transform = require('../transform-function-call.js');
let dedent = require('dedent');

defineInlineTest(transform,
  {
    export_path: '/app/src/source_file.js',
    export_name: 'old_name',
    replacement: (expression, args) => {
      return expression`${args[0]} + ${args[1]}`;
    },
  }, dedent`
  import { old_name } from './source_file.js';
  import { max } from 'math';

  let x = 10;
  max(old_name(x, Math.random()), 10);
`, dedent`
  import { old_name } from './source_file.js';
  import { max } from 'math';

  let x = 10;
  max(x + Math.random(), 10);
`, 'transform-function-call-simple');

defineInlineTest(transform,
  {
    export_path: '/app/source_file.js',
    export_name: 'apply',
    replacement: (expression, args) => {
      return expression`${args[0]}[${args[1]}](${args[2]})`
    },
  }, dedent`
  import { apply } from '../source_file.js';

  apply([1,2,3], Array.prototype.slice, 0);
`, dedent`
  import { apply } from '../source_file.js';

  [1,2,3][Array.prototype.slice](0);
`, 'transform-function-call-more-complex');


defineInlineTest(transform,
  {
    export_path: '/app/src/utils/takes.js',
    export_name: 'trace',
    imports: dedent`
      import { check } from 'hulla';
      import { kiesh } from 'dinesh';
    `,
    replacement: (expression, args) => {
      return expression`
        check(kiesh.check)
          (${args[0]})
          (${args[2]})
          + ${args[1]}
      `;
    }
  },
   dedent`
  import { trace, fail } from './utils/takes.js';

  trace(fail, 1, 2)
`, dedent`
  import { check } from 'hulla';
  import { kiesh } from 'dinesh';

  import { fail } from './utils/takes.js';

  check(kiesh.check)
    (fail)
    (2)
    + 1
`, 'transform-function-call-simple');
