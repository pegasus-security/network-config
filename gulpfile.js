const { argv } = require('yargs');
const gulp = require('gulp');
const rename = require('gulp-rename');
const through2 = require('through2');
const handlebars = require('handlebars');

const compileHandlebars = function (options) {
  return through2.obj(function (chunk, _, callback) {
    const contents = chunk.contents.toString('utf-8');
    const compiledContents = handlebars.compile(contents)(options);

    chunk.contents = new Buffer.from(compiledContents);
    callback(null, chunk);
  });
};

gulp.task('compile', async () => {
  return gulp.src(argv.source)
    .pipe(compileHandlebars({ world: "world" }))
    .pipe(rename({ extname: '.rsc' }))
    .pipe(gulp.dest('./dist'));
});