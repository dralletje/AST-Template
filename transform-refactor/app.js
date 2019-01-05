let glob_callback = require("glob");
let path = require('path');
let fs = require('mz/fs');

const transform = require('../transform-function-call.js');


let glob = (glob, options) => {
  return new Promise((yell, cry) => {
    glob_callback(glob, options , function (err, files) {
      if (err) {
        cry(err);
      } else {
        yell(files);
      }
    })
  })
}
// options is optional

let main = async () => {
  let cwd = path.join(process.cwd(), process.argv[2]);
  let files = await glob("**/*.js", {
    cwd: cwd,
  });

  let paths = files.map(x => path.join(cwd, x));

  for (let path of paths) {
    let content = await fs.readFile(path);


  }


  // files is an array of filenames.
  // If the `nonull` option is set, and nothing
  // was found, then files is ["**/*.js"]
  // er is an error object or null.
}

main();
