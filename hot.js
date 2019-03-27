/**
 * Created by lrh on 2019-03-13.
 */
const supervisor = require('supervisor');
/**
 * Supervisor Run www
 */

var args = [];
args[0] = './www';

supervisor.run(args);