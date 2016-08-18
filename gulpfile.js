var fs = require('fs');
var path = require('path');

var gulp = require('gulp');
var sass = require('gulp-sass');
var npmSass = require('npm-sass');
var browserify = require('browserify');
var source = require('vinyl-source-stream')
var buffer = require('vinyl-buffer');
var gutil = require('gulp-util');

var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var autoprefixer = require('gulp-autoprefixer');
var concat = require('gulp-concat');

// Load all gulp plugins automatically
// and attach them to the `plugins` object
var plugins = require('gulp-load-plugins')();

// Temporary solution until gulp 4
// https://github.com/gulpjs/gulp/issues/355
var runSequence = require('run-sequence');

var pkg = require('./package.json');
var dirs = pkg['h5bp-configs'].directories;

// ---------------------------------------------------------------------
// | Helper tasks                                                      |
// ---------------------------------------------------------------------

gulp.task('archive:create_archive_dir', function () {
    fs.mkdirSync(path.resolve(dirs.archive), '0755');
});

gulp.task('archive:zip', function (done) {

    var archiveName = path.resolve(dirs.archive, pkg.name + '_v' + pkg.version + '.zip');
    var archiver = require('archiver')('zip');
    var files = require('glob').sync('**/*.*', {
        'cwd': dirs.dist,
        'dot': true // include hidden files
    });
    var output = fs.createWriteStream(archiveName);

    archiver.on('error', function (error) {
        done();
        throw error;
    });

    output.on('close', done);

    files.forEach(function (file) {

        var filePath = path.resolve(dirs.dist, file);

        // `archiver.bulk` does not maintain the file
        // permissions, so we need to add files individually
        archiver.append(fs.createReadStream(filePath), {
            'name': file,
            'mode': fs.statSync(filePath).mode
        });

    });

    archiver.pipe(output);
    archiver.finalize();

});

gulp.task('clean', function (done) {
    require('del')([
        dirs.archive,
        dirs.dist
    ]).then(function () {
        done();
    });
});

gulp.task('copy', [
    'copy:.htaccess',
    'copy:index.html',
    'copy:license'
]);

gulp.task('copy:.htaccess', function () {
    return gulp.src('node_modules/apache-server-configs/dist/.htaccess')
               .pipe(plugins.replace(/# ErrorDocument/g, 'ErrorDocument'))
               .pipe(gulp.dest(dirs.dist));
});

gulp.task('copy:index.html', function () {
    return gulp.src(dirs.src + '/index.html')
               .pipe(plugins.replace(/{{JQUERY_VERSION}}/g, pkg.devDependencies.jquery))
               .pipe(gulp.dest(dirs.dist));
});

gulp.task('copy:license', function () {
    return gulp.src('LICENSE.txt')
               .pipe(gulp.dest(dirs.dist));
});


gulp.task('sass', function () {
    return gulp.src(dirs.src + '/scss/**/*.scss')
        .pipe(sass({
            importer: npmSass.importer
        }))
        .pipe()
});



gulp.task('sass', function () {
    var autoprefixerOptions = {
        browsers: ['last 2 versions', '> 5%', 'Firefox ESR']
    };

    var sassOptions = {
        errLogToConsole: true,
        outputStyle: 'expanded',
        importer: npmSass.importer
    };

    return gulp
        .src(dirs.src + '/scss/**/*.scss')
        .pipe(sourcemaps.init())
        .pipe(sass(sassOptions).on('error', sass.logError))
        .pipe(concat('app.css', {
            newLine:'\n' // the newline is needed in case the file ends with a line comment
        }))
        .pipe(autoprefixer(autoprefixerOptions))

        .pipe(sourcemaps.write())

        .pipe(gulp.dest(dirs.dist + '/css'))

});

gulp.task('scripts', function () {

    // set up the browserify instance on a task basis
    var b = browserify({
        entries: './index.js'
    });

    // return gulp.src(dirs.src + '/js/**/*.js', {base: '.'})
    return b.bundle()
        .pipe(source('app.js'))
        .pipe(buffer())
        .pipe(sourcemaps.init())
        .pipe(uglify({
            compress: {
                drop_debugger: false
            }
        }))
        .on('error', gutil.log)

        .pipe(sourcemaps.write())

        .pipe(gulp.dest(dirs.dist + '/js'));
});

// gulp.task('lint:js', function () {
//     return gulp.src([
//         'gulpfile.js',
//         dirs.src + '/js/*.js',
//     ]).pipe(plugins.jscs())
//       .pipe(plugins.jshint())
//       .pipe(plugins.jshint.reporter('jshint-stylish'))
//       .pipe(plugins.jshint.reporter('fail'));
// });


// ---------------------------------------------------------------------
// | Main tasks                                                        |
// ---------------------------------------------------------------------

gulp.task('archive', function (done) {
    runSequence(
        'build',
        'archive:create_archive_dir',
        'archive:zip',
    done);
});



gulp.task('build', function (done) {
    runSequence(
        // ['clean', 'lint:js'],
        ['clean'], //disable linting for now
        'copy',
        'scripts',
        'sass',
    done);
});

gulp.task('default', ['watch']);

gulp.task('watch', function() {
    gulp.watch([dirs.src + '/index.html', dirs.src + '/js/**/*.js', dirs.src + '/scss/**/*.scss'], ['build']);
});
