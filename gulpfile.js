const { argv } = require('yargs');
const { readFileSync } = require('fs');
const _ = require('lodash');
const gulp = require('gulp');
const tap = require('gulp-tap');
const rename = require('gulp-rename');
const mergeJson = require('gulp-merge-json');
const through2 = require('through2');
const handlebars = require('handlebars');
const json5 = require('json5');

require('handlebars-helpers')();

const __options = {};
const __optionsSetter = function (chunk) {
  __options.data = json5.parse(chunk.contents.toString('utf-8'));
  __options.data = __convertOptions(__options.data);
};

const compileHandlebars = function () {
  const options = { noEscape: true, strict: true };

  handlebars.registerHelper('include', value => {
    const contents = readFileSync(value).toString('utf-8');
    return handlebars.compile(contents, options)(__options.data);
  });

  return through2.obj(function (chunk, _, callback) {
    const contents = chunk.contents.toString('utf-8');
    const compiledContents = handlebars.compile(contents, options)(__options.data);

    chunk.contents = new Buffer.from(compiledContents);
    callback(null, chunk);
  });
};

gulp.task('compile::options', async () => {
  options = _.castArray(argv.options).map(value => [...value.split(',')]);
  options = _.compact(_.union(...options));

  return gulp.src(options)
    .pipe(mergeJson({ json5: true }))
    .pipe(tap(__optionsSetter));
});

gulp.task('compile::handlebars', async () => {
  return gulp.src(argv.source)
    .pipe(compileHandlebars())
    .pipe(rename({ extname: '.rsc' }))
    .pipe(gulp.dest('./dist'));
});

gulp.task('compile', gulp.series('compile::options', 'compile::handlebars'));

const __convertOptions = function (options, context = {}) {
  for (const [optionIndex, optionValue] of Object.entries(options)) {
    if (optionIndex === 'vlans' && !_.isArray(optionValue)) {
      options[optionIndex] = __convertVlans(optionValue, context);
    }
    else if (_.isObject(optionValue)) {
      options[optionIndex] = __convertOptions(_.cloneDeep(optionValue), context);
    }
    else if (_.isString(optionValue)) {
      options[optionIndex] = __convertString(optionValue, context);
    }
  }
  return options;
}

const __convertVlans = function (options, context) {
  const convertedVlans = [];
  for (const [optionIndex, optionValue] of Object.entries(options)) {
    const parsedIndex = _.toNumber(optionIndex);
    let parsedIndexes = parsedIndex || optionIndex.match(/^(\d+)\.\.(\d+)$/)?.slice(1);

    if (!!parsedIndexes) {
      parsedIndexes = _.castArray(parsedIndexes);
      for (let i = parsedIndexes[0], end = _.last(parsedIndexes); i <= end; i++) {
        const vlanContext = _.extend({}, _.cloneDeep(context), { vlan: { id: i } });
        convertedVlans[i] = __convertOptions(_.cloneDeep(optionValue), vlanContext);
      }
    }
  }

  return convertedVlans;
};

const __convertString = function (optionValue, context) {
  return _.replace(optionValue, /\{\{(vlan|env)::([^\}]+)\}\}/g, (_, func, arg) => {
    switch (func) {
      case 'vlan': return context.hasOwnProperty(func) ? context[func][arg] : null;
      case 'env': return process.env[arg];
    }
  });
};