'use strict';

var gulp = require('gulp');
var eslint = require('gulp-eslint');
var babel = require('gulp-babel');
var chalk = require('chalk');

var clerk;

gulp.task('lint', function(){
  return gulp.src(['lib/*.js', './*.js', './bin/*.js'])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failOnError());
});

gulp.task('initClerk', function(){
  clerk = require('./dist/clerk');
  clerk.start({
    updateRemotely: false
  });
})

gulp.task('buildIndex', function(done) {
  clerk.index.build(function(index){
    clerk.index.write(index);
    console.log(chalk.cyan('\n           Wat: Rebuilt index.\n'));
    done();
  });
});

gulp.task('watch', function() {
  gulp.watch('docs/**/*.md', ['buildIndex']);
  gulp.watch('src/**/*.js', ['babel']);
});

gulp.task('babel', function() {
  console.log(chalk.cyan('\n           Wat: Transpiled to ES5.\n'));
  return gulp.src('src/**/*.js')
    .pipe(babel())
    .pipe(gulp.dest('dist'));
});

gulp.task('default', ['babel', 'initClerk', 'buildIndex', 'watch']);

