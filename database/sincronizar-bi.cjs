'use strict';
(async()=>{await require('../src/config/migrar')();console.log(JSON.stringify(await require('../src/services/warehouse.service').sincronizar({origen:'cli'})));})()
 .catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>require('../src/config/db').end());
