const gulp = require( 'gulp' );
const rtlcss = require( 'gulp-rtlcss' );
const concat = require( 'gulp-concat' );
const cssbeautify = require( 'gulp-cssbeautify' );
const cssuglify = require( 'gulp-uglifycss' );
const jsuglify = require( 'gulp-uglify' );
const sass = require( 'gulp-sass' )( require( 'sass' ) );
const spawn = require( 'child_process' ).spawn;

function scssTask( cb ) {

  // compile scss to css and minify
  gulp.src( './assets/css/admin.scss' )
  .pipe( sass( ({outputStyle: 'expanded'}) ).on( 'error', sass.logError ) )
  .pipe( cssbeautify() )
  .pipe( gulp.dest( './assets/css' ) )
  .pipe( cssuglify() )
  .pipe( concat( 'admin.min.css' ) )
  .pipe( gulp.dest( './assets/css' ) )
  .pipe( rtlcss() )
  .pipe( gulp.dest( './assets/css/rtl' ) );

  cb();
}
exports.scss = scssTask;


function jsTask( cb ) {
  gulp.src(
      [ './assets/js/src/imprintjs/dist/imprint.js',
        './assets/js/src/burst.js'
      ], { allowEmpty: true })
  .pipe( concat( 'burst-cookieless.js' ) )
  .pipe( gulp.dest( './assets/js/build' ) )
  .pipe( concat( 'burst-cookieless.min.js' ) )
  .pipe( jsuglify() )
  .pipe( gulp.dest( './assets/js/build' ) );

  gulp.src( './assets/js/src/burst.js', { allowEmpty: true })
  .pipe( concat( 'burst.js' ) )
  .pipe( gulp.dest( './assets/js/build' ) )
  .pipe( concat( 'burst.min.js' ) )
  .pipe( jsuglify() )
  .pipe( gulp.dest( './assets/js/build' ) );

  gulp.src( './assets/js/src/goals.js', { allowEmpty: true })
  .pipe( concat( 'burst-goals.js' ) )
  .pipe( gulp.dest( './assets/js/build' ) )
  .pipe( concat( 'burst-goals.min.js' ) )
  .pipe( jsuglify() )
  .pipe( gulp.dest( './assets/js/build' ) );

  cb();
}
exports.js = jsTask;

function watchTask( cb ) {
  gulp.watch( './assets/css/**/*.scss', { ignoreInitial: false }, scssTask );
  gulp.watch( './assets/js/src/*.js', { ignoreInitial: false }, jsTask );
  cb();
}
exports.watch = watchTask;

function defaultTask( cb ) {
  gulp.watch( './assets/css/**/*.scss', { ignoreInitial: false }, scssTask );
  gulp.watch( './assets/js/src/*.js', { ignoreInitial: false }, jsTask );
  spawn( 'npm', [ 'start' ], { cwd: 'settings', stdio: 'inherit' });
  cb();
}
exports.default = defaultTask;

