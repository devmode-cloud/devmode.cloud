const functions = require('firebase-functions');

// if (process.version.startsWith('v12')) {
  const moduleAlias = require('module-alias');
  moduleAlias.addAlias('fs/promises', __dirname + '/fs-promises.js');
  moduleAlias.addAlias('./loader.mjs', __dirname + '/datatree-loader.mjs');
// }

process.env.BABEL_CACHE_PATH = `/tmp/babel-cache.json`;
require("@babel/register")({
  plugins: [
    '@babel/plugin-transform-modules-commonjs',
    '@babel/plugin-syntax-class-properties',
    // 'babel-plugin-transform-dynamic-import',
    'babel-plugin-transform-class-properties',
  ],
  only: [
    // /app-api.js/,
    /loader.mjs/,
    /data-tree/,
    /schemas/,
  ],
});

// seed datadog vars before we start compiling the backend
if (functions.config().datadog) {
  process.env.DD_API_KEY = functions.config().datadog.apikey;
  process.env.DD_APP_NAME = functions.config().datadog.appname;
}
process.env.DD_MANIFEST_DIR = __dirname;

const skylink = require('@dustjs/skylink');
const {createPublicApi} = require('@dustjs/backend-firebase');

// Create and Deploy Your First Cloud Functions
// https://firebase.google.com/docs/functions/write-firebase-functions

const adminConfig = JSON.parse(process.env.FIREBASE_CONFIG || '{}');
const publicEnvLoader = createPublicApi({
  FIREBASE_PROJECT_ID: adminConfig.projectId,
  FIREBASE_DATABASE_URL: adminConfig.databaseURL,
  DUSTJS_SCHEMA_PATH: __dirname+'/schemas',
  USING_BABEL: 'yes',
});

exports.skylinkOp = functions.https.onRequest(async (request, response) => {
  console.log('export POST:', request.body);

  const publicEnv = await publicEnvLoader;
  console.log('publicEnv is ready');

  if (request.method !== 'POST') return response.status(400)
    .send(`Only POST works here`);
  if (request.body === null) return response.status(400)
    .send(`Request body is required for POST`);
  if (typeof request.body.Op !== 'string') return response.status(400)
    .send(`"Op" field is required in POST`);

  try {
    const skylinkServer = new skylink.SkylinkServer(publicEnv);
    // uses processFrame - doesn't support request-intercepting extensions
    const respBody = await skylinkServer.processFrame(request.body);
    response.status(200).send(respBody);
  } catch (err) {
    console.log(err.stack);
    response.status(500).send(err.message);
  }
});
