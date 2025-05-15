var gulp = require('gulp');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');

gulp.task('bundle', function () {
    return gulp.src(['./src/imprint.js', './src/imprint.test.*.js'])
        .pipe(concat('imprint.js'))
        .pipe(gulp.dest('./dist'))
        .pipe(concat('imprint.min.js'))
        .pipe(uglify())
        .pipe(gulp.dest('./dist'));
});