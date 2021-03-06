require('ts-node').register({
    project: 'static/js/tsconfig.json',
    compilerOptions: {
        typeRoots: ["node_modules/@types", "./js_typings"],
        // We don't have webpack to handle es6 modules here so directly
        // transpile to CommonJS format.
        module: "commonjs",
    },
});

var path = require('path');
var fs = require('fs');

global.assert = require('assert');
require('core-js/features/string/code-point-at');

global._ = require('underscore/underscore.js');
var _ = global._;
const windowObj = {
    location: {
        hash: '#',
    },
};
global.window = _.extend({}, windowObj, {
    to_$: () => {
        return windowObj;
    },
});

global.Dict = require('../../static/js/dict').Dict;

// Create a helper function to avoid sneaky delays in tests.
function immediate(f) {
    return () => {
        return f();
    };
}

// Find the files we need to run.
var finder = require('./finder.js');
var files = finder.find_files_to_run(); // may write to console
if (_.isEmpty(files)) {
    throw "No tests found";
}

// Set up our namespace helpers.
var namespace = require('./namespace.js');
global.set_global = namespace.set_global;
global.patch_builtin = namespace.patch_builtin;
global.zrequire = namespace.zrequire;
global.stub_out_jquery = namespace.stub_out_jquery;
global.with_overrides = namespace.with_overrides;

// Set up stub helpers.
var stub = require('./stub.js');
global.with_stub = stub.with_stub;

// Set up fake jQuery
global.make_zjquery = require('./zjquery.js').make_zjquery;

// Set up fake blueslip
global.make_zblueslip = require('./zblueslip.js').make_zblueslip;

// Set up fake translation
global.stub_i18n = require('./i18n.js');

// Set up Handlebars
const handlebars = require('./handlebars.js');
global.make_handlebars = handlebars.make_handlebars;
global.stub_templates = handlebars.stub_templates;

var noop = function () {};

// Set up fake module.hot
// eslint-disable-next-line no-native-reassign
module = require('module');
module.prototype.hot = {
    accept: noop,
};

// Set up fixtures.
global.read_fixture_data = (fn) => {
    var full_fn = path.join(__dirname, '../../zerver/tests/fixtures/', fn);
    var data = JSON.parse(fs.readFileSync(full_fn, 'utf8', 'r'));
    return data;
};

function short_tb(tb) {
    const lines = tb.split('\n');

    var i = _.findIndex(lines, (line) => {
        return line.includes('run_test') || line.includes('run_one_module');
    });

    if (i === -1) {
        return tb;
    }

    return lines.splice(0, i + 1).join('\n') + '\n(...)\n';
}

// Set up bugdown comparison helper
global.bugdown_assert = require('./bugdown_assert.js');

function run_one_module(file) {
    console.info('running tests for ' + file.name);
    require(file.full_name);
}

global.run_test = (label, f) => {
    if (files.length === 1) {
        console.info('        test: ' + label);
    }
    f();
};

try {
    files.forEach(function (file) {
        global.patch_builtin('setTimeout', noop);
        global.patch_builtin('setInterval', noop);
        _.throttle = immediate;
        _.debounce = immediate;

        run_one_module(file);
        namespace.restore();
    });
} catch (e) {
    if (e.stack) {
        console.info(short_tb(e.stack));
    } else {
        console.info(e);
    }
    process.exit(1);
}
