'use strict';
require('../src/config/migrar')()
  .then(() => process.stdout.write('Migraciones incrementales aplicadas.\n'))
  .catch((e) => {
    process.stderr.write(e.message + '\n');
    process.exitCode = 1;
  })
  .finally(() => require('../src/config/db').end());
