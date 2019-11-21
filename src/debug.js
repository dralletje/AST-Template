let chalk = require('chalk');

let show_mismatch = (expected, received, vs = 'vs') => {
  return `${chalk.red(`'${received}'`)} ${vs} ${chalk.green(`'${expected}'`)}`;
};

module.exports = { show_mismatch };
